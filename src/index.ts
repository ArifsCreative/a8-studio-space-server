
import express from "express";
import cors from "cors";
import "dotenv/config";
import { connectDB, disconnectDB, getDB } from "./config/db.js";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

// Root API
app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "StudioSpace API is running",
  });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "StudioSpace API",
  });
});

// Temporary MongoDB studios collection test
app.get("/api/studios/test", async (_req, res) => {
  try {
    const db = getDB();

    const count = await db
      .collection("studios")
      .countDocuments();

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


 // api/studios/featured
 // Return up to 6 featured studios from MongoDB

app.get("/api/studios/featured", async (_req, res) => {
  try {
    const db = getDB();

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


// Start Express only after MongoDB connects
async function startServer() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `StudioSpace API running at http://localhost:${PORT}`
      );
    });

    const shutdown = async () => {
      console.log("Shutting down StudioSpace API...");

      server.close(async () => {
        await disconnectDB();
        process.exit(0);
      });
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  } catch (error) {
    console.error("Failed to start StudioSpace API:", error);
    process.exitCode = 1;
  }
}

void startServer();
