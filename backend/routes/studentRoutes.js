
const express = require('express');
const router = express.Router();

const {
    getStudents,
    getStudentById,
    updateStudent,
    getStudentHistory
} = require('../controllers/studentController');

router.get('/', getStudents);
router.get('/:id', getStudentById);
router.put('/:id', updateStudent);
router.get('/:id/history', getStudentHistory);

module.exports = router;
