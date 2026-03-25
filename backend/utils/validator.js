const validateQueryRequest = (body) => {
    const { mongoUri, database, collection, query } = body;

    if (!mongoUri || !database || !collection || !query) {
        throw new Error('Missing required fields: mongoUri, database, collection, or query.');
    }

    if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
        throw new Error('Invalid MongoDB URI format.');
    }

    const unsafeOperators = ['$where', '$function', '$accumulator'];
    const queryStr = JSON.stringify(query);

    for (const op of unsafeOperators) {
        if (queryStr.includes(op)) {
            throw new Error(`Unsafe query detected. The use of ${op} is not permitted.`);
        }
    }

    if (typeof query !== 'object' || query === null) {
        throw new Error('Query must be a valid JSON object.');
    }

    return true;
};

module.exports = { validateQueryRequest };
