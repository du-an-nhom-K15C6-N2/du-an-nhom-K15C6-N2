const express = require('express');
const { timingSafeEqual } = require('node:crypto');
const { normalizePhone } = require('./phone-number');

const FILTER_COLUMNS = Object.freeze({
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
  source: 'source',
  program: 'program',
  status: 'status'
});

const SORT_COLUMNS = Object.freeze({
  createdAt: 'created_at',
  fullName: 'full_name',
  phone: 'phone',
  email: 'email',
  source: 'source',
  program: 'program'
});

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const MAX_FILTER_LENGTH = 200;

function getSingleQueryValue(value, name) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new Error(`Query parameter "${name}" must be a single string.`);
  }

  return value;
}

function parsePositiveInteger(value, name, defaultValue, maxValue) {
  if (value === undefined) {
    return defaultValue;
  }

  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error(`Query parameter "${name}" must be a positive integer.`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Query parameter "${name}" must be a safe positive integer.`);
  }
  if (maxValue !== undefined && parsed > maxValue) {
    throw new Error(`Query parameter "${name}" must not exceed ${maxValue}.`);
  }

  return parsed;
}

function escapeLikeValue(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

function invalid(res, message) {
  res.status(400).json({ message, error: { code: 'VALIDATION_ERROR' } });
}

function toLead(row) {
  return {
    ...row,
    id: String(row.id),
    name: row.fullName,
    phoneNumber: row.phone,
    programOfInterest: row.program,
    updatedAt: row.updatedAt ?? row.createdAt
  };
}

function parseLeadInput(body, partial = false) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Request body phải là một đối tượng JSON.' };
  }

  const read = (...names) => names.find((name) => Object.hasOwn(body, name));
  const mapping = [
    ['fullName', ['fullName', 'name'], 120],
    ['phoneNumber', ['phoneNumber', 'phone'], 20],
    ['email', ['email'], 254],
    ['source', ['source'], 100],
    ['program', ['programOfInterest', 'program'], 200],
    ['status', ['status'], 50],
    ['note', ['note', 'notes'], 1000]
  ];
  const values = {};

  for (const [field, names, maxLength] of mapping) {
    const inputName = read(...names);
    if (inputName === undefined) {
      if (!partial && ['fullName', 'phoneNumber', 'source', 'program'].includes(field)) {
        return { error: `Trường ${names[0]} là bắt buộc.` };
      }
      continue;
    }
    const value = body[inputName];
    if (value === null && field === 'email') {
      values[field] = '';
      continue;
    }
    if (typeof value !== 'string') return { error: `Trường ${inputName} phải là chuỗi.` };
    const trimmed = value.trim();
    if (trimmed.length > maxLength) return { error: `Trường ${inputName} không được vượt quá ${maxLength} ký tự.` };
    if (['fullName', 'phoneNumber', 'source', 'program'].includes(field) && !trimmed) {
      return { error: `Trường ${inputName} không được để trống.` };
    }
    values[field] = trimmed;
  }

  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return { error: 'Địa chỉ email không hợp lệ.' };
  }
  if (values.phoneNumber !== undefined) {
    const normalized = normalizePhone(values.phoneNumber);
    if (normalized.length < 7 || normalized.length > 15) {
      return { error: 'Số điện thoại không hợp lệ.' };
    }
    values.phoneNumber = values.phoneNumber;
    values.phone_normalized = normalized;
  }
  if (values.status !== undefined && !['Mới', 'Đã liên hệ', 'Đang tư vấn', 'Hẹn học thử', 'Chốt', 'Từ chối', 'Đã chuyển đổi', 'Không tiềm năng'].includes(values.status)) {
    return { error: 'Trạng thái Lead không hợp lệ.' };
  }
  return { values };
}

function createLeadRouter(db) {
  const router = express.Router();
  const selectLead = `
    SELECT id, full_name AS fullName, phone, email, source, program, status, note,
      created_at AS createdAt, updated_at AS updatedAt
    FROM leads`;

  function getTokenRole(token) {
    for (const [role, expected] of [
      ['Quản lý đào tạo', process.env.LEAD_MANAGER_TOKEN],
      ['Tư vấn tuyển sinh', process.env.REGULAR_USER_TOKEN]
    ]) {
      if (!expected) continue;
      const actualBuffer = Buffer.from(token);
      const expectedBuffer = Buffer.from(expected);
      if (actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)) return role;
    }
    return null;
  }

  function authenticate(req, res, next) {
    const managerToken = process.env.LEAD_MANAGER_TOKEN;
    const advisorToken = process.env.REGULAR_USER_TOKEN;
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(\S+)$/i.exec(authorization);
    if (!managerToken || !advisorToken || managerToken === advisorToken) {
      return res.status(503).json({ message: 'Xác thực API chưa được cấu hình.', error: { code: 'AUTH_NOT_CONFIGURED' } });
    }
    const role = match ? getTokenRole(match[1]) : null;
    if (!role) {
      return res.status(401).json({ message: 'Vui lòng đăng nhập bằng tài khoản quản lý đào tạo.', error: { code: 'UNAUTHENTICATED' } });
    }
    req.user = { role };
    next();
  }

  function requireManager(req, res, next) {
    if (req.user.role !== 'Quản lý đào tạo') {
      return res.status(403).json({ message: 'Chỉ quản lý đào tạo được phép xóa Lead.', error: { code: 'FORBIDDEN' } });
    }
    next();
  }

  router.get('/', (req, res) => {
    try {
      const pageText = getSingleQueryValue(req.query.page, 'page') ?? '1';
      const limitText = getSingleQueryValue(req.query.pageSize ?? req.query.limit, 'pageSize') ?? '20';
      const page = parsePositiveInteger(pageText, 'page', 1);
      const limit = parsePositiveInteger(limitText, 'pageSize', 20, 100);
      const offset = (page - 1) * limit;
      if (!Number.isSafeInteger(offset)) return invalid(res, 'Tham số page quá lớn.');

      const filters = [];
      const parameters = [];
      const addFilter = (column, value) => {
        if (value === undefined || value === '') return;
        if (typeof value !== 'string' || value.length > MAX_FILTER_LENGTH) throw new Error('Tham số lọc không hợp lệ.');
        filters.push(`${column} LIKE ? ESCAPE '\\' COLLATE NOCASE`);
        parameters.push(`%${escapeLikeValue(value.trim())}%`);
      };
      if (req.query.q !== undefined) {
        if (typeof req.query.q !== 'string') return invalid(res, 'Tham số q phải là chuỗi.');
        const search = `%${escapeLikeValue(req.query.q.trim())}%`;
        filters.push("(full_name LIKE ? ESCAPE '\\' COLLATE NOCASE OR phone LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' COLLATE NOCASE)");
        parameters.push(search, search, search);
      }
      addFilter('status', getSingleQueryValue(req.query.status, 'status'));
      addFilter('source', getSingleQueryValue(req.query.source, 'source'));
      for (const field of ['fullName', 'phone', 'email', 'program']) {
        addFilter(FILTER_COLUMNS[field], getSingleQueryValue(req.query[field], field));
      }

      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const sortBy = getSingleQueryValue(req.query.sortBy, 'sortBy') || 'createdAt';
      const sortColumn = SORT_COLUMNS[sortBy];
      const sortOrder = String(getSingleQueryValue(req.query.sortOrder, 'sortOrder') || 'DESC').toUpperCase();
      if (!sortColumn || !['ASC', 'DESC'].includes(sortOrder)) return invalid(res, 'Tham số sắp xếp không hợp lệ.');
      const total = db.prepare(`SELECT COUNT(*) AS total FROM leads ${where}`).get(...parameters).total;
      const rows = db.prepare(`${selectLead} ${where} ORDER BY ${sortColumn} ${sortOrder}, id ${sortOrder} LIMIT ? OFFSET ?`)
        .all(...parameters, limit, offset).map(toLead);
      const summary = db.prepare(`
        SELECT COUNT(*) AS total,
          SUM(CASE WHEN status = 'Mới' THEN 1 ELSE 0 END) AS new,
          SUM(CASE WHEN status IN ('Đang tư vấn', 'Đã liên hệ', 'Hẹn học thử') THEN 1 ELSE 0 END) AS consulting,
          SUM(CASE WHEN status IN ('Chốt', 'Đã chuyển đổi') THEN 1 ELSE 0 END) AS converted
        FROM leads`).get();
      res.json({ items: rows, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) }, summary });
    } catch (error) {
      if (error instanceof Error && (error.message.startsWith('Query parameter') || error.message.startsWith('Tham số'))) return invalid(res, error.message);
      throw error;
    }
  });

  router.get('/:id', (req, res) => {
    const lead = db.prepare(`${selectLead} WHERE id = ?`).get(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Không tìm thấy Lead.', error: { code: 'LEAD_NOT_FOUND' } });
    res.json({ data: toLead(lead) });
  });

  router.post('/phone-check', authenticate, (req, res) => {
    const phone = req.body?.phoneNumber ?? req.body?.phone;
    if (typeof phone !== 'string') return invalid(res, 'Số điện thoại không hợp lệ.');
    const normalized = normalizePhone(phone);
    if (normalized.length < 7 || normalized.length > 15) return invalid(res, 'Số điện thoại không hợp lệ.');
    const existing = db.prepare(`${selectLead} WHERE phone_normalized = ?`).get(normalized);
    res.json({ isDuplicate: Boolean(existing), ...(existing ? { existing: { existingLeadId: String(existing.id), existingLeadName: existing.fullName, existingPhone: existing.phone } } : {}) });
  });

  router.post('/', authenticate, (req, res) => {
    const parsed = parseLeadInput(req.body);
    if (parsed.error) return invalid(res, parsed.error);
    const { values } = parsed;
    const duplicate = db.prepare('SELECT id FROM leads WHERE phone_normalized = ?').get(values.phone_normalized);
    if (duplicate) return res.status(409).json({ message: 'Số điện thoại này đã tồn tại trong hệ thống.', error: { code: 'DUPLICATE_PHONE_NUMBER' } });
    const result = db.prepare(`INSERT INTO leads (full_name, phone, phone_normalized, email, source, program, status, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(values.fullName, values.phoneNumber, values.phone_normalized, values.email || null, values.source, values.program, values.status || 'Mới', values.note || '');
    const saved = db.prepare(`${selectLead} WHERE id = ?`).get(result.lastInsertRowid);
    res.status(201).json({ data: toLead(saved) });
  });

  const updateLead = (req, res) => {
    const parsed = parseLeadInput(req.body, true);
    if (parsed.error) return invalid(res, parsed.error);
    const existing = db.prepare(`${selectLead} WHERE id = ?`).get(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy Lead.', error: { code: 'LEAD_NOT_FOUND' } });
    const { values } = parsed;
    if (values.phone_normalized) {
      const duplicate = db.prepare('SELECT id FROM leads WHERE phone_normalized = ? AND id <> ?').get(values.phone_normalized, req.params.id);
      if (duplicate) return res.status(409).json({ message: 'Số điện thoại này đã tồn tại trong hệ thống.', error: { code: 'DUPLICATE_PHONE_NUMBER' } });
    }
    const columns = { fullName: 'full_name', phoneNumber: 'phone', phone_normalized: 'phone_normalized', email: 'email', source: 'source', program: 'program', status: 'status', note: 'note' };
    const entries = Object.entries(values);
    if (!entries.length) return res.json({ data: toLead(existing) });
    const assignments = entries.map(([field]) => `${columns[field]} = ?`);
    assignments.push("updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')");
    db.prepare(`UPDATE leads SET ${assignments.join(', ')} WHERE id = ?`).run(...entries.map(([, value]) => value), req.params.id);
    const updated = db.prepare(`${selectLead} WHERE id = ?`).get(req.params.id);
    res.json({ data: toLead(updated) });
  };
  router.patch('/:id', authenticate, updateLead);
  router.put('/:id', authenticate, updateLead);
  router.delete('/:id', authenticate, requireManager, (req, res) => {
    const result = db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    if (!result.changes) return res.status(404).json({ message: 'Không tìm thấy Lead.', error: { code: 'LEAD_NOT_FOUND' } });
    res.status(204).end();
  });
  return router;
}

module.exports = { createLeadRouter };
