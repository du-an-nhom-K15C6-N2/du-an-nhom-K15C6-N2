import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAuthRouter } from "./routes/auth.js";
import { createManagementRouter } from "./routes/management.js";
import { createLeadRouter } from "./routes/leads.js";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const featureRoot = path.resolve(workspaceRoot, "features", "features");

export function createApp({ pool, authenticate, jwtSecret }) {
  const app = express();

  app.use(express.json({ limit: "32kb" }));
  app.get("/api/health", async (_req, res) => {
    try {
      await pool.query("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch (error) {
      console.error("Database health check failed:", error);
      res.status(503).json({ status: "error", database: "unavailable" });
    }
  });
  app.use("/api/auth", createAuthRouter({ pool, jwtSecret }));
  app.use("/api/leads", authenticate, createLeadRouter(pool));
  app.use("/api", authenticate, createManagementRouter({ pool }));

  app.use((error, _req, res, _next) => {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }

    console.error("Unhandled API error:", error);
    if (error.code === "23505") {
      return res.status(409).json({ message: "Số điện thoại này đã được sử dụng cho một lead khác." });
    }
    return res.status(500).json({ message: "Đã xảy ra lỗi máy chủ." });
  });

  app.use("/features/02-lead-assignment-api", express.static(path.join(featureRoot, "02-lead-assignment-api")));
  app.use("/features/03-lead-transfer-history", express.static(path.join(featureRoot, "03-lead-transfer-history")));
  app.use("/features/06-lead-list-by-permission-ui", express.static(path.join(featureRoot, "06-lead-list-by-permission-ui")));
  app.use("/features/07-lead-history-detail-ui", express.static(path.join(featureRoot, "07-lead-history-detail-ui")));
  app.get("/", (_req, res) => res.sendFile(path.join(workspaceRoot, "index.html")));
  app.use(express.static(path.join(workspaceRoot, "public")));

  return app;
}
