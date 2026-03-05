import 'dotenv/config';
import { MongoClient } from "mongodb";
import { Database } from "../database";

const mongoUri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'bot-base';

if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
}

const mongoClient = new MongoClient(mongoUri, {
    connectTimeoutMS: 60000,
    serverSelectionTimeoutMS: 60000,
    autoSelectFamily: false
});
export const sharedDatabase = new Database(mongoClient.db(dbName)); 