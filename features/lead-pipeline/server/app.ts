import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import type { Database } from "better-sqlite3";
import { getBoard, getLeadHistory, PipelineError, updateLeadStatus } from "./pipeline.js";

export function createApp(
  db: Database,
  allowedOrigin = process.env.APP_ORIGIN ?? "http://localhost:8080",
  actorName = process.env.DEFAULT_ACTOR_NAME?.trim() || "Tư vấn viên",
) {
  const app = express();

  app.use(cors({ origin: allowedOrigin }));
  app.use(express.json({ limit: "32kb" }));

  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok" });
  });

  app.get("/api/leads", (_request, response) => {
    response.json(getBoard(db));
  });

  app.get("/api/leads/:id/history", (request, response, next) => {
    try {
      response.json(getLeadHistory(db, Number(request.params.id)));
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/leads/:id/status", (request, response, next) => {
    try {
      const history = updateLeadStatus(db, Number(request.params.id), {
        status: request.body?.status,
        reason: request.body?.reason,
        changedBy: actorName,
      });
      response.json({ history, board: getBoard(db) });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof PipelineError) {
      response.status(error.statusCode).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError) {
      response.status(400).json({ error: "Dữ liệu yêu cầu không hợp lệ." });
      return;
    }
    console.error(error);
    response.status(500).json({ error: "Đã xảy ra lỗi máy chủ." });
  });

  return app;
}
