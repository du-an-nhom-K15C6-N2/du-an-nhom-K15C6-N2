const assert = require('node:assert/strict');
const { once } = require('node:events');
const { mkdtempSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const { createLeadRouter } = require('../src/app');
const { createDatabase } = require('../src/database');

async function withApi(callback) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'lead-management-'));
  const db = createDatabase(path.join(directory, 'leads.sqlite'));
  const app = express();
  app.use(express.json());
  app.use('/api/leads', createLeadRouter(db));
  const server = app.listen(0);
  await once(server, 'listening');
  const previousManagerToken = process.env.LEAD_MANAGER_TOKEN;
  const previousAdvisorToken = process.env.REGULAR_USER_TOKEN;
  process.env.LEAD_MANAGER_TOKEN = 'test-manager-token';
  process.env.REGULAR_USER_TOKEN = 'test-advisor-token';

  try {
    await callback(`http://127.0.0.1:${server.address().port}`);
  } finally {
    if (previousManagerToken === undefined) delete process.env.LEAD_MANAGER_TOKEN;
    else process.env.LEAD_MANAGER_TOKEN = previousManagerToken;
    if (previousAdvisorToken === undefined) delete process.env.REGULAR_USER_TOKEN;
    else process.env.REGULAR_USER_TOKEN = previousAdvisorToken;
    server.close();
    await once(server, 'close');
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
}

const auth = { authorization: 'Bearer test-manager-token' };

test('creates, searches, paginates, updates and deletes leads with phone normalization and RBAC', async () => {
  await withApi(async (baseUrl) => {
    const create = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Nguyen Van A',
        phoneNumber: '+84 912.345.678',
        source: 'Website',
        programOfInterest: 'English',
      }),
    });
    assert.equal(create.status, 201);
    const lead = (await create.json()).data;
    assert.equal(lead.name, 'Nguyen Van A');
    assert.equal(lead.phone, '+84 912.345.678');
    assert.equal(lead.status, 'Mới');

    const duplicate = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Duplicate',
        phoneNumber: '0912345678',
        source: 'Website',
        programOfInterest: 'English',
      }),
    });
    assert.equal(duplicate.status, 409);

    const phoneCheck = await fetch(`${baseUrl}/api/leads/phone-check`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ phone: '84912345678' }),
    });
    assert.equal(phoneCheck.status, 200);
    assert.equal((await phoneCheck.json()).isDuplicate, true);

    const list = await fetch(`${baseUrl}/api/leads?q=nguyen&page=1&pageSize=1`);
    const result = await list.json();
    assert.equal(list.status, 200);
    assert.equal(result.items.length, 1);
    assert.equal(result.pagination.total, 1);
    assert.equal(result.summary.total, 1);

    const unauthorized = await fetch(`${baseUrl}/api/leads/${lead.id}`, { method: 'DELETE' });
    assert.equal(unauthorized.status, 401);
    const advisorDelete = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer test-advisor-token' },
    });
    assert.equal(advisorDelete.status, 403);

    const update = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
      method: 'PATCH',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'Đang tư vấn', note: 'Đã gọi' }),
    });
    assert.equal(update.status, 200);
    assert.equal((await update.json()).data.status, 'Đang tư vấn');

    const deleted = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
      method: 'DELETE',
      headers: auth,
    });
    assert.equal(deleted.status, 204);
    const remaining = await fetch(`${baseUrl}/api/leads`);
    assert.equal((await remaining.json()).pagination.total, 0);
  });
});

test('keeps listing filters, sorting, pagination limits and escaped LIKE searches', async () => {
  await withApi(async (baseUrl) => {
    const headers = { ...auth, 'content-type': 'application/json' };
    for (const [fullName, phoneNumber, source, program] of [
      ['Nguyen An', '0901000001', 'Website', 'MBA'],
      ['Tran Binh', '0901000002', 'Facebook', 'Data'],
      ['Nguyen Chi', '0901000003', 'Website', 'Data'],
    ]) {
      const response = await fetch(`${baseUrl}/api/leads`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ fullName, phoneNumber, source, program }),
      });
      assert.equal(response.status, 201);
    }

    const filtered = await fetch(`${baseUrl}/api/leads?fullName=NGUYEN&phone=0003&source=web&program=data`);
    const filteredBody = await filtered.json();
    assert.equal(filteredBody.pagination.total, 1);
    assert.equal(filteredBody.items[0].name, 'Nguyen Chi');

    const sorted = await fetch(`${baseUrl}/api/leads?sortBy=fullName&sortOrder=ASC&limit=2`);
    const sortedBody = await sorted.json();
    assert.deepEqual(sortedBody.items.map((lead) => lead.name), ['Nguyen An', 'Nguyen Chi']);
    assert.equal(sortedBody.pagination.totalPages, 2);

    const literal = await fetch(`${baseUrl}/api/leads?email=%25`);
    assert.equal((await literal.json()).pagination.total, 0);

    const invalidLimit = await fetch(`${baseUrl}/api/leads?limit=101`);
    assert.equal(invalidLimit.status, 400);
  });
});

test('validates request data and query limits', async () => {
  await withApi(async (baseUrl) => {
    const invalidLead = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { ...auth, 'content-type': 'application/json' },
      body: JSON.stringify({
        fullName: '',
        phoneNumber: 'abc',
        source: 'Website',
        program: 'English',
      }),
    });
    assert.equal(invalidLead.status, 400);

    const invalidPage = await fetch(`${baseUrl}/api/leads?page=0`);
    assert.equal(invalidPage.status, 400);
  });
});

test('adds new schema columns without discarding legacy SQLite records', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'lead-migration-'));
  const databasePath = path.join(directory, 'legacy.sqlite');
  const { DatabaseSync } = require('node:sqlite');
  const legacyDb = new DatabaseSync(databasePath);
  legacyDb.exec(`
    CREATE TABLE leads (
      id INTEGER PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      source TEXT,
      program TEXT,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    INSERT INTO leads (full_name, phone, source, program)
    VALUES ('Legacy lead', '+84 (912) 345-678', 'Website', 'English');
  `);
  legacyDb.close();

  const db = createDatabase(databasePath);
  const row = db.prepare('SELECT full_name, phone_normalized, status, note, updated_at FROM leads').get();
  assert.equal(row.full_name, 'Legacy lead');
  assert.equal(row.phone_normalized, '0912345678');
  assert.equal(row.status, 'Mới');
  assert.equal(row.note, '');
  assert.ok(row.updated_at);
  db.close();
  rmSync(directory, { recursive: true, force: true });
});
