'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const { ConsultationLeadError, ConsultationLeadModel } = require('./backend/consultationLeadModel');
const {
  createConsultationRateLimiter
} = require('./backend/consultationLeadRateLimit');

const featureRoot = __dirname;
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4177);
process.env.CONSULTATION_LEADS_DATA_FILE ||= path.join(featureRoot, 'data', 'consultation-leads.json');

const rateLimiter = createConsultationRateLimiter();
const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8'
};

function sendJson(res, status, body, headers = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > 16 * 1024) {
        reject(new Error('Nội dung yêu cầu vượt quá giới hạn 16 KB.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const value = JSON.parse(body);
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
          return reject(new Error('Nội dung yêu cầu phải là một đối tượng JSON.'));
        }
        return resolve(value);
      } catch {
        return reject(new Error('Nội dung yêu cầu không phải JSON hợp lệ.'));
      }
    });
    req.on('error', reject);
  });
}

function serveFile(res, filename) {
  const filePath = path.join(featureRoot, 'frontend', filename);
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, {
        success: false,
        code: 'PREVIEW_FILE_NOT_FOUND',
        message: 'Không tìm thấy tệp giao diện.'
      });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(content);
  });
}

function handlePost(req, res, body) {
  const address = req.socket.remoteAddress || 'unknown';
  let rateLimited = false;
  const fakeResponse = {
    headers: {},
    set(name, value) {
      this.headers[name] = value;
      return this;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(value) {
      rateLimited = true;
      sendJson(res, this.statusCode, value, this.headers);
    }
  };
  rateLimiter({ ip: address }, fakeResponse, () => {});
  if (rateLimited) return;

  if (typeof body.website === 'string' && body.website.trim()) {
    sendJson(res, 201, {
      success: true,
      data: { received: true },
      message: 'Cảm ơn bạn đã đăng ký tư vấn.'
    });
    return;
  }

  try {
    const lead = ConsultationLeadModel.create(body);
    sendJson(res, 201, {
      success: true,
      data: { id: lead.id, status: lead.status },
      message: 'Cảm ơn bạn đã đăng ký tư vấn. Trung tâm sẽ liên hệ lại trong vòng 1 ngày làm việc.'
    });
  } catch (error) {
    if (error instanceof ConsultationLeadError) {
      sendJson(res, error.status, { success: false, code: error.code, message: error.message });
      return;
    }
    console.error('Không thể lưu đăng ký tư vấn:', error);
    sendJson(res, 500, {
      success: false,
      code: 'CONSULTATION_LEAD_SAVE_FAILED',
      message: 'Chưa thể tiếp nhận đăng ký lúc này. Vui lòng thử lại sau.'
    });
  }
}

function createPreviewServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${host}:${port}`);
    if (req.method === 'GET' && url.pathname === '/') {
      serveFile(res, 'consultation-form.html');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/features/consultation-registration/frontend/consultation-form.css') {
      serveFile(res, 'consultation-form.css');
      return;
    }
    if (req.method === 'GET' && url.pathname === '/features/consultation-registration/frontend/consultation-form.js') {
      serveFile(res, 'consultation-form.js');
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/consultation-leads') {
      try {
        handlePost(req, res, await readBody(req));
      } catch (error) {
        const isInvalidBody = /Nội dung yêu cầu/.test(error.message);
        sendJson(res, isInvalidBody ? 400 : 500, {
          success: false,
          code: isInvalidBody ? 'INVALID_REQUEST_BODY' : 'CONSULTATION_LEAD_SAVE_FAILED',
          message: isInvalidBody ? error.message : 'Chưa thể tiếp nhận đăng ký lúc này. Vui lòng thử lại sau.'
        });
      }
      return;
    }
    sendJson(res, 404, {
      success: false,
      code: 'PREVIEW_ROUTE_NOT_FOUND',
      message: 'Không tìm thấy trang hoặc API.'
    });
  });
}

if (require.main === module) {
  const server = createPreviewServer();
  server.listen(port, host, () => {
    console.log(`Trang đăng ký tư vấn thử nghiệm: http://${host}:${port}`);
  });
}

module.exports = { createPreviewServer };
