const suggestIndexes = (query, options) => {
    const { sort } = options || {};
    const queryFields = Object.keys(query);
    const sortFields = sort ? Object.keys(sort) : [];

    const suggestions = [];

    const equalityFields = [];
    const rangeFields = [];

    for (const field of queryFields) {
        const value = query[field];
        if (typeof value === 'object' && value !== null) {
            const keys = Object.keys(value);
            const rangeOperators = ['$gt', '$lt', '$gte', '$lte', '$ne', '$in'];
            if (keys.some(k => rangeOperators.includes(k))) {
                rangeFields.push(field);
            } else {
                equalityFields.push(field);
            }
        } else {
            equalityFields.push(field);
        }
    }

    const suggestedIndexFields = [...equalityFields, ...sortFields, ...rangeFields];
    const uniqueFields = Array.from(new Set(suggestedIndexFields));

    if (uniqueFields.length > 0) {
        const indexObj = {};
        uniqueFields.forEach(f => {
            indexObj[f] = 1;
        });

        suggestions.push({
            index: indexObj,
            type: uniqueFields.length > 1 ? 'Compound' : 'Single-Field',
            fields: uniqueFields,
            reason: `Optimizes filtering and sorting for ${uniqueFields.join(', ')}.`
        });
    }

    return suggestions;
};

module.exports = { suggestIndexes };
