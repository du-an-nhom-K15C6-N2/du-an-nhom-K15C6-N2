/**
 * Root Server Entry Point
 * Giúp tương thích cả lệnh `node server.js` từ start.bat lẫn require('./server') từ session.test.js
 */

const backend = require('./backend/server');

if (require.main === module) {
  backend.startServer();
}

module.exports = backend;
