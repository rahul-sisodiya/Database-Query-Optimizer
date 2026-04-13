const suggestIndexes = (query, options = {}) => {
    const { sort } = options;

    const queryFields = Object.keys(query);
    const sortFields = sort ? Object.keys(sort) : [];

    const equalityFields = [];
    const rangeFields = [];

    for (const field of queryFields) {
        const value = query[field];

        if (typeof value === 'object' && value !== null) {
            const keys = Object.keys(value);
            const rangeOperators = ['$gt', '$lt', '$gte', '$lte', '$ne'];

            if (keys.some(k => rangeOperators.includes(k))) {
                rangeFields.push(field);
            } else {
                equalityFields.push(field);
            }
        } else {
            equalityFields.push(field);
        }
    }

    const orderedFields = [
        ...equalityFields,
        ...sortFields,
        ...rangeFields
    ].filter(f => f !== '_id');

    const seen = new Set();
    const finalFields = orderedFields.filter(f => {
        if (seen.has(f)) return false;
        seen.add(f);
        return true;
    });

    if (finalFields.length === 0) return [];

    const indexObj = {};

    finalFields.forEach(field => {
        if (sort && sort[field]) {
            indexObj[field] = sort[field]; // respect sort direction
        } else {
            indexObj[field] = 1;
        }
    });

    const type = finalFields.length > 1 ? 'Compound' : 'Single-Field';

    return [{
        index: indexObj,
        type,
        fields: finalFields,
        reason: `Optimized using ESR rule (Equality → Sort → Range) for fields: ${finalFields.join(', ')}`
    }];
};

module.exports = { suggestIndexes };