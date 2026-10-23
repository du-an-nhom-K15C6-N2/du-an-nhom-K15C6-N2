const express = require('express');
const { createClassroomController } = require('../controllers/classroomController');
const { requireAuth, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();
const controller = createClassroomController();

router.use(requireAuth);
router.get('/', requirePermission('classes.read', { featureName: 'danh sách phòng học' }), controller.list);
router.post('/', requirePermission('classrooms.manage', { featureName: 'khai báo phòng học' }), controller.create);
router.put('/:id', requirePermission('classrooms.manage', { featureName: 'cập nhật phòng học' }), controller.update);

module.exports = router;
