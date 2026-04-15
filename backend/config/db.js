const dns = require('dns');
const { MongoClient } = require('mongodb');

const FALLBACK_DNS_SERVERS = ['1.1.1.1', '8.8.8.8'];

const buildClient = (uri) => {
    return new MongoClient(uri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
    });
};

const formatConnectionError = (error) => {
    const message = (error?.message || '').toLowerCase();
    if (message.includes('econnrefused')) {
        return new Error('Could not connect to the database. Connection refused at this URI.');
    }
    if (message.includes('timeout')) {
        return new Error('Database connection timed out. Please check your network and if the database is running.');
    }
    return new Error(`Could not connect to the database: ${error.message}`);
};

const shouldRetryWithFallbackDns = (uri, error) => {
    if (!uri || !uri.startsWith('mongodb+srv://')) return false;
    const message = (error?.message || '').toLowerCase();
    return message.includes('querysrv') && message.includes('econnrefused');
};

const tryWithFallbackDns = async (uri) => {
    const originalServers = dns.getServers();
    dns.setServers(FALLBACK_DNS_SERVERS);
    try {
        const client = buildClient(uri);
        await client.connect();
        return client;
    } finally {
        dns.setServers(originalServers);
    }
};

const connectToUserDb = async (uri) => {
    try {
        const client = buildClient(uri);
        await client.connect();
        return client;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        if (shouldRetryWithFallbackDns(uri, error)) {
            console.warn('Retrying SRV lookup using public DNS resolvers (1.1.1.1 / 8.8.8.8).');
            try {
                return await tryWithFallbackDns(uri);
            } catch (fallbackError) {
                console.error('Fallback DNS retry failed:', fallbackError.message);
                throw formatConnectionError(fallbackError);
            }
        }

        throw formatConnectionError(error);
    }
};

module.exports = { connectToUserDb };
