'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');

const featureRoot = __dirname;
const host = '127.0.0.1';
const port = Number(process.env.PORT || 4176);

process.env.COURSE_SESSIONS_DATA_FILE = path.join(featureRoot, 'data', 'preview-course-sessions.json');
process.env.COURSE_CATALOG_DATA_FILE = path.join(featureRoot, 'data', 'preview-courses.json');

const { CourseSessionsError, CourseSessionsModel } = require('./backend/courseSessionsModel');
const courseCatalog = JSON.parse(fs.readFileSync(process.env.COURSE_CATALOG_DATA_FILE, 'utf8'));

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
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

function serveFile(res, filename) {
  const filePath = path.join(featureRoot, 'frontend', filename);
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8'
  };
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

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${host}:${port}`);
  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);

  if (req.method === 'GET' && url.pathname === '/') {
    serveFile(res, 'course-sessions.html');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/features/course-sessions/frontend/course-sessions.css') {
    serveFile(res, 'course-sessions.css');
    return;
  }
  if (req.method === 'GET' && url.pathname === '/features/course-sessions/frontend/course-sessions.js') {
    serveFile(res, 'course-sessions.js');
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

  if (segments[0] === 'api' && segments[1] === 'course-sessions' && segments.length >= 3) {
    const courseId = segments[2];
    const tail = segments.slice(3);
    let data;
    let message;

    if (req.method === 'GET' && tail.length === 1 && tail[0] === 'sessions') {
      data = CourseSessionsModel.list(courseId);
      message = 'Đã tải danh sách buổi học.';
    } else if (req.method === 'POST' && tail.length === 1 && tail[0] === 'sessions') {
      data = CourseSessionsModel.create(courseId, await readBody(req));
      message = 'Đã khai báo buổi học.';
    } else if (
      req.method === 'POST'
      && tail.length === 2
      && tail[0] === 'sessions'
      && tail[1] === 'clone'
    ) {
      const body = await readBody(req);
      data = CourseSessionsModel.clone(body.sourceCourseId, courseId);
      message = 'Đã nhân bản danh sách buổi học.';
    } else if (req.method === 'PUT' && tail.length === 2 && tail[0] === 'sessions') {
      data = CourseSessionsModel.update(courseId, Number(tail[1]), await readBody(req));
      message = 'Đã cập nhật buổi học.';
    } else if (req.method === 'DELETE' && tail.length === 2 && tail[0] === 'sessions') {
      data = CourseSessionsModel.remove(courseId, Number(tail[1]));
      message = 'Đã xoá buổi học.';
    } else {
      sendJson(res, 404, {
        success: false,
        code: 'PREVIEW_ROUTE_NOT_FOUND',
        message: 'Không tìm thấy API thử nghiệm.'
      });
      return;
    }

    sendJson(res, req.method === 'POST' && tail.length === 1 ? 201 : 200, {
      success: true,
      data,
      message
    });
    return;
  }

  sendJson(res, 404, {
    success: false,
    code: 'PREVIEW_ROUTE_NOT_FOUND',
    message: 'Không tìm thấy trang hoặc API.'
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => {
    if (error instanceof CourseSessionsError) {
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
  console.log('Lưu ý: máy chủ này chỉ để thử nghiệm cục bộ, không có đăng nhập.');
});

server.on('error', error => {
  console.error(`Không thể khởi động máy chủ thử nghiệm: ${error.message}`);
  process.exitCode = 1;
});
