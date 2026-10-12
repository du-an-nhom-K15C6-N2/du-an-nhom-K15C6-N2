const express = require('express');
const router = express.Router();

const {
  getLifecycleRules,
  getPrograms,
  getClasses,
  getClassById,
  checkClassCode,
  updateClassStatus,
  createClass
} = require('../controllers/classController');

// [BE] DNKN-176 / [FE] DNKN-204 / [BE] DNKN-205 / [BE] DNKN-207
router.get('/lifecycle-rules', getLifecycleRules);
router.get('/programs', getPrograms);
router.get('/', getClasses);
router.post('/', createClass);
router.post('/open-from-program', createClass);
router.get('/check/:code', checkClassCode);
router.get('/:id', getClassById);
router.patch('/:id/status', updateClassStatus);
router.put('/:id/status', updateClassStatus);

module.exports = router;
