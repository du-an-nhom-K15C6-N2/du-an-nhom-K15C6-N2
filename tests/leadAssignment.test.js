const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'group-lead-assignment-'));
const leadsFile = path.join(temporaryDirectory, 'leads.json');
const usersFile = path.join(temporaryDirectory, 'users.json');
process.env.CONSULTATION_LEADS_DATA_FILE = leadsFile;
process.env.DATA_FILE = usersFile;

const express = require('express');
const { createLeadRouter } = require('../backend/routes/leadRoutes');

const users = [
  { id: 'usr_admin', name: 'Quản trị viên', email: 'admin@example.test', role: 'admin', roles: ['admin'], status: 'active' },
  { id: 'usr_manager', name: 'Quản lý', email: 'manager@example.test', role: 'manager', roles: ['manager'], status: 'active' },
  { id: 'usr_staff_1', name: 'Tư vấn viên Một', email: 'staff1@example.test', role: 'training_staff', roles: ['training_staff'], status: 'active' },
  { id: 'usr_staff_2', name: 'Tư vấn viên Hai', email: 'staff2@example.test', role: 'training_staff', roles: ['training_staff'], status: 'active' },
  { id: 'usr_staff_locked', name: 'Tài khoản đã khóa', email: 'locked@example.test', role: 'training_staff', roles: ['training_staff'], status: 'locked' }
];

function createApp(userId) {
  const UserModel = require('../backend/models/userModel');
  const app = express();
  app.use(express.json());
  app.use('/api/leads', createLeadRouter({
    authenticate(req, res, next) {
      req.user = UserModel.findById(userId);
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

function readLeads() {
  return JSON.parse(fs.readFileSync(leadsFile, 'utf8'));
}

beforeEach(() => {
  fs.writeFileSync(usersFile, JSON.stringify(users));
  fs.writeFileSync(leadsFile, JSON.stringify([
    {
      id: 'lead-assigned',
      name: 'Lead được giao',
      phone: '0901111222',
      source: 'Website',
      program: 'Toán',
      status: 'Mới',
      assignedTo: 'usr_staff_1',
      assignedConsultant: { id: 'usr_staff_1', name: 'Tư vấn viên Một' }
    },
    {
      id: 'lead-unassigned',
      name: 'Lead chưa giao',
      phone: '0903333444',
      source: 'Facebook',
      program: 'Văn',
      status: 'Đang tư vấn'
    }
  ]));
});

after(() => {
  delete process.env.CONSULTATION_LEADS_DATA_FILE;
  delete process.env.DATA_FILE;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('limits training staff to assigned leads while managers can filter the whole list', async () => {
  await withServer(createApp('usr_staff_1'), async origin => {
    const response = await fetch(`${origin}/api/leads`);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(result.items.map(lead => lead.id), ['lead-assigned']);
    assert.equal(result.summary.total, 1);

    const boardResponse = await fetch(`${origin}/api/leads/board`);
    const board = await boardResponse.json();
    assert.equal(board.counts['Mới'], 1);
    assert.equal(board.counts['Đang tư vấn'], 0);

    const forbiddenLead = await fetch(`${origin}/api/leads/lead-unassigned`);
    assert.equal(forbiddenLead.status, 403);
  });

  await withServer(createApp('usr_manager'), async origin => {
    const response = await fetch(`${origin}/api/leads?consultantId=unassigned`);
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(result.items.map(lead => lead.id), ['lead-unassigned']);
  });
});

test('allows managers to bulk-assign atomically and exposes transfer history', async () => {
  await withServer(createApp('usr_manager'), async origin => {
    const response = await fetch(`${origin}/api/leads/assign-bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        leadIds: ['lead-assigned', 'lead-unassigned'],
        consultantId: 'usr_staff_2',
        note: 'Cân bằng số lượng lead'
      })
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.data.assignedCount, 2);
    assert.equal(readLeads().every(lead => lead.assignedTo === 'usr_staff_2'), true);
    assert.equal(readLeads()[0].assignmentHistory[0].fromConsultant.id, 'usr_staff_1');
    assert.equal(readLeads()[0].assignmentHistory[0].performedBy.id, 'usr_manager');

    const historyResponse = await fetch(`${origin}/api/leads/lead-assigned/transfer-history`);
    const history = await historyResponse.json();
    assert.equal(historyResponse.status, 200);
    assert.equal(history.items[0].note, 'Cân bằng số lượng lead');
    assert.equal(history.items[0].toConsultant.name, 'Tư vấn viên Hai');
  });
});

test('supports authenticated single-lead reassignment with both HTTP methods', async () => {
  await withServer(createApp('usr_admin'), async origin => {
    const patchResponse = await fetch(`${origin}/api/leads/lead-unassigned/reassign`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ consultantId: 'usr_staff_1', note: 'Phân công ban đầu' })
    });
    assert.equal(patchResponse.status, 200);
    assert.equal((await patchResponse.json()).data.assignedTo, 'usr_staff_1');

    const putResponse = await fetch(`${origin}/api/leads/lead-unassigned/reassign`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assignedTo: 'usr_staff_2' })
    });
    assert.equal(putResponse.status, 200);
    assert.equal((await putResponse.json()).data.assignedTo, 'usr_staff_2');
    assert.equal(readLeads()[1].assignmentHistory.length, 2);
  });
});

test('rejects assignment by staff and leaves a partially invalid batch unchanged', async () => {
  await withServer(createApp('usr_staff_1'), async origin => {
    const response = await fetch(`${origin}/api/leads/assign-bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadIds: ['lead-unassigned'], consultantId: 'usr_staff_2' })
    });
    assert.equal(response.status, 403);
    assert.equal(readLeads()[1].assignedTo, undefined);

    const duplicateCheck = await fetch(`${origin}/api/leads/phone-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0903333444' })
    });
    const duplicateResult = await duplicateCheck.json();
    assert.equal(duplicateResult.isDuplicate, true);
    assert.equal(duplicateResult.existing, undefined);
  });

  await withServer(createApp('usr_admin'), async origin => {
    const response = await fetch(`${origin}/api/leads/assign-bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ leadIds: ['lead-unassigned', 'missing-lead'], consultantId: 'usr_staff_2' })
    });
    assert.equal(response.status, 404);
    assert.equal(readLeads()[1].assignedTo, undefined);
  });
});

test('auto-assigns new staff-created leads and only returns active staff as consultants', async () => {
  await withServer(createApp('usr_staff_1'), async origin => {
    const response = await fetch(`${origin}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Lead mới',
        phone: '0905555666',
        source: 'Website',
        program: 'Khoa học'
      })
    });
    const result = await response.json();
    assert.equal(response.status, 201);
    assert.equal(result.data.assignedTo, 'usr_staff_1');
    assert.equal(result.data.assignmentHistory[0].toConsultant.id, 'usr_staff_1');
  });

  const UserModel = require('../backend/models/userModel');
  assert.deepEqual(UserModel.findActiveConsultants().map(user => user.id), ['usr_staff_1', 'usr_staff_2']);

  const { app } = require('../backend/server');
  const { createToken } = require('../backend/security/token');
  const managerToken = createToken(UserModel.findById('usr_manager'));
  await withServer(app, async origin => {
    const response = await fetch(`${origin}/api/consultants`, {
      headers: { authorization: `Bearer ${managerToken}` }
    });
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.deepEqual(result.data.map(user => user.id), ['usr_staff_1', 'usr_staff_2']);

    const staffToken = createToken(UserModel.findById('usr_staff_1'));
    const forbidden = await fetch(`${origin}/api/consultants`, {
      headers: { authorization: `Bearer ${staffToken}` }
    });
    assert.equal(forbidden.status, 403);
  });
});
