'use strict';

const { CourseCatalogError, CourseCatalogModel } = require('./courseCatalogModel');

function handleError(error, res, next) {
  if (error instanceof CourseCatalogError) {
    return res.status(error.status).json({
      success: false,
      code: error.code,
      message: error.message
    });
  }
  return next(error);
}

class CourseCatalogController {
  static async list(req, res, next) {
    try {
      return res.status(200).json({
        success: true,
        data: CourseCatalogModel.list(req.query),
        message: 'Đã tải danh mục môn học.'
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async create(req, res, next) {
    try {
      const data = CourseCatalogModel.create(req.body);
      return res.status(201).json({
        success: true,
        data,
        message: 'Đã tạo môn học.'
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async update(req, res, next) {
    try {
      const data = CourseCatalogModel.update(req.params.id, req.body);
      return res.status(200).json({
        success: true,
        data,
        message: 'Đã cập nhật môn học.'
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }

  static async remove(req, res, next) {
    try {
      const data = CourseCatalogModel.delete(req.params.id);
      return res.status(200).json({
        success: true,
        data,
        message: 'Đã xoá môn học.'
      });
    } catch (error) {
      return handleError(error, res, next);
    }
  }
}

module.exports = CourseCatalogController;
