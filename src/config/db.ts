
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "studiospace";

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connectDB(): Promise<Db> {
  if (database) {
    return database;
  }

  if (!uri || uri === "your_mongodb_atlas_connection_string") {
    throw new Error("MONGODB_URI is missing or not configured");
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
  });

  try {
    await client.connect();

    database = client.db(dbName);

    await database.command({ ping: 1 });

    console.log(`MongoDB connected successfully: ${dbName}`);

    return database;
  } catch (error) {
    await client.close();
    client = null;
    database = null;
    throw error;
  }
}

export function getDB(): Db {
  if (!database) {
    throw new Error("MongoDB is not connected");
  }

  return database;
}

export async function disconnectDB(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
  }
}
