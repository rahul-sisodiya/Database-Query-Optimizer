const analyzeQueryExecution = async (db, collectionName, query, options) => {
    try {
        const collection = db.collection(collectionName);
        
        const explain = await collection.find(query, options).explain("executionStats");
        
        const executionStats = explain.executionStats;
        const winningPlan = explain.queryPlanner.winningPlan;

        const checkFullScan = (plan) => {
            if (!plan) return false;
            if (plan.stage === 'COLLSCAN') return true;
            if (plan.inputStage) return checkFullScan(plan.inputStage);
            if (plan.inputStages) return plan.inputStages.some(checkFullScan);
            return false;
        };

        const isFullScan = checkFullScan(winningPlan);

        return {
            executionTimeMillis: executionStats.executionTimeMillis,
            totalDocsExamined: executionStats.totalDocsExamined,
            totalKeysExamined: executionStats.totalKeysExamined,
            winningPlanStage: winningPlan.stage,
            isFullScan,
            explainData: explain
        };
    } catch (error) {
        console.error('Analysis error:', error.message);
        throw new Error('Could not analyze the query execution. Ensure your query is valid.');
    }
};

module.exports = { analyzeQueryExecution };
