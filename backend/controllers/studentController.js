
const db = require('../database/studentDatabase');

function getClasses(studentId, status) {
    return db.prepare(`
    SELECT className
    FROM student_classes
    WHERE studentId = ? AND status = ?
    ORDER BY id
  `).all(studentId, status).map(row => row.className);
}

function formatStudent(student) {
    return {
        ...student,
        currentClasses: getClasses(student.id, 'current'),
        classHistory: getClasses(student.id, 'completed')
    };
}

// Tim kiem hoc vien
function getStudents(req, res) {
    const search = String(req.query.search || '')
        .trim()
        .toLowerCase();

    const students = db.prepare(`
    SELECT * FROM students
    WHERE LOWER(studentCode) LIKE ?
       OR LOWER(fullName) LIKE ?
       OR phone LIKE ?
    ORDER BY id
  `).all(...Array(3).fill(`%${search}%`));

    res.json({
        success: true,
        data: students.map(formatStudent)
    });
}

// Xem chi tiet hoc vien
function getStudentById(req, res) {
    const student = db.prepare(
        'SELECT * FROM students WHERE id = ?'
    ).get(req.params.id);

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay hoc vien'
        });
    }

    res.json({
        success: true,
        data: formatStudent(student)
    });
}

// Cap nhat ho so hoc vien
function updateStudent(req, res) {
    const student = db.prepare(
        'SELECT * FROM students WHERE id = ?'
    ).get(req.params.id);

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay hoc vien'
        });
    }

    const { fullName, phone, entryLevel, notes } = req.body;

    const name = fullName ?? student.fullName;
    const phoneNumber = phone ?? student.phone;
    const level = entryLevel ?? student.entryLevel;
    const studentNotes = notes ?? student.notes;

    if (
        typeof name !== 'string' ||
        !name.trim() ||
        typeof phoneNumber !== 'string' ||
        !/^0\d{9}$/.test(phoneNumber)
    ) {
        return res.status(400).json({
            success: false,
            message: 'Ten hoac so dien thoai khong hop le'
        });
    }

    if (
        typeof level !== 'string' ||
        typeof studentNotes !== 'string'
    ) {
        return res.status(400).json({
            success: false,
            message: 'Du lieu ho so khong hop le'
        });
    }

    db.prepare(`
    UPDATE students
    SET fullName = ?, phone = ?, entryLevel = ?, notes = ?
    WHERE id = ?
  `).run(
        name.trim(),
        phoneNumber,
        level,
        studentNotes,
        student.id
    );

    const updated = db.prepare(
        'SELECT * FROM students WHERE id = ?'
    ).get(student.id);

    res.json({
        success: true,
        message: 'Cap nhat ho so thanh cong',
        data: formatStudent(updated)
    });
}

// Xem qua trinh hoc
function getStudentHistory(req, res) {
    const student = db.prepare(
        'SELECT * FROM students WHERE id = ?'
    ).get(req.params.id);

    if (!student) {
        return res.status(404).json({
            success: false,
            message: 'Khong tim thay hoc vien'
        });
    }

    res.json({
        success: true,
        data: {
            currentClasses: getClasses(student.id, 'current'),
            classHistory: getClasses(student.id, 'completed')
        }
    });
}

module.exports = {
    getStudents,
    getStudentById,
    updateStudent,
    getStudentHistory
};
