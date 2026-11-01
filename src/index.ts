
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();

const PORT = Number(process.env.PORT) || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    success: true,
    message: "StudioSpace API is running",
  });
});

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    status: "healthy",
    service: "StudioSpace API",
  });
});

app.listen(PORT, () => {
  console.log(`StudioSpace API running at http://localhost:${PORT}`);
});
