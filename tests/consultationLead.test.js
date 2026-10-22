'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, beforeEach, test } = require('node:test');

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'consultation-leads-'));
process.env.CONSULTATION_LEADS_DATA_FILE = path.join(temporaryDirectory, 'leads.json');

const { ConsultationLeadError, ConsultationLeadModel, normalizePhone } = require('../backend/consultationLeadModel');
const { createConsultationRateLimiter } = require('../backend/consultationLeadRateLimit');
const { createPreviewServer } = require('../preview-server');

function readLeads() {
  return JSON.parse(fs.readFileSync(process.env.CONSULTATION_LEADS_DATA_FILE, 'utf8'));
}

function expectCode(callback, code, status = 400) {
  assert.throws(callback, error => (
    error instanceof ConsultationLeadError
    && error.code === code
    && error.status === status
  ));
}

beforeEach(() => {
  fs.writeFileSync(process.env.CONSULTATION_LEADS_DATA_FILE, '[]', 'utf8');
});

after(() => {
  delete process.env.CONSULTATION_LEADS_DATA_FILE;
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('creates a new lead with normalized contact details and status', () => {
  const lead = ConsultationLeadModel.create({
    name: '  Nguyễn   Thị An ',
    phone: '0912 345-678',
    email: '  AN@example.COM ',
    program: ' Lập trình viên ',
    message: ' Muốn tìm hiểu thêm ',
    consent: true
  });

  assert.equal(lead.name, 'Nguyễn Thị An');
  assert.equal(lead.phone, '+84912345678');
  assert.equal(lead.email, 'an@example.com');
  assert.equal(lead.program, 'Lập trình viên');
  assert.equal(lead.message, 'Muốn tìm hiểu thêm');
  assert.equal(lead.status, 'Mới');
  assert.equal(lead.source, 'consultation-form');
  assert.ok(lead.id);
  assert.ok(Number.isFinite(Date.parse(lead.createdAt)));
  assert.equal(lead.consentedAt, lead.createdAt);
  assert.deepEqual(readLeads(), [lead]);
});

test('rejects a duplicate consultation phone before saving a second lead', () => {
  ConsultationLeadModel.create({
    name: 'Người học',
    phone: '0912345678',
    consent: true
  });
  expectCode(() => ConsultationLeadModel.create({
    name: 'Người học khác',
    phone: '+84 912 345 678',
    consent: true
  }), 'DUPLICATE_PHONE_NUMBER', 409);
  assert.equal(readLeads().length, 1);
});

test('normalizes supported Vietnamese phone formats to +84', () => {
  assert.equal(normalizePhone('0912.345.678'), '+84912345678');
  assert.equal(normalizePhone('+84 (912) 345-678'), '+84912345678');
  assert.equal(normalizePhone('0084 912 345 678'), '+84912345678');
});

test('rejects invalid contact data and does not persist a lead', () => {
  expectCode(() => ConsultationLeadModel.create({
    name: 'A', phone: '0912345678', consent: true
  }), 'INVALID_NAME');
  expectCode(() => ConsultationLeadModel.create({
    name: 'Người học', phone: '123', consent: true
  }), 'INVALID_PHONE');
  expectCode(
    () => ConsultationLeadModel.create({
      name: 'Người học', phone: '0912345678', email: 'khong-phai-email', consent: true
    }),
    'INVALID_EMAIL'
  );
  expectCode(() => ConsultationLeadModel.create(null), 'INVALID_INPUT');
  expectCode(() => ConsultationLeadModel.create({
    name: 'Người học', phone: '0912345678'
  }), 'CONSENT_REQUIRED');
  assert.deepEqual(readLeads(), []);
});

test('rejects overlong optional fields and accepts omitted optional fields', () => {
  const lead = ConsultationLeadModel.create({
    name: 'Người học', phone: '+84912345678', consent: true
  });
  assert.equal(lead.email, null);
  assert.equal(lead.program, '');
  assert.equal(lead.message, '');

  expectCode(() => ConsultationLeadModel.create({
    name: 'Người học',
    phone: '0912345678',
    consent: true,
    message: 'x'.repeat(1001)
  }), 'INVALID_INPUT');
  assert.equal(readLeads().length, 1);
});

test('rate limiter blocks requests after the configured limit and resets the window', () => {
  let currentTime = 1000;
  const limiter = createConsultationRateLimiter({
    windowMs: 60_000,
    maxRequests: 2,
    now: () => currentTime
  });

  function send(address) {
    const result = { headers: {}, statusCode: 200, body: null, continued: false };
    const response = {
      set(name, value) { result.headers[name] = value; return this; },
      status(statusCode) { result.statusCode = statusCode; return this; },
      json(body) { result.body = body; return this; }
    };
    limiter({ ip: address }, response, () => { result.continued = true; });
    return result;
  }

  assert.equal(send('192.0.2.1').continued, true);
  assert.equal(send('192.0.2.1').continued, true);
  const limited = send('192.0.2.1');
  assert.equal(limited.statusCode, 429);
  assert.equal(limited.body.code, 'CONSULTATION_RATE_LIMITED');
  assert.equal(limited.headers['Retry-After'], '60');
  assert.equal(send('192.0.2.2').continued, true);

  currentTime += 60_001;
  assert.equal(send('192.0.2.1').continued, true);
});

test('public preview serves the form, accepts consented leads, and discards honeypot submissions', async t => {
  const server = createPreviewServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()));
  }));

  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  const page = await fetch(origin);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Đăng ký nhận tư vấn/u);

  const accepted = await fetch(`${origin}/api/consultation-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Người học',
      phone: '0912345678',
      consent: true
    })
  });
  assert.equal(accepted.status, 201);
  assert.equal((await accepted.json()).data.status, 'Mới');
  assert.equal(readLeads().length, 1);

  const spam = await fetch(`${origin}/api/consultation-leads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ website: 'spam bot' })
  });
  assert.equal(spam.status, 201);
  assert.equal(readLeads().length, 1);
});
