const ClassroomModel = require('../models/classroomModel');
const ClassModel = require('../models/classModel');

const URL_PROTOCOLS = new Set(['http:', 'https:']);

function validateRoomPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Thông tin phòng học phải là object JSON.' };
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name || name.length > 120) {
    return { error: 'Tên phòng học là bắt buộc và không vượt quá 120 ký tự.' };
  }
  if (!['physical', 'online'].includes(body.type)) {
    return { error: 'Loại phòng học phải là physical hoặc online.' };
  }

  if (body.type === 'physical') {
    if (!Number.isSafeInteger(body.capacity) || body.capacity < 1) {
      return { error: 'Sức chứa phòng vật lý phải là số nguyên dương.' };
    }
    return { value: { name, type: 'physical', capacity: body.capacity, meetingUrl: null } };
  }

  let meetingUrl;
  try {
    meetingUrl = new URL(typeof body.meetingUrl === 'string' ? body.meetingUrl.trim() : '');
  } catch {
    return { error: 'Vui lòng nhập liên kết phòng học trực tuyến hợp lệ.' };
  }
  if (!URL_PROTOCOLS.has(meetingUrl.protocol) || !meetingUrl.hostname) {
    return { error: 'Liên kết phòng học trực tuyến phải sử dụng HTTP hoặc HTTPS.' };
  }
  return { value: { name, type: 'online', capacity: null, meetingUrl: meetingUrl.toString() } };
}

function statusFor(error) {
  if (error.code === 'ROOM_NOT_FOUND' || error.code === 'CLASS_NOT_FOUND') return 404;
  if (error.code === 'ROOM_NAME_EXISTS') return 409;
  if (error.code === 'ROOM_CAPACITY_EXCEEDED' || error.code === 'ROOM_IN_USE') return 409;
  return 400;
}

function createClassroomController({ rooms = ClassroomModel, classes = ClassModel } = {}) {
  return {
    list(req, res, next) {
      try {
        return res.status(200).json({ success: true, data: rooms.list() });
      } catch (error) {
        return next(error);
      }
    },

    create(req, res, next) {
      const parsed = validateRoomPayload(req.body);
      if (parsed.error) {
        return res.status(400).json({ success: false, code: 'INVALID_ROOM', message: parsed.error });
      }
      try {
        const data = rooms.create(parsed.value);
        return res.status(201).json({ success: true, data, message: 'Đã tạo phòng học.' });
      } catch (error) {
        if (error.code) {
          return res.status(statusFor(error)).json({ success: false, code: error.code, message: error.message });
        }
        return next(error);
      }
    },

    update(req, res, next) {
      const parsed = validateRoomPayload(req.body);
      if (parsed.error) {
        return res.status(400).json({ success: false, code: 'INVALID_ROOM', message: parsed.error });
      }
      try {
        const current = rooms.findById(req.params.id);
        if (!current) {
          return res.status(404).json({ success: false, code: 'ROOM_NOT_FOUND', message: 'Không tìm thấy phòng học.' });
        }

        if (parsed.value.type === 'physical') {
          const oversizedClasses = classes.list().filter(item =>
            String(item.roomId) === String(current.id)
            && (item.maxStudents > parsed.value.capacity || item.currentStudents > parsed.value.capacity)
          );
          if (oversizedClasses.length) {
            return res.status(409).json({
              success: false,
              code: 'ROOM_IN_USE',
              message: `Không thể giảm sức chứa: ${oversizedClasses[0].code} cần chỗ cho tối đa ${oversizedClasses[0].maxStudents} học viên.`
            });
          }
        }

        const data = rooms.update(req.params.id, parsed.value);
        return res.status(200).json({ success: true, data, message: 'Đã cập nhật phòng học.' });
      } catch (error) {
        if (error.code) {
          return res.status(statusFor(error)).json({ success: false, code: error.code, message: error.message });
        }
        return next(error);
      }
    }
  };
}

module.exports = { createClassroomController, validateRoomPayload };
