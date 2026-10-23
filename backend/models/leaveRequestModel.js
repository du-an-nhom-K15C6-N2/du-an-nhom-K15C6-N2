const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');
const AttendanceModel = require('./attendanceModel');
const NotificationModel = require('./notificationModel');

function getDataFile() {
  return process.env.LEAVE_REQUESTS_DATA_FILE
    || config.LEAVE_REQUESTS_DATA_FILE
    || path.resolve(__dirname, '../data/leave-requests.json');
}

function readRequests() {
  const file = getDataFile();
  if (!fs.existsSync(file)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch (error) {
    return [];
  }
}

function writeRequests(items) {
  const file = getDataFile();
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(items, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, file);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

class LeaveRequestModel {
  static listForStudent(studentId) {
    return readRequests()
      .filter(item => String(item.studentId) === String(studentId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static listForReviewer({ classId, status, search } = {}) {
    let list = readRequests();

    if (classId) {
      list = list.filter(item => String(item.classId) === String(classId) || item.className.toLowerCase() === classId.toLowerCase());
    }

    if (status && status !== 'all') {
      list = list.filter(item => item.status === status);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(item =>
        item.studentName?.toLowerCase().includes(q)
        || item.studentEmail?.toLowerCase().includes(q)
        || item.className?.toLowerCase().includes(q)
        || item.reason?.toLowerCase().includes(q)
      );
    }

    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  static findById(id) {
    return readRequests().find(item => String(item.id) === String(id)) || null;
  }

  static create(data) {
    const requests = readRequests();

    // Kiểm tra trùng đơn
    const duplicate = requests.find(item =>
      String(item.studentId) === String(data.studentId)
      && item.className.toLowerCase() === data.className.toLowerCase()
      && item.leaveDate === data.leaveDate
      && ['pending', 'approved'].includes(item.status)
    );

    if (duplicate) {
      const error = new Error(
        duplicate.status === 'approved'
          ? 'Bạn đã được duyệt nghỉ phép cho ngày này rồi.'
          : 'Bạn đã có một đơn xin nghỉ phép đang chờ duyệt cho lớp và ngày này.'
      );
      error.statusCode = 409;
      error.code = 'DUPLICATE_LEAVE_REQUEST';
      throw error;
    }

    const newRequest = {
      id: crypto.randomUUID(),
      studentId: data.studentId,
      studentName: data.studentName,
      studentEmail: data.studentEmail,
      classId: data.classId || null,
      className: data.className,
      lessonId: data.lessonId || null,
      lessonNumber: data.lessonNumber || null,
      leaveDate: data.leaveDate,
      reason: data.reason.trim(),
      evidence: data.evidence ? data.evidence.trim() : '',
      status: 'pending', // 'pending' | 'approved' | 'rejected' | 'cancelled'
      reviewNote: '',
      reviewedBy: null,
      reviewedByName: '',
      reviewedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    requests.push(newRequest);
    writeRequests(requests);

    // Gửi thông báo xác nhận đã nộp đơn
    try {
      NotificationModel.create({
        type: 'leave_request_submitted',
        recipientId: data.studentId,
        recipientRole: 'STUDENT',
        classId: data.classId || null,
        subject: `Đã nộp đơn xin phép vắng - ${data.className}`,
        message: `Đơn xin phép vắng ngày ${data.leaveDate} của bạn đã được gửi thành công và đang chờ xét duyệt.`,
        body: `Lý do: ${data.reason.trim()}`
      });
    } catch (e) {
      console.warn('Không thể tạo thông báo nộp đơn:', e.message);
    }

    return newRequest;
  }

  static cancel(id, studentId) {
    const requests = readRequests();
    const index = requests.findIndex(item => String(item.id) === String(id));

    if (index === -1) {
      const error = new Error('Không tìm thấy đơn xin nghỉ phép.');
      error.statusCode = 404;
      throw error;
    }

    const item = requests[index];
    if (String(item.studentId) !== String(studentId)) {
      const error = new Error('Bạn không có quyền huỷ đơn này.');
      error.statusCode = 403;
      throw error;
    }

    if (item.status !== 'pending') {
      const error = new Error(`Chỉ có thể huỷ đơn khi đang ở trạng thái chờ duyệt. Trạng thái hiện tại: ${item.status}.`);
      error.statusCode = 400;
      throw error;
    }

    item.status = 'cancelled';
    item.updatedAt = new Date().toISOString();
    writeRequests(requests);
    return item;
  }

  static review(id, { status, reviewNote = '', reviewerUser }) {
    if (!['approved', 'rejected'].includes(status)) {
      const error = new Error('Trạng thái duyệt không hợp lệ. Chỉ chấp nhận approved hoặc rejected.');
      error.statusCode = 400;
      throw error;
    }

    const requests = readRequests();
    const index = requests.findIndex(item => String(item.id) === String(id));

    if (index === -1) {
      const error = new Error('Không tìm thấy đơn xin nghỉ phép.');
      error.statusCode = 404;
      throw error;
    }

    const item = requests[index];
    item.status = status;
    item.reviewNote = reviewNote.trim();
    item.reviewedBy = reviewerUser.id;
    item.reviewedByName = reviewerUser.name || reviewerUser.fullName || reviewerUser.email;
    item.reviewedAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();

    writeRequests(requests);

    // XỬ LÝ NGHIỆP VỤ QUAN TRỌNG:
    // Khi được duyệt -> Tự động ghi nhận điểm danh là 'excused' (Có phép),
    // giúp học viên không bị tính là vắng không phép (absent).
    if (status === 'approved') {
      try {
        AttendanceModel.upsertExcusedAbsence({
          className: item.className,
          studentId: item.studentId,
          studentName: item.studentName,
          studentEmail: item.studentEmail,
          attendanceDate: item.leaveDate,
          lessonId: item.lessonId,
          note: item.reason,
          reviewerId: reviewerUser.id,
          reviewerName: item.reviewedByName
        });
      } catch (e) {
        console.warn('Lỗi tự động đồng bộ điểm danh có phép:', e.message);
      }
    }

    // Gửi thông báo kết quả duyệt cho học viên
    try {
      const isApproved = status === 'approved';
      const subject = isApproved
        ? `Đơn xin nghỉ phép đã được duyệt - ${item.className}`
        : `Đơn xin nghỉ phép đã bị từ chối - ${item.className}`;
      const message = isApproved
        ? `Đơn xin phép vắng ngày ${item.leaveDate} của bạn đã được duyệt bởi ${item.reviewedByName}. Bạn đã được ghi nhận Nghỉ có phép (không tính vắng không phép).`
        : `Đơn xin phép vắng ngày ${item.leaveDate} của bạn bị từ chối bởi ${item.reviewedByName}.${item.reviewNote ? ` Lý do: ${item.reviewNote}` : ''}`;

      NotificationModel.create({
        type: isApproved ? 'leave_request_approved' : 'leave_request_rejected',
        recipientId: item.studentId,
        recipientRole: 'STUDENT',
        classId: item.classId,
        lessonId: item.lessonId,
        subject,
        message,
        body: item.reviewNote || item.reason
      });
    } catch (e) {
      console.warn('Không thể gửi thông báo duyệt đơn:', e.message);
    }

    return item;
  }
}

module.exports = LeaveRequestModel;
