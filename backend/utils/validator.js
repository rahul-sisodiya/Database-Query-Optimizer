

const validateQueryRequest = (body) => {
    const { mongoUri, database, collection, query, options } = body;

    if (!mongoUri || !database || !collection || !query) {
        const error = new Error('Missing required fields: mongoUri, database, collection, or query.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    if (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://')) {
        const error = new Error('Invalid MongoDB URI format.');
        error.code = 'INVALID_URI';
        throw error;
    }

    if (typeof query !== 'object' || query === null || Object.keys(query).length === 0) {
        const error = new Error('Query must be a non-empty JSON object.');
        error.code = 'INVALID_QUERY';
        throw error;
    }


    if (options && (typeof options !== 'object' || options === null)) {
        const error = new Error('Options must be a valid JSON object.');
        error.code = 'INVALID_OPTIONS';
        throw error;
    }

    const unsafeOperators = ['$where', '$function', '$accumulator'];
    
    const checkUnsafe = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        for (const key of Object.keys(obj)) {
            if (unsafeOperators.includes(key)) {
                const error = new Error(`Unsafe query detected. The use of ${key} is not permitted.`);
                error.code = 'UNSAFE_QUERY';
                throw error;
            }
            checkUnsafe(obj[key]);
        }
    };

    checkUnsafe(query);
    return true;
};

const validateIndexRequest = (body) => {
    const { mongoUri, database, collection, index } = body;

    if (!mongoUri || !database || !collection || !index) {
        const error = new Error('Missing required fields: mongoUri, database, collection, or index.');
        error.code = 'VALIDATION_ERROR';
        throw error;
    }

    if (typeof index !== 'object' || index === null || Object.keys(index).length === 0) {
        const error = new Error('Index must be a non-empty JSON object.');
        error.code = 'INVALID_INDEX';
        throw error;
    }

    return true;
};

module.exports = { validateQueryRequest, validateIndexRequest };
