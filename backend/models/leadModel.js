const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const UserModel = require('./userModel');

const DEFAULT_LEADS_FILE = path.resolve(
  __dirname,
  '../../features/consultation-registration/data/consultation-leads.json'
);
const MAX_PAGE_SIZE = 100;
const MAX_FILTER_LENGTH = 200;
const ASSIGNMENT_MANAGER_ROLES = new Set(['admin', 'manager']);
const PIPELINE_STATUSES = [
  'Mới',
  'Đã liên hệ',
  'Đang tư vấn',
  'Hẹn học thử',
  'Chốt',
  'Từ chối'
];
const REJECTION_REASONS = [
  'Không phù hợp nhu cầu',
  'Không liên hệ được',
  'Học phí',
  'Lịch học',
  'Đã chọn nơi khác'
];
const ALLOWED_STATUSES = new Set([
  'Mới',
  'Đã liên hệ',
  'Đang tư vấn',
  'Hẹn học thử',
  'Chốt',
  'Từ chối',
  'Đã chuyển đổi',
  'Không tiềm năng'
]);
const ALLOWED_FIELDS = new Set([
  'fullName', 'name', 'phoneNumber', 'phone', 'email', 'source',
  'programOfInterest', 'program', 'course', 'status', 'note',
  'careLogs', 'reminderAt', 'reminderNote', 'reminderCompleted', 'callbackReminder',
  'nextCallAt', 'next_call_at', 'statusHistory'
]);
const ALLOWED_INTERACTION_TYPES = new Set(['call', 'message', 'meeting', 'Gọi điện', 'Nhắn tin', 'Gặp mặt']);
const INTERACTION_TYPE_MAP = {
  call: 'Gọi điện',
  message: 'Nhắn tin',
  meeting: 'Gặp mặt',
  'Gọi điện': 'Gọi điện',
  'Nhắn tin': 'Nhắn tin',
  'Gặp mặt': 'Gặp mặt'
};
const SORT_FIELDS = {
  createdAt: 'createdAt',
  fullName: 'name',
  name: 'name',
  phone: 'phone',
  phoneNumber: 'phone',
  email: 'email',
  source: 'source',
  program: 'program',
  programOfInterest: 'program',
  reminderAt: 'reminderAt'
};

class LeadError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'LeadError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function getLeadsFile() {
  return process.env.CONSULTATION_LEADS_DATA_FILE || DEFAULT_LEADS_FILE;
}

function normalizePhoneNumber(value) {
  if (typeof value !== 'string') {
    throw new LeadError(400, 'INVALID_PHONE', 'Vui lòng nhập số điện thoại hợp lệ.');
  }
  const trimmed = value.trim();
  if (!trimmed || !/^\+?[\d\s().-]+$/.test(trimmed)) {
    throw new LeadError(400, 'INVALID_PHONE', 'Số điện thoại không đúng định dạng.');
  }

  const digits = trimmed.replace(/\D/g, '');
  let normalized = digits;
  if (digits.startsWith('0084')) normalized = `0${digits.slice(4)}`;
  else if (digits.startsWith('84') && digits.length > 2) normalized = `0${digits.slice(2)}`;

  if (normalized.length < 7 || normalized.length > 15) {
    throw new LeadError(400, 'INVALID_PHONE', 'Số điện thoại phải có từ 7 đến 15 chữ số.');
  }
  return normalized;
}

function readLeads() {
  const filePath = getLeadsFile();
  if (!fs.existsSync(filePath)) return [];

  let leads;
  try {
    leads = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Không thể đọc dữ liệu Lead: ${error.message}`);
  }
  if (!Array.isArray(leads) || leads.some(lead => !lead || typeof lead !== 'object' || Array.isArray(lead))) {
    throw new Error('Dữ liệu Lead phải có định dạng danh sách đối tượng.');
  }
  return leads;
}

function writeLeads(leads) {
  const filePath = getLeadsFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(leads, null, 2), 'utf8');
    fs.renameSync(temporaryFile, filePath);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function readString(value, field, { required = false, maxLength = 200 } = {}) {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string') {
    throw new LeadError(400, 'INVALID_INPUT', `${field} không hợp lệ.`);
  }
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maxLength) {
    throw new LeadError(400, 'INVALID_INPUT', `${field} ${required ? 'là bắt buộc' : `không được vượt quá ${maxLength} ký tự`}.`);
  }
  if (/[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new LeadError(400, 'INVALID_INPUT', `${field} không hợp lệ.`);
  }
  return normalized;
}

function readNote(value) {
  if (typeof value !== 'string') {
    throw new LeadError(400, 'INVALID_INPUT', 'Ghi chú không hợp lệ.');
  }
  const normalized = value.trim();
  if (normalized.length > 1000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(normalized)) {
    throw new LeadError(400, 'INVALID_INPUT', 'Ghi chú không hợp lệ.');
  }
  return normalized;
}

function readAliasedString(input, canonical, alias, field, options = {}) {
  const canonicalValue = input[canonical] === undefined
    ? undefined
    : readString(input[canonical], field, options);
  const aliasValue = input[alias] === undefined
    ? undefined
    : readString(input[alias], field, options);
  if (canonicalValue !== undefined && aliasValue !== undefined && canonicalValue !== aliasValue) {
    throw new LeadError(400, 'INVALID_INPUT', `Các trường ${canonical} và ${alias} phải giống nhau.`);
  }
  return canonicalValue ?? aliasValue;
}

function readAliasedPhone(input) {
  const canonicalValue = input.phoneNumber === undefined
    ? undefined
    : normalizePhoneNumber(input.phoneNumber);
  const aliasValue = input.phone === undefined
    ? undefined
    : normalizePhoneNumber(input.phone);
  if (canonicalValue !== undefined && aliasValue !== undefined && canonicalValue !== aliasValue) {
    throw new LeadError(400, 'INVALID_INPUT', 'Các trường phoneNumber và phone phải giống nhau.');
  }
  return canonicalValue ?? aliasValue;
}

function parseIsoDateTime(value, fieldName = 'Thời gian') {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new LeadError(400, 'INVALID_DATE', `${fieldName} không đúng định dạng thời gian.`);
  }
  return date.toISOString();
}

function validateReminderInput(input) {
  if (!input || typeof input !== 'object') {
    throw new LeadError(400, 'INVALID_INPUT', 'Dữ liệu lịch nhắc không hợp lệ.');
  }
  const reminderAtRaw = input.reminderAt ?? input.date;
  if (!reminderAtRaw) {
    throw new LeadError(400, 'INVALID_REMINDER', 'Thời điểm nhắc gọi lại là bắt buộc.');
  }
  const reminderAt = parseIsoDateTime(reminderAtRaw, 'Thời điểm nhắc gọi lại');
  const now = new Date();
  // Cho phép dung sai 60 giây đối với chênh lệch clock
  if (new Date(reminderAt).getTime() < now.getTime() - 60000) {
    throw new LeadError(400, 'PAST_REMINDER_DATE', 'Ngày nhắc gọi lại không được nhỏ hơn thời điểm hiện tại.');
  }
  const note = input.note !== undefined ? readString(input.note, 'Ghi chú lịch nhắc', { maxLength: 500 }) : '';
  return {
    reminderAt,
    note: note || '',
    isCompleted: false,
    createdAt: new Date().toISOString()
  };
}

function validateCareLogInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new LeadError(400, 'INVALID_INPUT', 'Dữ liệu nhật ký chăm sóc không hợp lệ.');
  }
  const typeRaw = input.type ?? input.interactionType;
  if (!typeRaw || typeof typeRaw !== 'string') {
    throw new LeadError(400, 'INVALID_INPUT', 'Loại tương tác là bắt buộc.');
  }
  const trimmedType = typeRaw.trim();
  if (!ALLOWED_INTERACTION_TYPES.has(trimmedType)) {
    throw new LeadError(400, 'INVALID_INTERACTION_TYPE', 'Loại tương tác phải là: Gọi điện, Nhắn tin hoặc Gặp mặt.');
  }
  const normalizedType = INTERACTION_TYPE_MAP[trimmedType];

  const content = readString(input.content ?? input.notes ?? input.note, 'Nội dung chăm sóc', { required: true, maxLength: 2000 });
  const interactionAtRaw = input.timestamp ?? input.interactionAt ?? input.time ?? new Date().toISOString();
  const timestamp = parseIsoDateTime(interactionAtRaw, 'Thời điểm chăm sóc');

  return {
    id: crypto.randomUUID(),
    type: normalizedType,
    rawType: trimmedType,
    content,
    timestamp,
    createdAt: new Date().toISOString()
  };
}

function validateLeadInput(input, { create }) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new LeadError(400, 'INVALID_INPUT', 'Thông tin Lead không hợp lệ.');
  }
  const unknownFields = Object.keys(input).filter(field => !ALLOWED_FIELDS.has(field));
  if (unknownFields.length) {
    throw new LeadError(400, 'INVALID_INPUT', `Trường không được hỗ trợ: ${unknownFields.join(', ')}.`);
  }
  if (!create && Object.keys(input).length === 0) {
    throw new LeadError(400, 'INVALID_INPUT', 'Cần cung cấp ít nhất một trường để cập nhật.');
  }

  const changes = {};
  const name = readAliasedString(input, 'fullName', 'name', 'Họ tên', { required: create });
  if (name !== undefined) {
    if (name.length < 2) throw new LeadError(400, 'INVALID_INPUT', 'Họ tên cần có ít nhất 2 ký tự.');
    changes.name = name;
  }

  const phone = readAliasedPhone(input);
  if (phone === undefined && create) {
    throw new LeadError(400, 'INVALID_PHONE', 'Số điện thoại là bắt buộc.');
  }
  if (phone !== undefined) changes.phone = phone;

  if (input.email !== undefined) {
    const email = readString(input.email ?? '', 'Email', { maxLength: 254 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
      throw new LeadError(400, 'INVALID_INPUT', 'Email không đúng định dạng.');
    }
    changes.email = email ? email.toLowerCase() : null;
  } else if (create) {
    changes.email = null;
  }

  if (input.source !== undefined || create) {
    changes.source = readString(input.source, 'Nguồn Lead', { required: true, maxLength: 100 });
  }

  const program = readAliasedString(input, 'programOfInterest', 'program', 'Chương trình quan tâm', {
    required: create,
    maxLength: 200
  });
  if (program !== undefined) changes.program = program;

  if (input.status !== undefined || create) {
    const statusValue = input.status === undefined ? 'Mới' : input.status;
    const status = readString(statusValue, 'Trạng thái', { required: true, maxLength: 50 });
    if (!ALLOWED_STATUSES.has(status)) {
      throw new LeadError(400, 'INVALID_INPUT', 'Trạng thái Lead không được hỗ trợ.');
    }
    changes.status = status;
  }

  if (input.note !== undefined || create) {
    changes.note = readNote(input.note === undefined ? '' : input.note);
  }
  return changes;
}

function checkIsOverdue(lead) {
  const reminder = lead.callbackReminder || (lead.reminderAt ? {
    reminderAt: lead.reminderAt,
    isCompleted: Boolean(lead.reminderCompleted)
  } : null);

  if (!reminder || !reminder.reminderAt || reminder.isCompleted) {
    return false;
  }
  const reminderTime = new Date(reminder.reminderAt).getTime();
  return !Number.isNaN(reminderTime) && reminderTime < Date.now();
}

function toLeadResponse(lead) {
  const name = lead.name ?? lead.fullName ?? '';
  const phone = lead.phone ?? lead.phoneNumber ?? '';
  const program = lead.program ?? lead.programOfInterest ?? '';
  const note = lead.note ?? lead.message ?? '';
  const careLogs = Array.isArray(lead.careLogs) ? lead.careLogs : [];
  
  // Chuẩn hóa cấu trúc callbackReminder
  let callbackReminder = lead.callbackReminder || null;
  if (!callbackReminder && lead.reminderAt) {
    callbackReminder = {
      reminderAt: lead.reminderAt,
      note: lead.reminderNote || '',
      isCompleted: Boolean(lead.reminderCompleted),
      completedAt: lead.reminderCompletedAt || null
    };
  }

  const isOverdue = checkIsOverdue(lead);
  const overdueStatus = isOverdue ? 'Quá hạn' : (callbackReminder && !callbackReminder.isCompleted ? 'Chờ gọi lại' : null);

  const course = lead.course || program;
  const nextCallAt = lead.nextCallAt || (callbackReminder ? callbackReminder.reminderAt : null);
  const statusHistory = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
  const assignedTo = lead.assignedTo ?? lead.assigned_to ?? lead.consultantId ?? null;
  const assignedConsultant = lead.assignedConsultant ?? lead.assigned_consultant ?? lead.consultant ?? null;

  return {
    ...lead,
    id: String(lead.id),
    name,
    fullName: name,
    phone,
    phoneNumber: phone,
    program,
    programOfInterest: program,
    course,
    nextCallAt,
    next_call_at: nextCallAt,
    updatedAt: lead.updatedAt || lead.createdAt || new Date().toISOString(),
    updated_at: lead.updatedAt || lead.createdAt || new Date().toISOString(),
    statusHistory,
    assignedTo,
    assigned_to: assignedTo,
    consultantId: assignedTo,
    assignedConsultant,
    assigned_consultant: assignedConsultant,
    note,
    careLogs,
    callbackReminder,
    reminderAt: callbackReminder ? callbackReminder.reminderAt : null,
    isOverdue,
    overdueStatus
  };
}

function matchesText(value, query) {
  return String(value ?? '').toLocaleLowerCase('vi').includes(query.toLocaleLowerCase('vi'));
}

function parseQueryValue(query, names) {
  const provided = names
    .filter(name => query[name] !== undefined)
    .map(name => {
      if (typeof query[name] !== 'string') {
        throw new LeadError(400, 'INVALID_QUERY', `Tham số "${name}" phải là một chuỗi.`);
      }
      return query[name];
    });
  if (provided.length > 1 && provided.some(value => value !== provided[0])) {
    throw new LeadError(400, 'INVALID_QUERY', `Các tham số ${names.join(' và ')} phải giống nhau.`);
  }
  const value = provided[0]?.trim();
  if (value && value.length > MAX_FILTER_LENGTH) {
    throw new LeadError(400, 'INVALID_QUERY', `Giá trị lọc không được vượt quá ${MAX_FILTER_LENGTH} ký tự.`);
  }
  return value || '';
}

function parsePositiveInteger(value, field, fallback, maximum) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new LeadError(400, 'INVALID_QUERY', `Tham số "${field}" phải là số nguyên dương.`);
  }
  const number = Number(value);
  if (!Number.isSafeInteger(number) || (maximum && number > maximum)) {
    throw new LeadError(400, 'INVALID_QUERY', `Tham số "${field}" vượt giới hạn cho phép.`);
  }
  return number;
}

function parseLeadListQuery(query) {
  const page = parsePositiveInteger(query.page, 'page', 1);
  if (query.limit !== undefined && query.pageSize !== undefined && query.limit !== query.pageSize) {
    throw new LeadError(400, 'INVALID_QUERY', 'Các tham số "limit" và "pageSize" phải giống nhau.');
  }
  const pageSize = parsePositiveInteger(query.pageSize ?? query.limit, 'pageSize', 20, MAX_PAGE_SIZE);
  if (!Number.isSafeInteger((page - 1) * pageSize)) {
    throw new LeadError(400, 'INVALID_QUERY', 'Tham số "page" vượt giới hạn cho phép.');
  }
  const sortByValue = query.sortBy ?? 'createdAt';
  if (typeof sortByValue !== 'string' || !Object.hasOwn(SORT_FIELDS, sortByValue)) {
    throw new LeadError(400, 'INVALID_QUERY', 'Trường sắp xếp không được hỗ trợ.');
  }
  const sortOrder = String(query.sortOrder ?? 'DESC').toUpperCase();
  if (sortOrder !== 'ASC' && sortOrder !== 'DESC') {
    throw new LeadError(400, 'INVALID_QUERY', 'Thứ tự sắp xếp phải là ASC hoặc DESC.');
  }

  return {
    page,
    pageSize,
    sortBy: SORT_FIELDS[sortByValue],
    sortOrder,
    filters: {
      search: parseQueryValue(query, ['q']),
      name: parseQueryValue(query, ['fullName', 'name']),
      phone: parseQueryValue(query, ['phone', 'phoneNumber']),
      email: parseQueryValue(query, ['email']),
      source: parseQueryValue(query, ['source']),
      program: parseQueryValue(query, ['program', 'programOfInterest']),
      status: parseQueryValue(query, ['status']),
      consultantId: parseQueryValue(query, ['consultantId', 'assignedTo'])
    }
  };
}

function getActiveAssignmentManager(actor) {
  if (!actor?.id || typeof actor.id !== 'string') {
    throw new LeadError(401, 'AUTHENTICATION_REQUIRED', 'Cần đăng nhập để phân công Lead.');
  }
  const user = UserModel.findById(actor.id);
  if (!user || user.status !== 'active') {
    throw new LeadError(401, 'AUTHENTICATION_REQUIRED', 'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.');
  }
  if (!UserModel.getRoles(user).some(role => ASSIGNMENT_MANAGER_ROLES.has(role))) {
    throw new LeadError(403, 'ASSIGNMENT_FORBIDDEN', 'Chỉ quản trị viên hoặc quản lý đào tạo mới được phân công Lead.');
  }
  return { id: user.id, name: user.name };
}

function getActiveConsultant(id) {
  if (typeof id !== 'string' || !id.trim() || id.length > MAX_FILTER_LENGTH) {
    throw new LeadError(400, 'INVALID_CONSULTANT', 'Mã tư vấn viên không hợp lệ.');
  }
  const consultant = UserModel.findById(id);
  if (!consultant || consultant.status !== 'active' || !UserModel.getRoles(consultant).includes('training_staff')) {
    throw new LeadError(404, 'CONSULTANT_NOT_FOUND', 'Tư vấn viên không tồn tại hoặc không hoạt động.');
  }
  return consultant;
}

function readAssignmentNote(value) {
  if (value === undefined || value === null) return '';
  return readNote(value);
}

function recordAssignment(lead, consultant, actor, note, timestamp) {
  const previousId = lead.assignedTo ?? lead.assigned_to ?? lead.consultantId ?? null;
  const previousUser = previousId ? UserModel.findById(String(previousId)) : null;
  const previousConsultant = lead.assignedConsultant
    ?? lead.assigned_consultant
    ?? lead.consultant
    ?? (previousUser ? { id: previousUser.id, name: previousUser.name } : null);
  const nextConsultant = { id: consultant.id, name: consultant.name };
  const history = Array.isArray(lead.assignmentHistory) ? lead.assignmentHistory : [];

  lead.assignedTo = consultant.id;
  lead.assignedConsultant = nextConsultant;
  delete lead.assigned_to;
  delete lead.assigned_consultant;
  delete lead.consultantId;
  lead.updatedAt = timestamp;
  lead.assignmentHistory = [{
    id: crypto.randomUUID(),
    leadId: String(lead.id),
    fromConsultant: previousConsultant,
    toConsultant: nextConsultant,
    performedBy: actor,
    note: note || null,
    transferredAt: timestamp
  }, ...history];
}

function phoneMatches(storedPhone, query) {
  const queryDigits = String(query).replace(/\D/g, '');
  if (!queryDigits) return matchesText(storedPhone, query);
  let normalizedQuery = queryDigits;
  if (queryDigits.startsWith('0084')) normalizedQuery = `0${queryDigits.slice(4)}`;
  else if (queryDigits.startsWith('84') && queryDigits.length > 2) normalizedQuery = `0${queryDigits.slice(2)}`;
  const storedDigits = String(storedPhone ?? '').replace(/\D/g, '');
  let normalizedStored = storedDigits;
  if (storedDigits.startsWith('0084')) normalizedStored = `0${storedDigits.slice(4)}`;
  else if (storedDigits.startsWith('84') && storedDigits.length > 2) normalizedStored = `0${storedDigits.slice(2)}`;
  return normalizedStored.includes(normalizedQuery);
}

class LeadModel {
  static list(query, user) {
    const parsed = parseLeadListQuery(query);
    const leads = readLeads().map(toLeadResponse);
    const { search, name, phone, email, source, program, status, consultantId } = parsed.filters;
    const roles = UserModel.getRoles(user);
    const isAssignmentManager = roles.some(role => ASSIGNMENT_MANAGER_ROLES.has(role));
    const assignedUserId = !isAssignmentManager && roles.includes('training_staff')
      ? String(user.id)
      : consultantId;
    const filtered = leads.filter(lead => (
      (!search || matchesText(lead.name, search) || phoneMatches(lead.phone, search) || matchesText(lead.email, search))
      && (!name || matchesText(lead.name, name))
      && (!phone || phoneMatches(lead.phone, phone))
      && (!email || matchesText(lead.email, email))
      && (!source || matchesText(lead.source, source))
      && (!program || matchesText(lead.program, program))
      && (!status || matchesText(lead.status, status))
      && (assignedUserId === 'unassigned'
        ? !lead.assignedTo
        : (!assignedUserId || String(lead.assignedTo || '') === assignedUserId))
    ));
    const direction = parsed.sortOrder === 'ASC' ? 1 : -1;
    filtered.sort((first, second) => {
      const comparison = String(first[parsed.sortBy] ?? '').localeCompare(
        String(second[parsed.sortBy] ?? ''),
        'vi',
        { sensitivity: 'base' }
      );
      return comparison === 0 ? String(first.id).localeCompare(String(second.id)) * direction : comparison * direction;
    });

    const board = LeadModel.getPipelineBoard(user, assignedUserId);
    const pagedItems = filtered.slice((parsed.page - 1) * parsed.pageSize, parsed.page * parsed.pageSize);
    return {
      items: pagedItems,
      data: pagedItems,
      pagination: {
        total: filtered.length,
        page: parsed.page,
        limit: parsed.pageSize,
        totalPages: Math.ceil(filtered.length / parsed.pageSize)
      },
      summary: {
        total: filtered.length,
        new: filtered.filter(lead => lead.status === 'Mới').length,
        consulting: filtered.filter(lead => lead.status === 'Đang tư vấn').length,
        converted: filtered.filter(lead => lead.status === 'Đã chuyển đổi' || lead.status === 'Chốt').length
      },
      statuses: board.statuses,
      counts: board.counts,
      leadsByStatus: board.leadsByStatus
    };
  }

  static findById(id) {
    const lead = readLeads().find(item => String(item.id) === String(id));
    if (!lead) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');
    return toLeadResponse(lead);
  }

  static checkPhone(phoneValue, excludingLeadId, user) {
    const phone = normalizePhoneNumber(phoneValue);
    const existing = readLeads()
      .map(toLeadResponse)
      .find(lead => lead.id !== String(excludingLeadId ?? '') && normalizePhoneNumber(lead.phone) === phone);
    const isManager = UserModel.getRoles(user).some(role => ASSIGNMENT_MANAGER_ROLES.has(role));
    const canViewExisting = !existing
      || isManager
      || (user?.id && String(existing.assignedTo || '') === String(user.id));
    return {
      isDuplicate: Boolean(existing),
      message: existing ? 'Số điện thoại này đã tồn tại trong hệ thống.' : 'Số điện thoại chưa được sử dụng.',
      ...(existing && canViewExisting ? {
        existing: {
          existingLeadId: existing.id,
          existingLeadName: existing.name,
          existingPhone: existing.phone
        }
      } : {})
    };
  }

  static create(input, actor) {
    const changes = validateLeadInput(input, { create: true });
    const leads = readLeads();
    const normalizedPhone = normalizePhoneNumber(changes.phone);
    const duplicate = leads.map(toLeadResponse).find(lead => normalizePhoneNumber(lead.phone) === normalizedPhone);
    if (duplicate) {
      throw new LeadError(409, 'DUPLICATE_PHONE_NUMBER', 'Số điện thoại này đã tồn tại trong hệ thống.', {
        existingLeadId: duplicate.id,
        existingLeadName: duplicate.name,
        existingPhone: duplicate.phone
      });
    }

    const timestamp = new Date().toISOString();
    const lead = {
      id: crypto.randomUUID(),
      ...changes,
      phone: normalizedPhone,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (UserModel.getRoles(actor).includes('training_staff') && actor.id) {
      const user = UserModel.findById(actor.id);
      if (user?.status === 'active' && UserModel.getRoles(user).includes('training_staff')) {
        lead.assignedTo = user.id;
        lead.assignedConsultant = { id: user.id, name: user.name };
        lead.assignmentHistory = [{
          id: crypto.randomUUID(),
          leadId: lead.id,
          fromConsultant: null,
          toConsultant: lead.assignedConsultant,
          performedBy: { id: user.id, name: user.name },
          note: 'Tự nhận lead khi tạo',
          transferredAt: timestamp
        }];
      }
    }
    leads.push(lead);
    writeLeads(leads);
    return toLeadResponse(lead);
  }

  static getActiveConsultants() {
    return UserModel.findActiveConsultants();
  }

  static reassignMany(leadIds, consultantId, actor, note = '') {
    if (!Array.isArray(leadIds) || leadIds.length < 1 || leadIds.length > 100
      || leadIds.some(id => typeof id !== 'string' || !id.trim() || id.length > MAX_FILTER_LENGTH)
      || new Set(leadIds).size !== leadIds.length) {
      throw new LeadError(400, 'INVALID_ASSIGNMENT', 'leadIds phải chứa từ 1 đến 100 mã Lead duy nhất.');
    }
    const normalizedNote = readAssignmentNote(note);
    const assigner = getActiveAssignmentManager(actor);
    const consultant = getActiveConsultant(consultantId);
    const leads = readLeads();
    const selected = leadIds.map(id => leads.find(lead => String(lead.id) === id));
    if (selected.some(lead => !lead)) {
      throw new LeadError(404, 'LEAD_NOT_FOUND', 'Một hoặc nhiều Lead không tồn tại.');
    }
    if (selected.some(lead => String(lead.assignedTo ?? lead.assigned_to ?? lead.consultantId ?? '') === consultant.id)) {
      throw new LeadError(409, 'ASSIGNMENT_UNCHANGED', 'Một hoặc nhiều Lead đã được giao cho tư vấn viên đã chọn.');
    }

    const timestamp = new Date().toISOString();
    for (const lead of selected) {
      recordAssignment(lead, consultant, assigner, normalizedNote, timestamp);
    }
    writeLeads(leads);
    return {
      assignedCount: selected.length,
      consultant: { id: consultant.id, name: consultant.name, email: consultant.email }
    };
  }

  static reassign(id, consultantId, actor, note = '') {
    const result = LeadModel.reassignMany([String(id)], consultantId, actor, note);
    return LeadModel.findById(id);
  }

  static getAssignmentHistory(id) {
    const lead = readLeads().find(item => String(item.id) === String(id));
    if (!lead) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');
    return (Array.isArray(lead.assignmentHistory) ? [...lead.assignmentHistory] : [])
      .sort((first, second) => new Date(second.transferredAt).getTime() - new Date(first.transferredAt).getTime());
  }

  static update(id, input) {
    const changes = validateLeadInput(input, { create: false });
    const leads = readLeads();
    const index = leads.findIndex(lead => String(lead.id) === String(id));
    if (index < 0) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');

    if (changes.phone !== undefined) {
      const duplicate = leads
        .filter(lead => String(lead.id) !== String(id))
        .map(toLeadResponse)
        .find(lead => normalizePhoneNumber(lead.phone) === changes.phone);
      if (duplicate) {
        throw new LeadError(409, 'DUPLICATE_PHONE_NUMBER', 'Số điện thoại này đã tồn tại trong hệ thống.', {
          existingLeadId: duplicate.id,
          existingLeadName: duplicate.name,
          existingPhone: duplicate.phone
        });
      }
    }

    const existing = leads[index];
    const updated = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    leads[index] = updated;
    writeLeads(leads);
    return toLeadResponse(updated);
  }

  static delete(id) {
    const leads = readLeads();
    const remaining = leads.filter(lead => String(lead.id) !== String(id));
    if (remaining.length === leads.length) return false;
    writeLeads(remaining);
    return true;
  }

  static deleteAll() {
    const leads = readLeads();
    writeLeads([]);
    return leads.length;
  }

  static addCareLog(id, input) {
    const careLog = validateCareLogInput(input);
    const leads = readLeads();
    const index = leads.findIndex(lead => String(lead.id) === String(id));
    if (index < 0) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');

    const lead = leads[index];
    if (!Array.isArray(lead.careLogs)) {
      lead.careLogs = [];
    }
    // Đưa log mới vào mảng
    lead.careLogs.push(careLog);

    // Nếu người dùng tiện đặt lịch nhắc trong cùng lượt gửi chăm sóc
    if (input.reminderAt) {
      const reminder = validateReminderInput({
        reminderAt: input.reminderAt,
        note: input.reminderNote || ''
      });
      lead.callbackReminder = reminder;
      lead.reminderAt = reminder.reminderAt;
      lead.reminderNote = reminder.note;
      lead.reminderCompleted = false;
    }

    lead.updatedAt = new Date().toISOString();
    leads[index] = lead;
    writeLeads(leads);

    return {
      log: careLog,
      lead: toLeadResponse(lead)
    };
  }

  static listCareLogs(id) {
    const lead = LeadModel.findById(id);
    const logs = [...(lead.careLogs || [])];
    // Sắp xếp mới nhất lên đầu theo timestamp hoặc createdAt
    logs.sort((a, b) => new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime());
    return logs;
  }

  static setReminder(id, input) {
    const reminder = validateReminderInput(input);
    const leads = readLeads();
    const index = leads.findIndex(lead => String(lead.id) === String(id));
    if (index < 0) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');

    const lead = leads[index];
    lead.callbackReminder = reminder;
    lead.reminderAt = reminder.reminderAt;
    lead.reminderNote = reminder.note;
    lead.reminderCompleted = false;
    lead.updatedAt = new Date().toISOString();

    leads[index] = lead;
    writeLeads(leads);
    return toLeadResponse(lead);
  }

  static completeReminder(id) {
    const leads = readLeads();
    const index = leads.findIndex(lead => String(lead.id) === String(id));
    if (index < 0) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');

    const lead = leads[index];
    if (!lead.callbackReminder && !lead.reminderAt) {
      throw new LeadError(400, 'NO_REMINDER_SET', 'Lead chưa được thiết lập lịch nhắc gọi lại.');
    }

    const completedAt = new Date().toISOString();
    if (lead.callbackReminder) {
      lead.callbackReminder.isCompleted = true;
      lead.callbackReminder.completedAt = completedAt;
    }
    lead.reminderCompleted = true;
    lead.reminderCompletedAt = completedAt;
    lead.updatedAt = completedAt;

    leads[index] = lead;
    writeLeads(leads);
    return toLeadResponse(lead);
  }

  static removeReminder(id) {
    const leads = readLeads();
    const index = leads.findIndex(lead => String(lead.id) === String(id));
    if (index < 0) throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy Lead.');

    const lead = leads[index];
    lead.callbackReminder = null;
    delete lead.reminderAt;
    delete lead.reminderNote;
    delete lead.reminderCompleted;
    delete lead.reminderCompletedAt;
    lead.updatedAt = new Date().toISOString();

    leads[index] = lead;
    writeLeads(leads);
    return toLeadResponse(lead);
  }

  static getPipelineBoard(user, consultantId) {
    const roles = UserModel.getRoles(user);
    const isAssignmentManager = roles.some(role => ASSIGNMENT_MANAGER_ROLES.has(role));
    const assignedUserId = !isAssignmentManager && roles.includes('training_staff')
      ? String(user.id)
      : consultantId;
    const leads = readLeads()
      .map(toLeadResponse)
      .filter(lead => assignedUserId === 'unassigned'
        ? !lead.assignedTo
        : (!assignedUserId || String(lead.assignedTo || '') === assignedUserId));
    leads.sort((a, b) => {
      const aTime = a.nextCallAt ? new Date(a.nextCallAt).getTime() : null;
      const bTime = b.nextCallAt ? new Date(b.nextCallAt).getTime() : null;
      if (aTime !== null && bTime === null) return -1;
      if (aTime === null && bTime !== null) return 1;
      if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime;
      return String(a.name || '').localeCompare(String(b.name || ''), 'vi');
    });

    const leadsByStatus = Object.fromEntries(
      PIPELINE_STATUSES.map(status => [status, []])
    );

    for (const lead of leads) {
      let s = lead.status;
      if (s === 'Đã chuyển đổi') s = 'Chốt';
      else if (s === 'Không tiềm năng') s = 'Từ chối';

      if (leadsByStatus[s]) {
        leadsByStatus[s].push(lead);
      } else {
        leadsByStatus['Mới'].push(lead);
      }
    }

    const counts = Object.fromEntries(
      PIPELINE_STATUSES.map(status => [status, leadsByStatus[status].length])
    );

    return {
      statuses: PIPELINE_STATUSES,
      counts,
      leadsByStatus
    };
  }

  static updateStatus(id, input, actor = 'Tư vấn viên', scopeUser) {
    if (!id || (typeof id === 'number' && id < 1)) {
      throw new LeadError(400, 'INVALID_ID', 'Mã lead không hợp lệ.');
    }
    const toStatus = input?.status;
    if (!toStatus || !PIPELINE_STATUSES.includes(toStatus)) {
      throw new LeadError(400, 'INVALID_STATUS', 'Trạng thái lead không hợp lệ.');
    }

    const changedBy = (typeof input?.changedBy === 'string' && input.changedBy.trim())
      ? input.changedBy.trim()
      : (actor?.trim() || process.env.DEFAULT_ACTOR_NAME?.trim() || 'Tư vấn viên');
    if (!changedBy) {
      throw new LeadError(400, 'MISSING_ACTOR', 'Vui lòng cung cấp người thực hiện.');
    }

    const reason = typeof input?.reason === 'string' ? input.reason.trim() : '';
    if (toStatus === 'Từ chối' && (!reason || !REJECTION_REASONS.includes(reason))) {
      throw new LeadError(400, 'INVALID_REJECTION_REASON', 'Vui lòng chọn một lý do từ chối hợp lệ.');
    }
    if (toStatus !== 'Từ chối' && reason) {
      throw new LeadError(400, 'UNEXPECTED_REASON', 'Chỉ trạng thái Từ chối mới nhận lý do từ chối.');
    }

    const leads = readLeads();
    const index = leads.findIndex(item => String(item.id) === String(id));
    if (index < 0) {
      throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy lead.');
    }

    const lead = leads[index];
    if (lead.status === toStatus) {
      throw new LeadError(409, 'STATUS_UNCHANGED', 'Lead đã ở trạng thái này.');
    }

    const changedAt = new Date().toISOString();
    const historyItem = {
      id: Array.isArray(lead.statusHistory) ? lead.statusHistory.length + 1 : 1,
      leadId: Number(lead.id) || lead.id,
      fromStatus: lead.status || null,
      toStatus,
      reason: reason || null,
      changedAt,
      changedBy
    };

    lead.status = toStatus;
    lead.updatedAt = changedAt;
    lead.statusHistory = [historyItem, ...(Array.isArray(lead.statusHistory) ? lead.statusHistory : [])];

    leads[index] = lead;
    writeLeads(leads);

    return {
      history: historyItem,
      board: LeadModel.getPipelineBoard(scopeUser)
    };
  }

  static getLeadHistory(id) {
    if (!id || (typeof id === 'number' && id < 1)) {
      throw new LeadError(400, 'INVALID_ID', 'Mã lead không hợp lệ.');
    }
    const leads = readLeads();
    const lead = leads.find(item => String(item.id) === String(id));
    if (!lead) {
      throw new LeadError(404, 'LEAD_NOT_FOUND', 'Không tìm thấy lead.');
    }
    const history = Array.isArray(lead.statusHistory) ? [...lead.statusHistory] : [];
    history.sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
    return history;
  }
}

module.exports = {
  LeadError,
  LeadModel,
  normalizePhoneNumber,
  validateCareLogInput,
  validateReminderInput,
  PIPELINE_STATUSES,
  REJECTION_REASONS
};
