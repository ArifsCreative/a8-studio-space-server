
import type { Request, Response, NextFunction } from "express";
import {
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
} from "jose";

const authBaseURL =
  process.env.BETTER_AUTH_URL || "http://localhost:5000";

const jwksURL = new URL(
  "/api/auth/jwks",
  authBaseURL
);

// Cache the remote public key set for efficient verification.
const JWKS = createRemoteJWKSet(jwksURL);

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: string;
        payload: JWTPayload;
      };
    }
  }
}

export async function verifyJWT(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authorization = req.headers.authorization;

    if (!authorization?.startsWith("Bearer ")) {
      res.status(401).json({
        success: false,
        message: "Authentication required. Please provide a JWT.",
      });
      return;
    }

    const token = authorization.slice(7).trim();

    if (!token) {
      res.status(401).json({
        success: false,
        message: "JWT token is missing.",
      });
      return;
    }

    const { payload } = await jwtVerify(token, JWKS, {
      issuer: authBaseURL,
      audience: authBaseURL,
      algorithms: ["EdDSA"],
    });

    if (!payload.sub) {
      res.status(401).json({
        success: false,
        message: "Invalid authentication token.",
      });
      return;
    }

    req.authUser = {
      id: payload.sub,
      payload,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error);

    res.status(401).json({
      success: false,
      message: "Invalid or expired authentication token.",
    });
  }
}
