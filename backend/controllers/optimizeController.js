const { connectToUserDb } = require('../config/db');
const { validateQueryRequest, validateIndexRequest } = require('../utils/validator');
const { analyzeQueryExecution } = require('../services/analyzer');
const { suggestIndexes } = require('../services/indexSuggester');
const { estimatePerformanceGains } = require('../services/estimator');
const { calculateQueryScore } = require('../services/costModel');
const { simulateIndexImpact } = require('../services/indexSimulator');

const assertCollectionExists = async (db, collectionName) => {
    const collectionInfo = await db.listCollections(
        { name: collectionName },
        { nameOnly: true }
    ).toArray();

    if (collectionInfo.length === 0) {
        const err = new Error(`Collection '${collectionName}' does not exist in database '${db.databaseName}'.`);
        err.code = 'COLLECTION_NOT_FOUND';
        throw err;
    }
};

// --- Helper: Structured Response Wrapper ---
const sendResponse = (res, status, data, meta = {}) => {
    const response = {
        status: status === 200 ? 'success' : 'error',
        data,
        meta: {
            timestamp: new Date().toISOString(),
            requestId: Math.random().toString(36).substring(2, 10),
            ...meta
        }
    };
    return res.status(status).json(response);
};

// --- Helper: Error Categorization ---
const handleControllerError = (error, res, action, requestId) => {
    console.error(`[${action}] Request ${requestId} failed:`, error.message);
    
    let statusCode = 400;
    let errorCode = 'INTERNAL_ERROR';

    if (error.code) {
        errorCode = error.code; // Validation or logic errors with custom codes
    } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        statusCode = 503;
        errorCode = 'DATABASE_CONNECTION_ERROR';
    }

    return sendResponse(res, statusCode, {
        message: error.message || 'An unexpected error occurred.',
        code: errorCode
    }, { requestId });
};

// --- Helper: Simulation Guard ---
const shouldRunSimulation = async (db, collection, collectionName, suggestions) => {
    if (process.env.ALLOW_SIMULATION === 'false') return { run: false, reason: 'Simulation disabled by configuration.' };
    if (!suggestions || suggestions.length === 0) return { run: false, reason: 'No suggestions provided.' };

    try {
        const collectionInfo = await db.listCollections(
            { name: collectionName },
            { nameOnly: true }
        ).toArray();
        if (collectionInfo.length === 0) {
            return { run: false, reason: `Collection '${collectionName}' does not exist.`, count: 0 };
        }

        const count = await collection.countDocuments({}, { maxTimeMS: 1500 });
        if (count === 0) return { run: false, reason: 'Simulation skipped for an empty collection.', count };
        if (count > 50000) return { run: false, reason: `Collection too large (${count} docs). Limit is 50,000.`, count };
        return { run: true, count };
    } catch (err) {
        console.warn('Could not count documents for simulation guard:', err.message);
        return { run: false, reason: 'Count operation timed out.', count: 0 };
    }
};

/**
 * Main Endpoint for Query Optimization Analysis.
 */
const optimizeQuery = async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    const startTime = Date.now();
    let client;

    try {
        const body = req.body;
        validateQueryRequest(body);

        const { mongoUri, database, collection: collectionName, query, options, previousStats } = body;

        client = await connectToUserDb(mongoUri);
        const db = client.db(database);
        const collection = db.collection(collectionName);
        await assertCollectionExists(db, collectionName);

        // 1. Core Analysis & Scoring
        const analysis = await analyzeQueryExecution(db, collectionName, query, options || {});
        const suggestions = suggestIndexes(query, options || {});
        const cost = calculateQueryScore(analysis);
        const estimation = estimatePerformanceGains(analysis, suggestions);

        // 2. Controlled Simulation
        const simGuard = await shouldRunSimulation(db, collection, collectionName, suggestions);
        let simulation = null;
        if (simGuard.run) {
            simulation = await simulateIndexImpact(
                db, 
                collectionName, 
                query, 
                options || {}, 
                suggestions[0].index, 
                analysis,
                {
                    allowInProd: process.env.NODE_ENV !== 'production'
                }
            );
        }

        // 3. Sample Data (Simplified)
        const results = await collection
            .find(query, {
                ...options
            })
            .maxTimeMS(10000)
            .toArray();
        // 4. History Comparison
        const comparison = (previousStats && typeof previousStats.executionTimeMillis === 'number') ? {
            timeDiff: analysis.executionTimeMillis - previousStats.executionTimeMillis,
            docsDiff: analysis.totalDocsExamined - previousStats.totalDocsExamined
        } : null;

        return sendResponse(res, 200, {
            analysis,
            suggestions,
            cost,
            estimation,
            simulation,
            results,
            resultsCount: results.length,
            comparison,
            totalCollectionDocs: simGuard.count || 0,
            simulationNote: simGuard.run ? null : simGuard.reason
        }, { 
            requestId, 
            responseTimeMs: Date.now() - startTime 
        });

    } catch (error) {
        return handleControllerError(error, res, 'optimizeQuery', requestId);
    } finally {
        if (client) await client.close();
    }
};

/**
 * Endpoint for Index Creation.
 */
const createIndex = async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    let client;

    try {
        validateIndexRequest(req.body);
        const { mongoUri, database, collection: collectionName, index } = req.body;

        client = await connectToUserDb(mongoUri);
        const db = client.db(database);
        await assertCollectionExists(db, collectionName);
        const result = await db.collection(collectionName).createIndex(index);

        return sendResponse(res, 200, {
            message: `Index created successfully: ${result}`,
            indexName: result
        }, { requestId });

    } catch (error) {
        return handleControllerError(error, res, 'createIndex', requestId);
    } finally {
        if (client) await client.close();
    }
};


const resetIndexes = async (req, res) => {
    const requestId = Math.random().toString(36).substring(2, 10);
    let client;

    try {
        const { mongoUri, database, collection: collectionName } = req.body;
        if (!mongoUri || !database || !collectionName) {
            const err = new Error('Missing connection parameters.');
            err.code = 'VALIDATION_ERROR';
            throw err;
        }

        client = await connectToUserDb(mongoUri);
        const db = client.db(database);
        await assertCollectionExists(db, collectionName);
        await db.collection(collectionName).dropIndexes();

        return sendResponse(res, 200, {
            message: `All indexes for collection '${collectionName}' (except _id) dropped.`
        }, { requestId });

    } catch (error) {
        return handleControllerError(error, res, 'resetIndexes', requestId);
    } finally {
        if (client) await client.close();
    }
};

module.exports = { optimizeQuery, resetIndexes, createIndex };
