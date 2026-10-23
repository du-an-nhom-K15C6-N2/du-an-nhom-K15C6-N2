const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, describe, it } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-lead-pipeline-'));
const leadsFile = path.join(temporaryDirectory, 'leads.json');
process.env.CONSULTATION_LEADS_DATA_FILE = leadsFile;

const express = require('express');
const { LeadModel, LeadError, PIPELINE_STATUSES, REJECTION_REASONS } = require('../backend/models/leadModel');
const { createLeadRouter } = require('../backend/routes/leadRoutes');

function createApp(role = 'manager') {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', createLeadRouter({
    authenticate(req, res, next) {
      req.user = { id: 'test-user', name: 'Tư vấn tuyển sinh', role, roles: [role] };
      next();
    }
  }));
  return app;
}

async function withServer(app, callback) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.once('listening', resolve);
  });
  try {
    return await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve, reject) => server.close(error => (error ? reject(error) : resolve())));
  }
}

describe('[DNKN-172] Kiểm thử Phễu tư vấn (Lead Pipeline) & Lịch sử trạng thái', () => {
  beforeEach(() => {
    fs.writeFileSync(leadsFile, JSON.stringify([
      {
        id: '1',
        name: 'Nguyễn Minh Anh',
        phone: '0901234567',
        course: 'Tiếng Anh giao tiếp',
        source: 'Facebook',
        status: 'Mới',
        nextCallAt: new Date(Date.now() + 3600000).toISOString(),
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
        statusHistory: []
      },
      {
        id: '2',
        name: 'Trần Gia Bảo',
        phone: '0912345678',
        course: 'IELTS 6.5+',
        source: 'Website',
        status: 'Mới',
        nextCallAt: null,
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
        statusHistory: []
      },
      {
        id: '3',
        name: 'Lê Khánh Linh',
        phone: '0987654321',
        course: 'Tiếng Anh thiếu nhi',
        source: 'Hotline',
        status: 'Đã liên hệ',
        nextCallAt: null,
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
        statusHistory: []
      },
      {
        id: '4',
        name: 'Đặng Quốc An',
        phone: '0978123456',
        course: 'Tiếng Anh thiếu nhi',
        source: 'Website',
        status: 'Chốt',
        nextCallAt: null,
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
        statusHistory: []
      },
      {
        id: '5',
        name: 'Bùi Thảo Vy',
        phone: '0908765432',
        course: 'IELTS 6.5+',
        source: 'Facebook',
        status: 'Từ chối',
        nextCallAt: null,
        createdAt: '2026-01-01T08:00:00.000Z',
        updatedAt: '2026-01-01T08:00:00.000Z',
        statusHistory: []
      }
    ]));
  });

  after(() => {
    delete process.env.CONSULTATION_LEADS_DATA_FILE;
    try {
      fs.rmSync(temporaryDirectory, { recursive: true, force: true });
    } catch (_) {}
  });

  it('1. Bảng phễu trả về đầy đủ các cột trạng thái và số lượng lead tương ứng', () => {
    const board = LeadModel.getPipelineBoard();
    assert.deepEqual(board.statuses, ['Mới', 'Đã liên hệ', 'Đang tư vấn', 'Hẹn học thử', 'Chốt', 'Từ chối']);
    assert.equal(board.counts['Mới'], 2);
    assert.equal(board.counts['Đã liên hệ'], 1);
    assert.equal(board.counts['Chốt'], 1);
    assert.equal(board.counts['Từ chối'], 1);
    assert.equal(board.counts['Đang tư vấn'], 0);
    assert.equal(board.counts['Hẹn học thử'], 0);
  });

  it('2. Chuyển trạng thái cập nhật lead, ghi nhận người thực hiện, thời gian và trạng thái cũ', () => {
    const { history, board } = LeadModel.updateStatus('1', { status: 'Đã liên hệ', changedBy: 'Nguyễn An' });
    assert.equal(history.fromStatus, 'Mới');
    assert.equal(history.toStatus, 'Đã liên hệ');
    assert.equal(history.changedBy, 'Nguyễn An');
    assert.ok(Number.isFinite(Date.parse(history.changedAt)));
    assert.equal(board.counts['Mới'], 1);
    assert.equal(board.counts['Đã liên hệ'], 2);

    const leadHistory = LeadModel.getLeadHistory('1');
    assert.equal(leadHistory.length, 1);
    assert.equal(leadHistory[0].toStatus, 'Đã liên hệ');
    assert.equal(leadHistory[0].changedBy, 'Nguyễn An');
  });

  it('3. Trạng thái Từ chối bắt buộc phải có lý do hợp lệ trong danh mục', () => {
    assert.throws(
      () => LeadModel.updateStatus('1', { status: 'Từ chối', changedBy: 'Nguyễn An' }),
      (err) => err instanceof LeadError && err.status === 400 && err.code === 'INVALID_REJECTION_REASON'
    );

    assert.throws(
      () => LeadModel.updateStatus('1', { status: 'Từ chối', reason: 'Lý do ngoài danh mục', changedBy: 'Nguyễn An' }),
      (err) => err instanceof LeadError && err.status === 400 && err.code === 'INVALID_REJECTION_REASON'
    );

    const { history } = LeadModel.updateStatus('1', {
      status: 'Từ chối',
      reason: 'Học phí',
      changedBy: 'Nguyễn An'
    });
    assert.equal(history.reason, 'Học phí');
    assert.equal(LeadModel.getLeadHistory('1')[0].reason, 'Học phí');
  });

  it('4. Không cho phép gửi lý do từ chối nếu chuyển sang trạng thái khác Từ chối', () => {
    assert.throws(
      () => LeadModel.updateStatus('1', { status: 'Đang tư vấn', reason: 'Học phí', changedBy: 'Nguyễn An' }),
      (err) => err instanceof LeadError && err.status === 400 && err.code === 'UNEXPECTED_REASON'
    );
  });

  it('5. Từ chối khi không tìm thấy lead (404) hoặc trạng thái không đổi (409)', () => {
    assert.throws(
      () => LeadModel.updateStatus('9999', { status: 'Đã liên hệ', changedBy: 'Nguyễn An' }),
      (err) => err instanceof LeadError && err.status === 404 && err.code === 'LEAD_NOT_FOUND'
    );

    assert.throws(
      () => LeadModel.updateStatus('1', { status: 'Mới', changedBy: 'Nguyễn An' }),
      (err) => err instanceof LeadError && err.status === 409 && err.code === 'STATUS_UNCHANGED'
    );
  });

  it('6. API REST: GET /api/leads/board và PATCH /api/leads/:id/status và GET /api/leads/:id/history', async () => {
    const app = createApp('manager');
    await withServer(app, async (origin) => {
      // 1. Lấy bảng phễu
      const boardRes = await fetch(`${origin}/api/leads/board`);
      assert.equal(boardRes.status, 200);
      const board = await boardRes.json();
      assert.equal(board.counts['Mới'], 2);

      // 2. Cập nhật trạng thái
      const updateRes = await fetch(`${origin}/api/leads/1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Đang tư vấn' })
      });
      assert.equal(updateRes.status, 200);
      const updateData = await updateRes.json();
      assert.equal(updateData.history.fromStatus, 'Mới');
      assert.equal(updateData.history.toStatus, 'Đang tư vấn');
      assert.equal(updateData.history.changedBy, 'Tư vấn tuyển sinh');
      assert.equal(updateData.board.counts['Đang tư vấn'], 1);

      // 3. Lấy lịch sử trạng thái
      const historyRes = await fetch(`${origin}/api/leads/1/history`);
      assert.equal(historyRes.status, 200);
      const history = await historyRes.json();
      assert.equal(history.length, 1);
      assert.equal(history[0].toStatus, 'Đang tư vấn');
    });
  });

  it('7. Phân quyền: Học viên không có quyền đọc/cập nhật phễu lead (403)', async () => {
    const app = createApp('student');
    await withServer(app, async (origin) => {
      const boardRes = await fetch(`${origin}/api/leads/board`);
      assert.equal(boardRes.status, 403);

      const updateRes = await fetch(`${origin}/api/leads/1/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Đang tư vấn' })
      });
      assert.equal(updateRes.status, 403);
    });
  });
});
