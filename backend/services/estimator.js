const estimatePerformanceGains = (analysis, suggestions) => {
    const { totalDocsExamined, executionTimeMillis, isFullScan } = analysis;

    if (suggestions.length === 0) {
        return {
            expectedTimeReduction: 0,
            expectedDocsReduction: 0,
            confidence: 'Low',
            reason: 'No index suggestions were provided.'
        };
    }

    let expectedTimeReduction = 0;
    let expectedDocsReduction = 0;
    let confidence = 'Low';

    if (isFullScan) {
        expectedTimeReduction = totalDocsExamined > 1000 ? 90 : 70;
        expectedDocsReduction = totalDocsExamined > 100 ? 95 : 80;
        confidence = totalDocsExamined > 1000 ? 'High' : 'Medium';
    } else if (totalDocsExamined > 100) {
        expectedTimeReduction = 50;
        expectedDocsReduction = 60;
        confidence = 'Medium';
    } else {
        expectedTimeReduction = 10;
        expectedDocsReduction = 20;
        confidence = 'Medium';
    }

    return {
        expectedTimeReduction,
        expectedDocsReduction,
        confidence,
        reason: isFullScan ? 'Converting from Full Collection Scan (COLLSCAN) to Index Scan (IXSCAN) will significantly improve performance.' : 'Reducing document examination and improving index coverage.'
    };
};

module.exports = { estimatePerformanceGains };
