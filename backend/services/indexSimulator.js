
const analyzeExplainPlan = (explain) => {
    const winningPlan = explain.queryPlanner?.winningPlan || {};
    const executionStats = explain.executionStats || {};
    
    const stages = [];
    const stageCounts = {};
    
    const recurse = (p) => {
        if (!p) return;
        if (p.stage) {
            stages.push(p.stage);
            stageCounts[p.stage] = (stageCounts[p.stage] || 0) + 1;
        }
        if (p.inputStage) recurse(p.inputStage);
        if (p.inputStages) p.inputStages.forEach(recurse);
    };
    recurse(winningPlan);

    return {
        winningStage: stages[0] || 'UNKNOWN',
        stageBreakdown: stageCounts,
        fullTree: stages,
        executionStats: {
            executionTimeMillis: executionStats.executionTimeMillis || 0,
            totalDocsExamined: executionStats.totalDocsExamined || 0,
            totalKeysExamined: executionStats.totalKeysExamined || 0,
            nReturned: executionStats.nReturned || 0
        }
    };
};

const estimateSimulationCosts = (indexDef, docCount, avgDocSize = 1024) => {
    const fieldCount = Object.keys(indexDef).length;
    
    const estimatedSizeMB = (docCount * fieldCount * 30) / (1024 * 1024);
    
  
    let writeImpactScore = 'Low';
    const impactFactor = fieldCount * (docCount > 100000 ? 2 : 1);
    if (impactFactor > 6) writeImpactScore = 'High';
    else if (impactFactor > 3) writeImpactScore = 'Medium';

    return {
        indexSizeEstimateMB: parseFloat(estimatedSizeMB.toFixed(2)),
        writeImpactEstimate: writeImpactScore,
        buildComplexity: fieldCount > 3 ? 'Complex' : 'Simple'
    };
};

const comparePerformance = (original, simulated) => {
    if (!original || !simulated) return null;

    const getDiff = (orig, sim) => ({
        reduction: orig - sim,
        percent: orig > 0 ? parseFloat(((orig - sim) / orig * 100).toFixed(2)) : 0
    });

    const docs = getDiff(original.totalDocsExamined, simulated.totalDocsExamined);
    const keys = getDiff(original.totalKeysExamined, simulated.totalKeysExamined);
    const time = getDiff(original.executionTimeMillis, simulated.executionTimeMillis);

    const efficiencyGain = Math.max(0, (docs.percent * 0.5 + keys.percent * 0.3 + time.percent * 0.2));

    return {
        docs,
        keys,
        time,
        efficiencyGainScore: parseFloat(efficiencyGain.toFixed(2))
    };
};

const generateIndexInsights = (query, indexDef) => {
    const recommendations = [];
    const queryFields = Object.keys(query);
    const indexFields = Object.keys(indexDef);


    const firstField = indexFields[0];
    if (query[firstField] && typeof query[firstField] === 'object') {
        const operators = Object.keys(query[firstField]);
        const isRange = operators.some(op => ['$gt', '$lt', '$gte', '$lte'].includes(op));
        if (isRange && indexFields.length > 1) {
            recommendations.push('OPTIMAL ORDER: Range field detected as index prefix. Consider moving equality fields to the front.');
        }
    }

    return recommendations;
};

/**
 * @param {Object} db - MongoDB Database instance
 * @param {string} collectionName - Target collection
 * @param {Object} query - The query to test
 * @param {Object} options - Query options (sort, limit, etc)
 * @param {Object} indexToSimulate - Proposed index definition
 * @param {Object} originalStats - Baseline stats for comparison
 * @param {Object} config - { allowInProd: boolean, skipCacheWarmup: boolean }
 */
const simulateIndexImpact = async (db, collectionName, query, options, indexToSimulate, originalStats, config = {}) => {
    const { allowInProd = false, skipCacheWarmup = false } = config;

    // 1. Safety: Environment Check
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && !allowInProd) {
        return { 
            status: 'error', 
            errorCode: 'ENV_RESTRICTED',
            reason: 'Simulation blocked in production environment for safety.' 
        };
    }

    const collection = db.collection(collectionName);
    const timestamp = Date.now();
    const indexName = `sim_${process.pid}_${timestamp}_${Math.random().toString(36).substring(2, 7)}`;
    
    let indexCreated = false;

    try {
        // 2. Concurrency & Existence Check
        const existingIndexes = await collection.indexes();
        const isDuplicate = existingIndexes.some(idx => 
            JSON.stringify(idx.key) === JSON.stringify(indexToSimulate)
        );

        if (isDuplicate) {
            return { 
                status: 'skipped', 
                errorCode: 'DUPLICATE_INDEX',
                reason: 'An identical index already exists.' 
            };
        }

        const docCount = await collection.countDocuments({}, { maxTimeMS: 2000 }).catch(() => 0);
        const costs = estimateSimulationCosts(indexToSimulate, docCount);


        await collection.createIndex(indexToSimulate, { name: indexName, background: true });
        indexCreated = true;

        if (!skipCacheWarmup) {
            await collection.find(query, { ...options, maxTimeMS: 5000 }).limit(1).toArray().catch(() => {});
        }

        const explain = await collection.find(query, { ...options, maxTimeMS: 10000 }).explain("executionStats");
        const analysis = analyzeExplainPlan(explain);

        await collection.dropIndex(indexName);
        indexCreated = false;

        const improvement = comparePerformance(originalStats, analysis.executionStats);
        const recommendations = generateIndexInsights(query, indexToSimulate);

        return {
            status: 'success',
            ...analysis.executionStats,
            winningPlanStage: analysis.winningStage,
            stageBreakdown: analysis.stageBreakdown,
            improvement,
            ...costs,
            recommendations,
            isUsingSimulatedIndex: true,
            cacheStatus: skipCacheWarmup ? 'cold' : 'warm'
        };

    } catch (error) {
        if (error.message.includes('ns does not exist')) {
            return {
                status: 'skipped',
                errorCode: 'COLLECTION_NOT_FOUND',
                reason: `Collection '${collectionName}' does not exist, so simulation was skipped.`
            };
        }

        let errorCode = 'SIMULATION_FAILED';
        if (error.message.includes('timeout')) errorCode = 'TIMEOUT';
        if (!indexCreated) errorCode = 'INDEX_CREATION_FAILED';

        console.error(`[indexSimulator] Error [${errorCode}]:`, error.message);

        if (indexCreated) {
            await collection.dropIndex(indexName).catch(e => 
                console.error(`[indexSimulator] CRITICAL: Cleanup failed for ${indexName}`, e.message)
            );
        }

        return { 
            status: 'error', 
            errorCode,
            reason: error.message 
        };
    }
};

module.exports = { simulateIndexImpact };
