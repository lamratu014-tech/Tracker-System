import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Trust the platform proxy (Render, Replit, etc.) so req.ip, rate limiting,
// and X-Forwarded-* headers behave correctly. "1" trusts a single hop in
// front of the app, which matches Render's load balancer.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for sensitive unauthenticated auth endpoints.
// These limits are per-IP and apply before any route logic runs.

// Invite token lookup: 20 requests per 15 minutes per IP.
// This is the primary oracle for invite brute-force; keep it tight.
const inviteLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Invite acceptance and password reset/forgot: 10 attempts per 15 minutes per IP.
const authActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Login: 20 attempts per 15 minutes per IP (slightly looser to handle fat-finger errors).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts, please try again later." },
});

app.use("/api/auth/invite", inviteLookupLimiter);
app.use("/api/auth/accept-invite", authActionLimiter);
app.use("/api/auth/forgot-password", authActionLimiter);
app.use("/api/auth/reset-password", authActionLimiter);
app.use("/api/auth/login", loginLimiter);

app.use("/api", router);

export default app;
