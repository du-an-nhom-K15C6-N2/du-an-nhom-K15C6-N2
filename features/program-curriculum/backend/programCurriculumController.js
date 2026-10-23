'use strict';

const { ProgramCurriculumError, ProgramCurriculumModel } = require('./programCurriculumModel');

function handleError(error, res, next) {
  if (error instanceof ProgramCurriculumError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }
  return next(error);
}

class ProgramCurriculumController {
  static async list(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: ProgramCurriculumModel.list(req.params.programId),
        message: 'Đã tải lộ trình môn học của chương trình.'
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async addCourse(req, res, next) {
    try {
      const data = ProgramCurriculumModel.addCourse(req.params.programId, (req.body || {}).courseId);
      return res.status(201).json({ success: true, data, message: 'Đã gắn môn học vào chương trình.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async removeCourse(req, res, next) {
    try {
      const data = ProgramCurriculumModel.removeCourse(req.params.programId, req.params.courseId);
      return res.status(200).json({ success: true, data, message: 'Đã gỡ môn học khỏi chương trình.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async reorder(req, res, next) {
    try {
      const data = ProgramCurriculumModel.reorder(req.params.programId, (req.body || {}).courseIds);
      return res.status(200).json({ success: true, data, message: 'Đã lưu thứ tự môn học.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async setPrerequisites(req, res, next) {
    try {
      const data = ProgramCurriculumModel.setPrerequisites(
        req.params.programId,
        req.params.courseId,
        (req.body || {}).prerequisiteIds
      );
      return res.status(200).json({ success: true, data, message: 'Đã cập nhật môn tiên quyết.' });
    } catch (error) {
      return handleError(error, res, next);
    }
  }
}

module.exports = ProgramCurriculumController;
