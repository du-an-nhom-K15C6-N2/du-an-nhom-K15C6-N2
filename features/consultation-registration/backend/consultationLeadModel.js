'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LEADS_FILE = path.resolve(__dirname, '../data/consultation-leads.json');
const MAX_NAME_LENGTH = 100;
const MAX_PROGRAM_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 254;

class ConsultationLeadError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ConsultationLeadError';
    this.status = status;
    this.code = code;
  }
}

function leadsFile() {
  return process.env.CONSULTATION_LEADS_DATA_FILE || DEFAULT_LEADS_FILE;
}

function readLeads() {
  const filePath = leadsFile();
  if (!fs.existsSync(filePath)) return [];

  let leads;
  try {
    leads = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`Không thể đọc dữ liệu đăng ký tư vấn: ${error.message}`);
  }
  if (!Array.isArray(leads)) {
    throw new Error('Dữ liệu đăng ký tư vấn phải có định dạng danh sách.');
  }
  return leads;
}

function writeLeads(leads) {
  const filePath = leadsFile();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryFile = `${filePath}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporaryFile, JSON.stringify(leads, null, 2), 'utf8');
    fs.renameSync(temporaryFile, filePath);
  } finally {
    if (fs.existsSync(temporaryFile)) fs.unlinkSync(temporaryFile);
  }
}

function validateOptionalText(value, fieldName, maxLength) {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') {
    throw new ConsultationLeadError(400, 'INVALID_INPUT', `${fieldName} không hợp lệ.`);
  }
  const normalized = value.trim().replace(/\s+/gu, ' ');
  if (normalized.length > maxLength) {
    throw new ConsultationLeadError(
      400,
      'INVALID_INPUT',
      `${fieldName} không được vượt quá ${maxLength} ký tự.`
    );
  }
  return normalized;
}

function normalizePhone(value) {
  if (typeof value !== 'string') {
    throw new ConsultationLeadError(400, 'INVALID_PHONE', 'Vui lòng nhập số điện thoại hợp lệ.');
  }

  const compact = value.trim().replace(/[\s().-]/gu, '');
  let nationalNumber;
  if (/^(\+?84|0084)/u.test(compact)) {
    nationalNumber = compact.replace(/^(\+84|84|0084)/u, '');
  } else if (/^0/u.test(compact)) {
    nationalNumber = compact.slice(1);
  } else {
    throw new ConsultationLeadError(
      400,
      'INVALID_PHONE',
      'Số điện thoại cần bắt đầu bằng 0 hoặc mã quốc gia +84.'
    );
  }

  if (!/^[1-9]\d{8}$/u.test(nationalNumber)) {
    throw new ConsultationLeadError(400, 'INVALID_PHONE', 'Vui lòng nhập số điện thoại Việt Nam gồm 10 chữ số.');
  }
  return `+84${nationalNumber}`;
}

function validateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ConsultationLeadError(400, 'INVALID_INPUT', 'Thông tin đăng ký tư vấn không hợp lệ.');
  }
  if (input.consent !== true) {
    throw new ConsultationLeadError(
      400,
      'CONSENT_REQUIRED',
      'Vui lòng đồng ý để trung tâm sử dụng thông tin nhằm liên hệ tư vấn.'
    );
  }

  const name = validateOptionalText(input.name, 'Họ và tên', MAX_NAME_LENGTH);
  if (name.length < 2 || /[\u0000-\u001f\u007f]/u.test(name)) {
    throw new ConsultationLeadError(400, 'INVALID_NAME', 'Vui lòng nhập họ và tên từ 2 đến 100 ký tự.');
  }

  const phone = normalizePhone(input.phone);
  const email = validateOptionalText(input.email, 'Email', MAX_EMAIL_LENGTH).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/u.test(email)) {
    throw new ConsultationLeadError(400, 'INVALID_EMAIL', 'Vui lòng nhập địa chỉ email hợp lệ.');
  }

  return {
    name,
    phone,
    email: email || null,
    program: validateOptionalText(input.program, 'Chương trình quan tâm', MAX_PROGRAM_LENGTH),
    message: validateOptionalText(input.message, 'Lời nhắn', MAX_MESSAGE_LENGTH)
  };
}

class ConsultationLeadModel {
  static create(input) {
    const contact = validateInput(input);
    const createdAt = new Date().toISOString();
    const lead = {
      id: crypto.randomUUID(),
      ...contact,
      status: 'Mới',
      source: 'consultation-form',
      createdAt,
      consentedAt: createdAt
    };
    const leads = readLeads();
    leads.push(lead);
    writeLeads(leads);
    return { ...lead };
  }
}

module.exports = { ConsultationLeadError, ConsultationLeadModel, normalizePhone };
