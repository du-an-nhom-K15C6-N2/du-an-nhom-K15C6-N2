/**
 * Centralized Error Handling Middleware
 */
const notFoundHandler = (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({
      success: false,
      code: 'RESOURCE_NOT_FOUND',
      errorType: 'not-found',
      resource: req.originalUrl,
      message: `API endpoint '${req.originalUrl}' không tồn tại trên hệ thống.`
    });
  }
  next();
};

const errorHandler = (err, req, res, next) => {
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err.message || err);

  const statusCode = err.statusCode || (res.statusCode >= 400 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Lỗi xử lý nội bộ máy chủ.',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

module.exports = {
  notFoundHandler,
  errorHandler
};
