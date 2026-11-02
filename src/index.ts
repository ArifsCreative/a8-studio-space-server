
import "dotenv/config";
import app from "./app.js";
import { connectDB, disconnectDB } from "./config/db.js";

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    // Connect to MongoDB before starting the local server
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(
        `StudioSpace API running at http://localhost:${PORT}`
      );
    });

    const shutdown = () => {
      console.log("Shutting down StudioSpace API...");

      server.close(async () => {
        try {
          await disconnectDB();
          console.log("MongoDB disconnected");
          process.exit(0);
        } catch (error) {
          console.error("Shutdown failed:", error);
          process.exit(1);
        }
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
