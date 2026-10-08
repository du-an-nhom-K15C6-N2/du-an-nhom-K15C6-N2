const express = require('express');
const ProgramController = require('../controllers/programController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(requireAuth, requireAdmin);
router.get('/', ProgramController.getPrograms);
router.post('/', ProgramController.createProgram);
router.post('/:id/classes', ProgramController.createRunningClass);
router.get('/:id/classes', ProgramController.getRunningClasses);
router.delete('/:id/classes/:classId', ProgramController.endRunningClass);
router.put('/:id', ProgramController.updateProgram);
router.delete('/:id', ProgramController.deleteProgram);

module.exports = router;
