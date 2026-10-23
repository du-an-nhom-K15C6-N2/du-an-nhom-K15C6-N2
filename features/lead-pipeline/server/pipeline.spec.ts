import assert from "node:assert/strict";
import { test } from "node:test";
import { createDatabase } from "./database.js";
import { getBoard, getLeadHistory, PipelineError, updateLeadStatus } from "./pipeline.js";

function withDatabase(run: (db: ReturnType<typeof createDatabase>) => void): void {
  const db = createDatabase(":memory:");
  try {
    run(db);
  } finally {
    db.close();
  }
}

test("board returns every pipeline column and its count", () => {
  withDatabase((db) => {
    const board = getBoard(db);
    assert.deepEqual(board.statuses, ["Mới", "Đã liên hệ", "Đang tư vấn", "Hẹn học thử", "Chốt", "Từ chối"]);
    assert.equal(board.counts["Mới"], 2);
    assert.equal(board.counts["Chốt"], 1);
    assert.equal(board.counts["Từ chối"], 1);
  });
});

test("status changes update the lead and record actor, time, and previous state", () => {
  withDatabase((db) => {
    const history = updateLeadStatus(db, 1, { status: "Đã liên hệ", changedBy: "Nguyễn An" });
    assert.equal(history.fromStatus, "Mới");
    assert.equal(history.toStatus, "Đã liên hệ");
    assert.equal(history.changedBy, "Nguyễn An");
    assert.ok(Number.isFinite(Date.parse(history.changedAt)));
    assert.equal(getBoard(db).counts["Mới"], 1);
    assert.equal(getLeadHistory(db, 1)[0]?.id, history.id);
  });
});

test("rejecting a lead requires an allowed reason", () => {
  withDatabase((db) => {
    assert.throws(
      () => updateLeadStatus(db, 1, { status: "Từ chối", changedBy: "Nguyễn An" }),
      (error: unknown) => error instanceof PipelineError && error.statusCode === 400,
    );
    assert.throws(
      () => updateLeadStatus(db, 1, { status: "Từ chối", reason: "Lý do ngoài danh sách", changedBy: "Nguyễn An" }),
      (error: unknown) => error instanceof PipelineError && error.statusCode === 400,
    );

    const history = updateLeadStatus(db, 1, {
      status: "Từ chối",
      reason: "Học phí",
      changedBy: "Nguyễn An",
    });
    assert.equal(history.reason, "Học phí");
    assert.equal(getLeadHistory(db, 1)[0]?.reason, "Học phí");
  });
});

test("missing leads and unchanged transitions are rejected", () => {
  withDatabase((db) => {
    assert.throws(
      () => updateLeadStatus(db, 999, { status: "Đã liên hệ", changedBy: "Nguyễn An" }),
      (error: unknown) => error instanceof PipelineError && error.statusCode === 404,
    );
    assert.throws(
      () => updateLeadStatus(db, 1, { status: "Mới", changedBy: "Nguyễn An" }),
      (error: unknown) => error instanceof PipelineError && error.statusCode === 409,
    );
  });
});
