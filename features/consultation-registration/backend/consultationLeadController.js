'use strict';

const { ConsultationLeadError, ConsultationLeadModel } = require('./consultationLeadModel');

class ConsultationLeadController {
  static create(req, res, next) {
    const body = req.body || {};
    if (typeof body.website === 'string' && body.website.trim()) {
      return res.status(201).json({
        success: true,
        data: { received: true },
        message: 'Cảm ơn bạn đã đăng ký tư vấn.'
      });
    }

    try {
      const data = ConsultationLeadModel.create(body);
      return res.status(201).json({
        success: true,
        data: { id: data.id, status: data.status },
        message: 'Cảm ơn bạn đã đăng ký tư vấn. Trung tâm sẽ liên hệ lại trong vòng 1 ngày làm việc.'
      });
    } catch (error) {
      if (error instanceof ConsultationLeadError) {
        return res.status(error.status).json({
          success: false,
          code: error.code,
          message: error.message
        });
      }
      return next(error);
    }
  }
}

module.exports = ConsultationLeadController;
