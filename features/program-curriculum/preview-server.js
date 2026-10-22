'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const featureRoot = __dirname;
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4175);

process.env.PROGRAM_CURRICULA_DATA_FILE = path.join(featureRoot, 'data', 'preview-program-curricula.json');
process.env.COURSE_CATALOG_DATA_FILE = path.join(featureRoot, 'data', 'preview-courses.json');

const { ProgramCurriculumError, ProgramCurriculumModel } = require('./backend/programCurriculumModel');
const courseCatalog = JSON.parse(fs.readFileSync(process.env.COURSE_CATALOG_DATA_FILE, 'utf8'));

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('Nội dung yêu cầu vượt quá giới hạn 1 MB.'));
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

function servePage(res, relativePath) {
  const filePath = path.join(featureRoot, 'frontend', relativePath);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
  };
  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { success: false, code: 'PREVIEW_FILE_NOT_FOUND', message: 'Không tìm thấy tệp giao diện.' });
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(content);
  });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${host}:${port}`);
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (req.method === 'GET' && url.pathname === '/') {
    servePage(res, 'program-curriculum.html');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/features/program-curriculum/frontend/program-curriculum.css') {
    servePage(res, 'program-curriculum.css');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/features/program-curriculum/frontend/program-curriculum.js') {
    servePage(res, 'program-curriculum.js');
    return;
  }

  if (req.method === 'GET' && segments[0] === 'api' && segments[1] === 'courses') {
    const page = Number(url.searchParams.get('page') || 1);
    const pageSize = Number(url.searchParams.get('pageSize') || 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
      sendJson(res, 400, {
        success: false,
        code: 'INVALID_PAGINATION',
        message: 'Trang phải từ 1 trở lên và số môn mỗi trang phải từ 1 đến 100.'
      });
      return;
    }
    const offset = (page - 1) * pageSize;
    sendJson(res, 200, {
      success: true,
      data: {
        items: courseCatalog.slice(offset, offset + pageSize),
        pagination: {
          page,
          pageSize,
          total: courseCatalog.length,
          totalPages: Math.ceil(courseCatalog.length / pageSize)
        }
      },
      message: 'Đã tải danh mục môn học mẫu.'
    });
    return;
  }

  if (segments[0] === 'api' && segments[1] === 'program-curricula' && segments.length >= 3) {
    const programId = segments[2];
    const tail = segments.slice(3);
    let data;
    let message;

    if (req.method === 'GET' && tail.length === 1 && tail[0] === 'courses') {
      data = ProgramCurriculumModel.list(programId);
      message = 'Đã tải lộ trình môn học của chương trình.';
    } else if (req.method === 'POST' && tail.length === 1 && tail[0] === 'courses') {
      const body = await readBody(req);
      data = ProgramCurriculumModel.addCourse(programId, body.courseId);
      message = 'Đã gắn môn học vào chương trình.';
    } else if (req.method === 'PUT' && tail.length === 2 && tail[0] === 'courses' && tail[1] === 'order') {
      const body = await readBody(req);
      data = ProgramCurriculumModel.reorder(programId, body.courseIds);
      message = 'Đã lưu thứ tự môn học.';
    } else if (
      req.method === 'PUT'
      && tail.length === 3
      && tail[0] === 'courses'
      && tail[2] === 'prerequisites'
    ) {
      const body = await readBody(req);
      data = ProgramCurriculumModel.setPrerequisites(programId, tail[1], body.prerequisiteIds);
      message = 'Đã cập nhật môn tiên quyết.';
    } else if (req.method === 'DELETE' && tail.length === 2 && tail[0] === 'courses') {
      data = ProgramCurriculumModel.removeCourse(programId, tail[1]);
      message = 'Đã gỡ môn học khỏi chương trình.';
    } else {
      sendJson(res, 404, { success: false, code: 'PREVIEW_ROUTE_NOT_FOUND', message: 'Không tìm thấy API thử nghiệm.' });
      return;
    }

    sendJson(res, req.method === 'POST' ? 201 : 200, { success: true, data, message });
    return;
  }

  sendJson(res, 404, { success: false, code: 'PREVIEW_ROUTE_NOT_FOUND', message: 'Không tìm thấy trang hoặc API.' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => {
    if (error instanceof ProgramCurriculumError) {
      sendJson(res, error.status, { success: false, code: error.code, message: error.message });
      return;
    }
    const isInvalidBody = error instanceof SyntaxError || /Nội dung yêu cầu/.test(error.message);
    sendJson(res, isInvalidBody ? 400 : 500, {
      success: false,
      code: isInvalidBody ? 'INVALID_REQUEST_BODY' : 'PREVIEW_SERVER_ERROR',
      message: error.message
    });
  });
});

server.listen(port, host, () => {
  console.log(`Bản thử nghiệm đang chạy tại http://${host}:${port}`);
  console.log('Mã chương trình mẫu: CNTT-2026');
  console.log('Lưu ý: máy chủ này chỉ để thử nghiệm cục bộ, không có đăng nhập.');
});

server.on('error', error => {
  console.error(`Không thể khởi động máy chủ thử nghiệm: ${error.message}`);
  process.exitCode = 1;
});
