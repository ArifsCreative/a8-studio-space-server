
import type { Request, Response } from "express";
import app from "../src/app.js";
import {
  connectDB,
  ensureBookingIndexes,
} from "../src/config/db.js";

let initializationPromise: Promise<void> | null = null;

async function initializeDatabase(): Promise<void> {
  if (!initializationPromise) {
    initializationPromise = (async () => {
      await connectDB();
      await ensureBookingIndexes();

      console.log(
        "Vercel: MongoDB connected and booking indexes initialized."
      );
    })().catch((error) => {
      initializationPromise = null;
      throw error;
    });
  }

  await initializationPromise;
}

export default async function handler(
  req: Request,
  res: Response
) {
  try {
    await initializeDatabase();

    return app(req, res);
  } catch (error) {
    console.error("Vercel database initialization failed:", error);

    return res.status(503).json({
      success: false,
      message: "Database initialization failed.",
    });
  }
}
