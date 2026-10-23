const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'group-leads-'));
const leadsFile = path.join(temporaryDirectory, 'leads.json');
process.env.CONSULTATION_LEADS_DATA_FILE = leadsFile;
process.env.DATA_FILE = path.join(temporaryDirectory, 'users.json');
process.env.SESSION_STORE_FILE = path.join(temporaryDirectory, 'sessions.json');
process.env.LOGIN_ATTEMPT_STORE_FILE = path.join(temporaryDirectory, 'login-attempts.json');

const express = require('express');
const { LeadModel, normalizePhoneNumber } = require('../backend/models/leadModel');
const { createLeadRouter } = require('../backend/routes/leadRoutes');
const UserModel = require('../backend/models/userModel');
const { createToken } = require('../backend/security/token');

function createApp(role = 'manager') {
  const app = express();
  app.use(express.json());
  app.use('/api/leads', createLeadRouter({
    authenticate(req, res, next) {
      req.user = { id: 'test-user', role, roles: [role] };
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

beforeEach(() => {
  fs.writeFileSync(leadsFile, JSON.stringify([{
    id: 'consultation-existing',
    name: 'Nguyễn An',
    phone: '+84912345678',
    email: 'AN@example.com',
    program: 'Toán',
    message: 'Đã đồng ý liên hệ',
    source: 'consultation-form',
    status: 'Mới',
    consentedAt: '2026-01-01T00:00:00.000Z'
  }]));
});

after(() => {
  delete process.env.CONSULTATION_LEADS_DATA_FILE;
  delete process.env.DATA_FILE;
  delete process.env.SESSION_STORE_FILE;
  delete process.env.LOGIN_ATTEMPT_STORE_FILE;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('normalizes country codes and separator variants consistently', () => {
  assert.equal(normalizePhoneNumber('+84 (912) 345-678'), '0912345678');
  assert.equal(normalizePhoneNumber('0084 912 345 678'), '0912345678');
});

test('reads public consultation leads without discarding consent or message data', () => {
  const { items, pagination } = LeadModel.list({});
  assert.equal(pagination.total, 1);
  assert.equal(items[0].name, 'Nguyễn An');
  assert.equal(items[0].note, 'Đã đồng ý liên hệ');
  assert.equal(items[0].consentedAt, '2026-01-01T00:00:00.000Z');
});

test('rejects duplicate phones across the existing consultation store in equivalent formats', () => {
  assert.throws(
    () => LeadModel.create({
      name: 'Người đăng ký khác',
      phone: '0912.345.678',
      source: 'Website',
      program: 'Toán'
    }),
    error => error.status === 409 && error.code === 'DUPLICATE_PHONE_NUMBER'
  );
});

test('supports create, search, pagination, partial update, phone check, and delete via API', async () => {
  await withServer(createApp(), async origin => {
    const createdResponse = await fetch(`${origin}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Trần Bảo',
        phone: '+84 987 654 321',
        email: 'BAO@example.com',
        source: 'Website',
        program: 'Lập trình',
        note: 'Gọi buổi sáng.\nGửi thông tin qua email.'
      })
    });
    assert.equal(createdResponse.status, 201);
    const created = (await createdResponse.json()).data;
    assert.equal(created.phone, '0987654321');
    assert.equal(created.email, 'bao@example.com');
    assert.equal(created.note, 'Gọi buổi sáng.\nGửi thông tin qua email.');

    const listResponse = await fetch(`${origin}/api/leads?q=BAO&page=1&pageSize=1`);
    const list = await listResponse.json();
    assert.equal(listResponse.status, 200);
    assert.equal(list.items[0].id, created.id);
    assert.equal(list.pagination.total, 1);
    assert.equal(list.pagination.limit, 1);

    for (const [field, value] of [
      ['name', 'Trần Bảo'],
      ['phone', '0987'],
      ['email', 'bao@example.com'],
      ['source', 'Website'],
      ['program', 'Lập trình'],
      ['status', 'Mới']
    ]) {
      const query = new URLSearchParams({ [field]: value });
      const response = await fetch(`${origin}/api/leads?${query}`);
      assert.equal(response.status, 200);
      assert.ok((await response.json()).items.some(lead => lead.id === created.id), `Filter "${field}" missed the lead.`);
    }

    const checked = await fetch(`${origin}/api/leads/phone-check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '84987654321' })
    });
    assert.equal((await checked.json()).isDuplicate, true);

    const updateResponse = await fetch(`${origin}/api/leads/${created.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Trần Bảo mới' })
    });
    assert.equal(updateResponse.status, 200);
    assert.equal((await updateResponse.json()).data.name, 'Trần Bảo mới');

    const keepPhoneResponse = await fetch(`${origin}/api/leads/${created.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+84 987 654 321' })
    });
    assert.equal(keepPhoneResponse.status, 200);

    const deleted = await fetch(`${origin}/api/leads/${created.id}`, { method: 'DELETE' });
    assert.equal(deleted.status, 204);
    assert.equal(LeadModel.list({ q: 'Trần Bảo' }).pagination.total, 0);
  });
});

test('reports duplicate phones with HTTP 409 on create and update', async () => {
  await withServer(createApp(), async origin => {
    const create = phone => fetch(`${origin}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Lead trùng số',
        phone,
        source: 'Website',
        program: 'Ngoại ngữ'
      })
    });

    const firstResponse = await create('0911222333');
    assert.equal(firstResponse.status, 201);
    const first = (await firstResponse.json()).data;
    const duplicateResponse = await create('+84 911 222 333');
    assert.equal(duplicateResponse.status, 409);
    assert.equal((await duplicateResponse.json()).existing.existingLeadId, first.id);

    const secondResponse = await create('0911222444');
    const second = (await secondResponse.json()).data;
    const updateResponse = await fetch(`${origin}/api/leads/${second.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '0084 911 222 333' })
    });
    assert.equal(updateResponse.status, 409);
  });
});

test('denies deletion for roles without the lead-delete permission', async () => {
  const lead = LeadModel.create({
    name: 'Lead được giữ lại',
    phone: '0911222333',
    source: 'Website',
    program: 'Ngoại ngữ'
  });

  for (const role of ['admin', 'training_staff']) {
    await withServer(createApp(role), async origin => {
      const response = await fetch(`${origin}/api/leads/${lead.id}`, { method: 'DELETE' });
      assert.equal(response.status, 403);
      assert.equal(LeadModel.findById(lead.id).name, 'Lead được giữ lại');
    });
  }
});

test('allows only training managers to delete all leads', async () => {
  LeadModel.create({
    name: 'Lead thứ hai',
    phone: '0911222444',
    source: 'Website',
    program: 'Toán'
  });

  for (const role of ['admin', 'training_staff']) {
    await withServer(createApp(role), async origin => {
      const response = await fetch(`${origin}/api/leads/all`, { method: 'DELETE' });
      assert.equal(response.status, 403);
      assert.equal(LeadModel.list({}).pagination.total, 2);
    });
  }

  await withServer(createApp('manager'), async origin => {
    const response = await fetch(`${origin}/api/leads/all`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).deletedCount, 2);
    assert.equal(LeadModel.list({}).pagination.total, 0);
  });
});

test('uses the group bearer-token authentication for integrated lead API requests', async () => {
  const { app } = require('../backend/server');
  const token = createToken(UserModel.findById('usr_001'));

  await withServer(app, async origin => {
    const unauthorized = await fetch(`${origin}/api/leads`);
    assert.equal(unauthorized.status, 401);

    const authorized = await fetch(`${origin}/api/leads`, {
      headers: { authorization: `Bearer ${token}` }
    });
    assert.equal(authorized.status, 200);
  });
});

test('serves the integrated UI with same-origin API and group-session configuration', async () => {
  const { app } = require('../backend/server');
  await withServer(app, async origin => {
    const page = await fetch(`${origin}/lead-management`);
    const html = await page.text();
    assert.equal(page.status, 200);
    assert.match(html, /window\.LEAD_API_ENABLED=true/u);
    assert.match(html, /window\.LEAD_USE_APP_AUTH=true/u);
    assert.match(html, /<base href="\/features\/lead-management-ui\/frontend\/">/u);
    assert.ok(html.indexOf('<base href=') < html.indexOf('href="./styles.css"'));
    assert.ok(html.indexOf('<base href=') < html.indexOf('src="./app.js"'));

    const script = await fetch(`${origin}/features/lead-management-ui/frontend/app.js`);
    assert.equal(script.status, 200);
    assert.match(await script.text(), /dnkn_auth_token/u);
  });
});

test('rejects invalid list parameters and invalid lead data', async () => {
  await withServer(createApp(), async origin => {
    const invalidQuery = await fetch(`${origin}/api/leads?page=0`);
    assert.equal(invalidQuery.status, 400);
    assert.equal((await invalidQuery.json()).code, 'INVALID_QUERY');

    const invalidLead = await fetch(`${origin}/api/leads`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'A',
        phone: '0912345678',
        source: 'Website',
        program: 'Toán'
      })
    });
    assert.equal(invalidLead.status, 400);
  });
});
