
const students = require('../models/students');

// Tim hoc vien theo ma, ten hoac so dien thoai
function getStudents(req, res) {
    const keyword = String(req.query.search || '')
        .trim()
        .toLowerCase();

    const result = students.filter(student =>
        student.studentCode.toLowerCase().includes(keyword) ||
        student.fullName.toLowerCase().includes(keyword) ||
        student.phone.includes(keyword)
    );

    res.json({
        success: true,
        data: result
    });
}

// Xem chi tiet ho so hoc vien
function getStudentById(req, res) {
    const student = students.find(
        s => s.id === Number(req.params.id)
    );

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay hoc vien'
        });
    }

    res.json({
        success: true,
        data: student
    });
}

// Cap nhat ho so hoc vien
function updateStudent(req, res) {
    const student = students.find(
        s => s.id === Number(req.params.id)
    );

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay hoc vien'
        });
    }

    const { fullName, phone, entryLevel, notes } = req.body;

    if (typeof fullName === 'string') {
        student.fullName = fullName;
    }

    if (typeof phone === 'string') {
        student.phone = phone;
    }

    if (typeof entryLevel === 'string') {
        student.entryLevel = entryLevel;
    }

    if (typeof notes === 'string') {
        student.notes = notes;
    }

    res.json({
        success: true,
        message: 'Cap nhat ho so thanh cong',
        data: student
    });
}

// Xem qua trinh hoc
function getStudentHistory(req, res) {
    const student = students.find(
        s => s.id === Number(req.params.id)
    );

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay hoc vien'
        });
    }

    res.json({
        success: true,
        data: {
            currentClasses: student.currentClasses,
            classHistory: student.classHistory
        }
    });
}

module.exports = {
    getStudents,
    getStudentById,
    updateStudent,
    getStudentHistory
};
