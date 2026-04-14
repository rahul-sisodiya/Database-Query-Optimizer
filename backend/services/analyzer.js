const analyzeQueryExecution = async (db, collectionName, query, options = {}) => {
    try {
        const collection = db.collection(collectionName);
        const indexes = await collection.indexes().catch(() => []);

        let cursor = collection.find(query);

        if (options.sort) {
            cursor = cursor.sort(options.sort);
        }

        if (options.skip) {
            cursor = cursor.skip(Number(options.skip));
        }

        if (options.limit) {
            cursor = cursor.limit(Number(options.limit));
        }

        if (options.projection) {
            cursor = cursor.project(options.projection);
        }

        const explain = await cursor.explain('executionStats');
        const executionStats = explain.executionStats || {};
        const queryPlanner = explain.queryPlanner || {};
        const winningPlan = queryPlanner.winningPlan || {};
        const projectionKeys = options.projection ? Object.keys(options.projection) : [];

        const stages = [];
        const extractStages = (plan) => {
            if (!plan) return;
            if (plan.stage) stages.push(plan.stage);
            if (plan.inputStage) extractStages(plan.inputStage);
            if (plan.inputStages) plan.inputStages.forEach(extractStages);
            if (plan.shards) plan.shards.forEach((shard) => extractStages(shard.winningPlan));
            if (plan.queryPlan) extractStages(plan.queryPlan);
        };
        extractStages(winningPlan);

        const getStage = (plan) => {
            if (!plan) return 'UNKNOWN';
            if (plan.stage) return plan.stage;
            if (plan.inputStage) return getStage(plan.inputStage);
            if (plan.inputStages) return getStage(plan.inputStages[0]);
            if (plan.queryPlan) return getStage(plan.queryPlan);
            return 'UNKNOWN';
        };

        const collectIndexNames = (plan, names = new Set()) => {
            if (!plan) return names;
            if (plan.indexName) names.add(plan.indexName);
            if (plan.inputStage) collectIndexNames(plan.inputStage, names);
            if (plan.inputStages) plan.inputStages.forEach((child) => collectIndexNames(child, names));
            if (plan.shards) plan.shards.forEach((shard) => collectIndexNames(shard.winningPlan, names));
            if (plan.queryPlan) collectIndexNames(plan.queryPlan, names);
            return names;
        };

        const nReturned = executionStats.nReturned || 0;
        const totalDocsExamined = executionStats.totalDocsExamined || 0;
        const totalKeysExamined = executionStats.totalKeysExamined || 0;
        const executionTimeMillis = executionStats.executionTimeMillis || 0;
        const efficiency = nReturned > 0 ? totalDocsExamined / nReturned : totalDocsExamined;
        const selectivityRatio = totalDocsExamined > 0 ? nReturned / totalDocsExamined : (nReturned > 0 ? 1 : 0);
        const usedIndexNames = Array.from(collectIndexNames(winningPlan));
        const indexDetails = indexes
            .filter((idx) => usedIndexNames.includes(idx.name))
            .map((idx) => ({
                name: idx.name,
                keyPattern: idx.key
            }));

        const hasFetchStage = stages.includes('FETCH');
        const hasSortStage = stages.includes('SORT');
        const isUsingIndex = stages.includes('IXSCAN');
        const isFullScan = stages.includes('COLLSCAN');
        const isIndexIntersection = stages.includes('AND_HASH') || stages.includes('AND_SORTED');
        const isProjectionOptimized = projectionKeys.length > 0;
        const isSortCoveredByIndex = Boolean(options.sort) && isUsingIndex && !hasSortStage;
        const isBadIndexUsage = isUsingIndex && nReturned > 0 && (totalKeysExamined / nReturned) > 5;
        const isLowSelectivity = nReturned > 0 && efficiency > 20;

        return {
            executionTimeMillis,
            totalDocsExamined,
            totalKeysExamined,
            nReturned,
            stages,
            efficiency,
            selectivityRatio,
            isFullScan,
            isUsingIndex,
            isIndexIntersection,
            hasFetchStage,
            hasSortStage,
            isSortCoveredByIndex,
            isProjectionOptimized,
            isBadIndexUsage,
            isLowSelectivity,
            winningPlanStage: getStage(winningPlan),
            indexDetails,
            options,
            explainData: explain
        };
    } catch (error) {
        console.error('Analysis error:', error.message);
        throw new Error(`Query analysis failed: ${error.message}`);
    }
};

module.exports = { analyzeQueryExecution };
