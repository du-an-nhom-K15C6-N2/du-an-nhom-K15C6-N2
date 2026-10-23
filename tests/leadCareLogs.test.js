const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, describe, it, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-lead-care-'));
const leadsFile = path.join(temporaryDirectory, 'leads.json');
process.env.CONSULTATION_LEADS_DATA_FILE = leadsFile;

const express = require('express');
const { LeadModel, LeadError } = require('../backend/models/leadModel');
const { createLeadRouter } = require('../backend/routes/leadRoutes');

function createApp(role = 'manager') {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', createLeadRouter({
    authenticate(req, res, next) {
      req.user = { id: 'test-qa-user', role, roles: [role] };
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

describe('[QA - DNKN-173] Kiểm thử ghi nhật ký chăm sóc và đặt lịch nhắc gọi lại lead', () => {
  beforeEach(() => {
    fs.writeFileSync(leadsFile, JSON.stringify([
      {
        id: 'lead-test-01',
        name: 'Trần Văn An',
        phone: '0912345678',
        email: 'an.tran@example.com',
        source: 'Website',
        program: 'Tiếng Anh Giao Tiếp',
        status: 'Đang tư vấn',
        createdAt: '2026-01-01T08:00:00.000Z',
        careLogs: []
      },
      {
        id: 'lead-test-02',
        name: 'Nguyễn Thị Bích',
        phone: '0987654321',
        email: 'bich.nguyen@example.com',
        source: 'Facebook',
        program: 'Lập trình Web',
        status: 'Mới',
        createdAt: '2026-01-02T08:00:00.000Z',
        careLogs: [],
        reminderAt: '2026-01-01T10:00:00.000Z', // Quá khứ -> Phải được đánh dấu Quá hạn
        reminderCompleted: false
      }
    ]));
  });

  after(() => {
    delete process.env.CONSULTATION_LEADS_DATA_FILE;
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  test('1. Ghi nhật ký chăm sóc thành công với đầy đủ loại tương tác (Gọi, Nhắn, Gặp)', async () => {
    await withServer(createApp(), async origin => {
      // 1.1 Loại Gọi điện
      const resCall = await fetch(`${origin}/api/leads/lead-test-01/care-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'Gọi điện',
          content: 'Đã gọi tư vấn lộ trình học phí 3 tháng, phụ huynh đồng ý trao đổi thêm.',
          timestamp: '2026-03-01T09:30:00.000Z'
        })
      });
      assert.equal(resCall.status, 201);
      const dataCall = (await resCall.json()).data;
      assert.equal(dataCall.log.type, 'Gọi điện');
      assert.equal(dataCall.log.content, 'Đã gọi tư vấn lộ trình học phí 3 tháng, phụ huynh đồng ý trao đổi thêm.');

      // 1.2 Loại Nhắn tin
      const resMsg = await fetch(`${origin}/api/leads/lead-test-01/care-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'Nhắn tin',
          content: 'Đã gửi tài liệu qua Zalo và email cho phụ huynh.',
          timestamp: '2026-03-01T10:00:00.000Z'
        })
      });
      assert.equal(resMsg.status, 201);
      const dataMsg = (await resMsg.json()).data;
      assert.equal(dataMsg.log.type, 'Nhắn tin');

      // 1.3 Loại Gặp mặt (Hỗ trợ alias 'meeting')
      const resMeeting = await fetch(`${origin}/api/leads/lead-test-01/care-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'meeting',
          content: 'Phụ huynh đã đến trung tâm tham quan lớp học.',
          timestamp: '2026-03-02T15:00:00.000Z'
        })
      });
      assert.equal(resMeeting.status, 201);
      const dataMeeting = (await resMeeting.json()).data;
      assert.equal(dataMeeting.log.type, 'Gặp mặt');

      // 1.4 Kiểm tra API lấy lịch sử trả về đúng thứ tự mới nhất lên đầu
      const resList = await fetch(`${origin}/api/leads/lead-test-01/care-logs`);
      assert.equal(resList.status, 200);
      const listData = (await resList.json()).data;
      assert.equal(listData.length, 3);
      assert.equal(listData[0].type, 'Gặp mặt'); // 2026-03-02 mới nhất
      assert.equal(listData[1].type, 'Nhắn tin');
      assert.equal(listData[2].type, 'Gọi điện');
    });
  });

  test('2. Đặt lịch nhắc gọi lại: Tạo mới, cập nhật, hoàn thành và xóa lịch nhắc', async () => {
    await withServer(createApp(), async origin => {
      const futureTime = new Date(Date.now() + 86400000 * 5).toISOString(); // 5 ngày tới
      const updateFutureTime = new Date(Date.now() + 86400000 * 7).toISOString(); // 7 ngày tới

      // 2.1 Tạo mới lịch nhắc gọi lại
      const resSet = await fetch(`${origin}/api/leads/lead-test-01/reminder`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reminderAt: futureTime,
          note: 'Hẹn gọi lại sau khi phụ huynh nhận lương đầu tháng'
        })
      });
      assert.equal(resSet.status, 200);
      const leadAfterSet = (await resSet.json()).data;
      assert.equal(leadAfterSet.callbackReminder.reminderAt, futureTime);
      assert.equal(leadAfterSet.callbackReminder.isCompleted, false);
      assert.equal(leadAfterSet.isOverdue, false);
      assert.equal(leadAfterSet.overdueStatus, 'Chờ gọi lại');

      // 2.2 Cập nhật thời điểm nhắc gọi lại
      const resUpdate = await fetch(`${origin}/api/leads/lead-test-01/reminder`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reminderAt: updateFutureTime,
          note: 'Phụ huynh xin lùi thêm 2 ngày'
        })
      });
      assert.equal(resUpdate.status, 200);
      const leadAfterUpdate = (await resUpdate.json()).data;
      assert.equal(leadAfterUpdate.callbackReminder.reminderAt, updateFutureTime);
      assert.equal(leadAfterUpdate.callbackReminder.note, 'Phụ huynh xin lùi thêm 2 ngày');

      // 2.3 Đánh dấu hoàn thành lịch nhắc gọi lại
      const resComplete = await fetch(`${origin}/api/leads/lead-test-01/reminder/complete`, {
        method: 'PATCH'
      });
      assert.equal(resComplete.status, 200);
      const leadAfterComplete = (await resComplete.json()).data;
      assert.equal(leadAfterComplete.callbackReminder.isCompleted, true);
      assert.ok(leadAfterComplete.callbackReminder.completedAt);
      assert.equal(leadAfterComplete.isOverdue, false);

      // 2.4 Xóa lịch nhắc gọi lại
      const resDelete = await fetch(`${origin}/api/leads/lead-test-01/reminder`, {
        method: 'DELETE'
      });
      assert.equal(resDelete.status, 200);
      const leadAfterDelete = (await resDelete.json()).data;
      assert.equal(leadAfterDelete.callbackReminder, null);
      assert.equal(leadAfterDelete.reminderAt, null);
    });
  });

  test('3. Ràng buộc dữ liệu: Không cho phép đặt lịch nhắc gọi lại trong quá khứ', async () => {
    await withServer(createApp(), async origin => {
      const pastTime = new Date(Date.now() - 3600000 * 24).toISOString(); // 1 ngày trước
      const resPast = await fetch(`${origin}/api/leads/lead-test-01/reminder`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          reminderAt: pastTime,
          note: 'Cố tình đặt ngày hôm qua'
        })
      });
      assert.equal(resPast.status, 400);
      const errorJson = await resPast.json();
      assert.equal(errorJson.code, 'PAST_REMINDER_DATE');
      assert.match(errorJson.message, /không được nhỏ hơn thời điểm hiện tại/);
    });
  });

  test('4. Logic tự động nhận diện và gắn nhãn lead Quá hạn gọi lại', async () => {
    await withServer(createApp(), async origin => {
      // lead-test-02 có reminderAt là 2026-01-01 (đã qua và chưa complete)
      const resList = await fetch(`${origin}/api/leads`);
      assert.equal(resList.status, 200);
      const listData = await resList.json();
      const lead02 = listData.items.find(l => l.id === 'lead-test-02');
      assert.ok(lead02, 'Tìm thấy lead-test-02');
      assert.equal(lead02.isOverdue, true);
      assert.equal(lead02.overdueStatus, 'Quá hạn');

      const lead01 = listData.items.find(l => l.id === 'lead-test-01');
      assert.equal(lead01.isOverdue, false);
    });
  });

  test('5. Xử lý lỗi validation: Thiếu trường bắt buộc hoặc lead không tồn tại', async () => {
    await withServer(createApp(), async origin => {
      // 5.1 Ghi log với loại tương tác sai
      const resBadType = await fetch(`${origin}/api/leads/lead-test-01/care-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'chat_online',
          content: 'Trao đổi qua discord'
        })
      });
      assert.equal(resBadType.status, 400);
      assert.equal((await resBadType.json()).code, 'INVALID_INTERACTION_TYPE');

      // 5.2 Ghi log không có nội dung
      const resEmptyContent = await fetch(`${origin}/api/leads/lead-test-01/care-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'Gọi điện',
          content: '   '
        })
      });
      assert.equal(resEmptyContent.status, 400);

      // 5.3 Gọi lead không tồn tại
      const resNotFound = await fetch(`${origin}/api/leads/non-existing-lead-id/care-logs`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'Gọi điện',
          content: 'Không tìm thấy'
        })
      });
      assert.equal(resNotFound.status, 404);
      assert.equal((await resNotFound.json()).code, 'LEAD_NOT_FOUND');
    });
  });
});
