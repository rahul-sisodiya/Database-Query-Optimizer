const { MongoClient } = require('mongodb');

const connectToUserDb = async (uri) => {
    try {
        const client = new MongoClient(uri, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        await client.connect();
        return client;
    } catch (error) {
        console.error('Database connection failed:', error.message);
        if (error.message.includes('ECONNREFUSED')) {
            throw new Error('Could not connect to the database. Connection refused at this URI.');
        } else if (error.message.includes('timeout')) {
            throw new Error('Database connection timed out. Please check your network and if the database is running.');
        }
        throw new Error(`Could not connect to the database: ${error.message}`);
    }
};

module.exports = { connectToUserDb };
