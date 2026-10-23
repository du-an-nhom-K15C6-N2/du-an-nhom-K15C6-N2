'use strict';

const { CourseSessionsError, CourseSessionsModel } = require('./courseSessionsModel');

function handleError(error, res, next) {
  if (error instanceof CourseSessionsError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }
  return next(error);
}

class CourseSessionsController {
  static async list(req, res, next) {
    try {
      const data = CourseSessionsModel.list(req.params.courseId);
      return res.status(200).json({ success: true, data, message: 'Đã tải danh sách buổi học.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async create(req, res, next) {
    try {
      const data = CourseSessionsModel.create(req.params.courseId, req.body || {});
      return res.status(201).json({ success: true, data, message: 'Đã khai báo buổi học.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async update(req, res, next) {
    try {
      const data = CourseSessionsModel.update(
        req.params.courseId,
        Number(req.params.number),
        req.body || {}
      );
      return res.status(200).json({ success: true, data, message: 'Đã cập nhật buổi học.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async remove(req, res, next) {
    try {
      const data = CourseSessionsModel.remove(req.params.courseId, Number(req.params.number));
      return res.status(200).json({ success: true, data, message: 'Đã xoá buổi học.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async clone(req, res, next) {
    try {
      const data = CourseSessionsModel.clone((req.body || {}).sourceCourseId, req.params.courseId);
      return res.status(200).json({ success: true, data, message: 'Đã nhân bản danh sách buổi học.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }
}

module.exports = CourseSessionsController;
