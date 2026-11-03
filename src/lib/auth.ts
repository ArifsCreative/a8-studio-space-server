
import "dotenv/config";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { jwt } from "better-auth/plugins";
import { getDB } from "../config/db.js";

export function createAuth() {
  const secret = process.env.BETTER_AUTH_SECRET;
  const baseURL =
    process.env.BETTER_AUTH_URL || "http://localhost:5000";

  if (!secret || secret === "your_better_auth_secret") {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or not configured"
    );
  }

  return betterAuth({
    database: mongodbAdapter(getDB()),
    secret,
    baseURL,
    basePath: "/api/auth",
    trustedOrigins: [
      process.env.CLIENT_URL || "http://localhost:3000",
    ],
    emailAndPassword: {
      enabled: true,
    },
    plugins: [jwt()],
  });
}
