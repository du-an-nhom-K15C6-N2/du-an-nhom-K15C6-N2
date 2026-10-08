const modules = require('../models/modules');

function getHealth(req, res) {
  res.json({
    success: true,
    status: 'OK',
    service: 'training-management-api',
    timestamp: new Date().toISOString()
  });
}

function getModules(req, res) {
  res.json({
    success: true,
    data: modules
  });
}

module.exports = { getHealth, getModules };
