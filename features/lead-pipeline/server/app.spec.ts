import assert from "node:assert/strict";
import { test } from "node:test";
import type { Server } from "node:http";
import { createApp } from "./app.js";
import { createDatabase } from "./database.js";

test("lead board and status updates are available without login", async () => {
  const db = createDatabase(":memory:");
  const server: Server = createApp(db, "http://localhost:8080", "Tư vấn tuyển sinh").listen(0);

  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}`;

    const boardResponse = await fetch(`${baseUrl}/api/leads`);
    assert.equal(boardResponse.status, 200);
    const board = await boardResponse.json() as {
      counts: Record<string, number>;
      statuses: string[];
    };
    assert.deepEqual(board.statuses, ["Mới", "Đã liên hệ", "Đang tư vấn", "Hẹn học thử", "Chốt", "Từ chối"]);
    assert.equal(board.counts["Mới"], 2);

    const update = await fetch(`${baseUrl}/api/leads/1/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Đã liên hệ" }),
    });
    assert.equal(update.status, 200);
    const result = await update.json() as {
      history: { changedBy: string; fromStatus: string; toStatus: string };
      board: { counts: Record<string, number> };
    };
    assert.equal(result.history.fromStatus, "Mới");
    assert.equal(result.history.toStatus, "Đã liên hệ");
    assert.equal(result.history.changedBy, "Tư vấn tuyển sinh");
    assert.equal(result.board.counts["Mới"], 1);
    assert.equal(result.board.counts["Đã liên hệ"], 2);

    const historyResponse = await fetch(`${baseUrl}/api/leads/1/history`);
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json() as Array<{ changedBy: string }>;
    assert.equal(history[0]?.changedBy, "Tư vấn tuyển sinh");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
    db.close();
  }
});
