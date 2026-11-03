
import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB, getDB } from "./config/db.js";
import { ObjectId } from "mongodb";
import { toNodeHandler } from "better-auth/node";
import { createAuth } from "./lib/auth.js";

const app = express();

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);


// BetterAuth authentication endpoints.
// Initialize after MongoDB is connected, on the first auth request.
let authHandler:
  | ReturnType<typeof toNodeHandler>
  | undefined;

app.all("/api/auth/*splat", async (req, res, next) => {
  try {
    if (!authHandler) {
      await connectDB();
      authHandler = toNodeHandler(createAuth());
    }

    return authHandler(req, res);
  } catch (error) {
    console.error("BetterAuth request failed:", error);
    next(error);
  }
});

app.use(express.json());


// Root endpoint
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "StudioSpace API is running",
  });
});

// Health check
app.get("/api/health", async (_req, res) => {
  try {
    const db = await connectDB();
    await db.command({ ping: 1 });

    res.status(200).json({
      success: true,
      status: "healthy",
      service: "StudioSpace API",
    });
  } catch (error) {
    console.error("Health check failed:", error);

    res.status(503).json({
      success: false,
      status: "unhealthy",
    });
  }
});

// Featured studios
app.get("/api/studios/featured", async (_req, res) => {
  try {
    const db = await connectDB();

    const studios = await db
      .collection("studios")
      .find({ isFeatured: true })
      .limit(6)
      .toArray();

    res.status(200).json({
      success: true,
      count: studios.length,
      data: studios,
    });
  } catch (error) {
    console.error("Failed to fetch featured studios:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch featured studios",
    });
  }
});


/**
 * GET /api/studios and /api/studios?category=Photo%20Studios
 * Returns all studios, optionally filtered by category.
 *
 * /api/studios
 * /api/studios?category=Photo%20Studios
 */
app.get("/api/studios", async (req, res) => {
  try {
    const db = await connectDB();

    const category =
      typeof req.query.category === "string"
        ? req.query.category.trim()
        : "";

    const filter = category ? { category } : {};

    const studios = await db
      .collection("studios")
      .find(filter)
      .sort({ _id: -1 })
      .toArray();

    res.status(200).json({
      success: true,
      count: studios.length,
      data: studios,
    });
  } catch (error) {
    console.error("Failed to fetch studios:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch studios",
    });
  }
});


/**
 * GET /api/studios/:id
 * Returns one studio by its MongoDB ObjectId.
 */
app.get("/api/studios/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || !ObjectId.isValid(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid studio ID",
      });
      return;
    }

    const db = await connectDB();

    const studio = await db.collection("studios").findOne({
      _id: new ObjectId(id),
    });

    if (!studio) {
      res.status(404).json({
        success: false,
        message: "Studio not found",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: studio,
    });
  } catch (error) {
    console.error("Failed to fetch studio details:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch studio details",
    });
  }
});

//Get /api/studios/test.
// Temporary studios collection diagnostic
app.get("/api/studios/test", async (_req, res) => {
  try {
    const db = await connectDB();

    const count = await db.collection("studios").countDocuments();

    res.status(200).json({
      success: true,
      database: db.databaseName,
      collection: "studios",
      totalStudios: count,
    });
  } catch (error) {
    console.error("Studio collection test failed:", error);

    res.status(500).json({
      success: false,
      message: "Failed to access studios collection",
    });
  }
});

export default app;
