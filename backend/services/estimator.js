const estimatePerformanceGains = (analysis, suggestions) => {
    const {
        totalDocsExamined = 0,
        nReturned = 1,
        isFullScan,
        isBadIndexUsage,
        isLowSelectivity
    } = analysis;

    if (!suggestions || suggestions.length === 0) {
        return {
            expectedTimeReduction: 0,
            expectedDocsReduction: 0,
            confidence: 'Low',
            reason: 'No optimization suggestions available.'
        };
    }

    let expectedTimeReduction = 0;
    let expectedDocsReduction = 0;
    let confidence = 'Medium';

    const ratio = nReturned > 0 ? totalDocsExamined / nReturned : totalDocsExamined;
    const badIndexUsage = typeof isBadIndexUsage === 'boolean' ? isBadIndexUsage : ratio > 5;
    const lowSelectivity = typeof isLowSelectivity === 'boolean' ? isLowSelectivity : ratio > 20;

    if (isFullScan) {
        expectedDocsReduction = Math.min(98, Math.log10(totalDocsExamined + 1) * 20);
        expectedTimeReduction = expectedDocsReduction * 0.9;
        confidence = totalDocsExamined > 1000 ? 'High' : 'Medium';
    } else if (badIndexUsage) {
        expectedDocsReduction = Math.min(80, Math.log2(ratio + 1) * 15);
        expectedTimeReduction = expectedDocsReduction * 0.8;
        confidence = ratio > 50 ? 'High' : 'Medium';
    } else if (lowSelectivity) {
        expectedDocsReduction = Math.min(50, Math.log2(ratio + 1) * 10);
        expectedTimeReduction = expectedDocsReduction * 0.7;
        confidence = ratio > 20 ? 'Medium' : 'Low';
    } else {
        expectedDocsReduction = 5;
        expectedTimeReduction = 5;
        confidence = 'Low';
    }

    return {
        expectedTimeReduction: Math.round(expectedTimeReduction),
        expectedDocsReduction: Math.round(expectedDocsReduction),
        confidence,
        reason: isFullScan
            ? 'Replacing COLLSCAN with indexed query will drastically reduce scanned documents.'
            : 'Improving index efficiency and selectivity will reduce scan overhead.'
    };
};

module.exports = { estimatePerformanceGains };
