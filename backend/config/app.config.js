const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  HOST: process.env.HOST || '127.0.0.1',
  FRONTEND_DIR: path.resolve(__dirname, '../../frontend'),
  DATA_FILE: path.resolve(__dirname, '../data/users.json'),
  DEFAULT_PAGE_SIZE: 20,
  MAX_CONSECUTIVE_FAILS: 5,
  LOCKOUT_DURATION_MS: 15 * 60 * 1000 // 15 phút
};
