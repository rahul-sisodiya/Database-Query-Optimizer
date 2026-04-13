/**
 * Advanced Cost-based scoring system for MongoDB operations.
 * Prioritizes logical cost metrics over execution time for stability across environments.
 */
const calculateQueryScore = (analysis) => {
    let score = 100;
    const issues = [];
    const rewards = [];
    const bonuses = [];

    const { 
        isFullScan, 
        isUsingIndex, 
        isIndexIntersection,
        hasFetchStage,
        hasSortStage,
        isSortCoveredByIndex,
        isProjectionOptimized,
        indexDetails = [],
        totalDocsExamined,
        totalKeysExamined,
        nReturned,
        stages,
        executionTimeMillis,
        options
    } = analysis;

    // SCAN TYPE and INDEX QUALITY
    if (isFullScan) {
        score -= 50; // Heavily penalize full scans
        issues.push('CRITICAL: Full Collection Scan (COLLSCAN). An index is mandatory for this query.');
    } else if (isUsingIndex) {

        const usedCompound = indexDetails.some(idx => idx.keyPattern && Object.keys(idx.keyPattern).length > 1);
        if (usedCompound) {
            bonuses.push({ val: 8, reason: 'Utilizing a compound index for optimized filtering.' });
        }


        if (!hasFetchStage) {
            bonuses.push({ val: 15, reason: 'Covered query detected. Data served entirely from index.' });
        } else if (!isProjectionOptimized) {

            const penalty = 10;
            score -= penalty;
            issues.push('SUB-OPTIMAL: Fetching full documents without projection. Add a projection to enable a covered query.');
        }


        if (nReturned > 100) {
            const keysPerDoc = totalKeysExamined / nReturned;
            if (keysPerDoc > 5) {
                const cardinalityPenalty = Math.min(20, Math.log2(keysPerDoc) * 5);
                score -= cardinalityPenalty;
                issues.push(`LOW CARDINALITY: Index is scanning ${keysPerDoc.toFixed(1)} keys per result. Consider a more selective index.`);
            }
        }
    }


    if (isIndexIntersection) {
        score -= 15;
        issues.push('INEFFICIENT: Index intersection detected (AND_HASH/AND_SORTED). A single compound index is significantly faster than intersecting multiple indexes.');
    }



    if (hasSortStage) {
        const sortPenalty = 25;
        score -= sortPenalty;
        issues.push('HIGH RISK: In-memory SORT detected. This consumes server RAM and may fail for large result sets. Add sort fields to your index.');
    } else if (isSortCoveredByIndex) {
        bonuses.push({ val: 10, reason: 'Index-covered sorting: Sort operation is handled efficiently by the index.' });
    }


    if (nReturned > 0) {
        const ratio = totalDocsExamined / nReturned;
        if (ratio > 1.1) {

            const selectivityPenalty = Math.min(40, Math.log10(ratio) * 15);
            score -= selectivityPenalty;
            if (ratio > 100) {
                issues.push(`POOR SELECTIVITY: Examined ${ratio.toFixed(0)}x more documents than returned.`);
            } else {
                issues.push(`MODERATE SELECTIVITY: Examined ${ratio.toFixed(1)} docs per result.`);
            }
        } else {
            bonuses.push({ val: 5, reason: 'Perfect selectivity (1:1 doc/result ratio).' });
        }


        const keyRatio = totalKeysExamined / nReturned;
        if (keyRatio > 2) {
            const keyPenalty = Math.min(15, Math.log2(keyRatio) * 5);
            score -= keyPenalty;
            issues.push(`INEFFICIENT INDEX SCAN: Scanned ${keyRatio.toFixed(1)} keys per result.`);
        }
    } else if (totalDocsExamined > 0) {
        const emptyScanPenalty = Math.min(30, Math.log10(totalDocsExamined + 1) * 10);
        score -= emptyScanPenalty;
        issues.push(`WASTED SCAN: Examined ${totalDocsExamined} documents but found 0 matches.`);
    }


    const isWriteOp = stages.some(s => ['UPDATE', 'DELETE', 'INSERT'].includes(s));
    if (isWriteOp) {
        const writeStage = stages.find(s => ['UPDATE', 'DELETE', 'INSERT'].includes(s));
        if (isFullScan) {
            score -= 20; // Extra penalty for unindexed writes
            issues.push(`DANGEROUS: Unindexed ${writeStage} operation. This can lock the collection and degrade performance.`);
        } else {
            bonuses.push({ val: 5, reason: `Efficiently indexed ${writeStage} operation.` });
        }
    }

    if (executionTimeMillis > 50) {
        const timePenalty = Math.min(15, Math.log10(executionTimeMillis / 10) * 5);
        score -= timePenalty;
        if (executionTimeMillis > 500) {
            issues.push(`LATENCY: High execution time (${executionTimeMillis}ms).`);
        }
    }


  
    const totalBonus = bonuses.reduce((sum, b) => sum + b.val, 0);
    const cappedBonus = Math.min(25, totalBonus);
    score += cappedBonus;
    bonuses.forEach(b => rewards.push(b.reason));

    score = Math.max(0, Math.min(100, Math.round(score)));

    let rating = 'Excellent';
    if (score < 50) rating = 'Poor';
    else if (score < 75) rating = 'Moderate';
    else if (score < 90) rating = 'Good';

    return {
        score,
        rating,
        issues,
        rewards
    };
};

module.exports = { calculateQueryScore };
