
import { MongoClient, Db } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "studiospace";

let client: MongoClient | null = null;
let database: Db | null = null;
let connectionPromise: Promise<Db> | null = null;

export async function connectDB(): Promise<Db> {
  if (database) {
    return database;
  }

  // Reuse an ongoing connection attempt.
  if (connectionPromise) {
    return connectionPromise;
  }

  if (!uri || uri === "your_mongodb_atlas_connection_string") {
    throw new Error("MONGODB_URI is missing or not configured");
  }

  connectionPromise = (async () => {
    const mongoClient = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
      maxPoolSize: 10,
      minPoolSize: 0,
      maxIdleTimeMS: 60000,
    });

    client = mongoClient;

    try {
      await mongoClient.connect();

      const db = mongoClient.db(dbName);

      await db.command({ ping: 1 });

      database = db;

      console.log(`MongoDB connected successfully: ${dbName}`);

      return db;
    } catch (error) {
      if (client === mongoClient) {
        client = null;
        database = null;
      }

      try {
        await mongoClient.close();
      } catch (closeError) {
        console.error("MongoDB cleanup failed:", closeError);
      }

      throw error;
    }
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

export function getDB(): Db {
  if (!database) {
    throw new Error("MongoDB is not connected");
  }

  return database;
}

export function getMongoClient(): MongoClient {
  if (!client || !database) {
    throw new Error("MongoDB client is not connected");
  }

  return client;
}

export async function disconnectDB(): Promise<void> {
  if (client) {
    const mongoClient = client;

    client = null;
    database = null;

    await mongoClient.close();

    console.log("MongoDB disconnected successfully.");
  }
}

/**
 * Creates indexes for efficient booking queries.
 * Safe to call multiple times.
 */
export async function ensureBookingIndexes(): Promise<void> {
  const db = await connectDB();

  const bookings = db.collection("bookings");

  await bookings.createIndexes([
    {
      key: {
        userId: 1,
        createdAt: -1,
      },
      name: "user_bookings_history",
    },
    {
      key: {
        studioId: 1,
        status: 1,
        startAt: 1,
      },
      name: "studio_active_bookings",
    },
    {
      key: {
        studioId: 1,
        startAt: 1,
        endAt: 1,
      },
      name: "studio_booking_overlap",
    },
  ]);

  console.log("Booking database indexes created successfully.");
}
