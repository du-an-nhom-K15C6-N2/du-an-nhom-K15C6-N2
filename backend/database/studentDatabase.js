
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const db = new DatabaseSync(
    path.join(__dirname, 'students.db')
);

db.exec(`
  CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY,
    studentCode TEXT NOT NULL UNIQUE,
    fullName TEXT NOT NULL,
    phone TEXT NOT NULL,
    entryLevel TEXT DEFAULT '',
    notes TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS student_classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    studentId INTEGER NOT NULL,
    className TEXT NOT NULL,
    status TEXT NOT NULL
      CHECK(status IN ('current', 'completed')),
    FOREIGN KEY (studentId) REFERENCES students(id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    classCode TEXT NOT NULL UNIQUE COLLATE NOCASE,
    className TEXT NOT NULL,
    courseName TEXT DEFAULT '',
    teacherName TEXT DEFAULT '',
    schedule TEXT DEFAULT '',
    room TEXT DEFAULT '',
    maxStudents INTEGER DEFAULT 30,
    status TEXT DEFAULT 'active',
    programId TEXT DEFAULT '',
    programName TEXT DEFAULT '',
    startDate TEXT DEFAULT '',
    studyMode TEXT DEFAULT 'Offline',
    subjects TEXT DEFAULT '[]',
    createdAt TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS class_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    classId INTEGER NOT NULL,
    subjectCode TEXT NOT NULL,
    subjectName TEXT NOT NULL,
    credits INTEGER DEFAULT 3,
    sessions INTEGER DEFAULT 15,
    FOREIGN KEY (classId) REFERENCES classes(id)
  );
`);

// Dam bao cac cot mo rong ton tai neu bang classes da duoc tao truoc do
const alterColumns = [
  "ALTER TABLE classes ADD COLUMN programId TEXT DEFAULT ''",
  "ALTER TABLE classes ADD COLUMN programName TEXT DEFAULT ''",
  "ALTER TABLE classes ADD COLUMN startDate TEXT DEFAULT ''",
  "ALTER TABLE classes ADD COLUMN studyMode TEXT DEFAULT 'Offline'",
  "ALTER TABLE classes ADD COLUMN subjects TEXT DEFAULT '[]'"
];
for (const colSql of alterColumns) {
  try { db.exec(colSql); } catch (_) { /* cot da ton tai */ }
}


const count = db.prepare(
    'SELECT COUNT(*) AS total FROM students'
).get().total;

// Chi tao du lieu mau khi database chua co hoc vien.
if (count === 0) {
    const oldStudents = require('../models/students');

    const insertStudent = db.prepare(`
    INSERT INTO students
    (id, studentCode, fullName, phone, entryLevel, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

    const insertClass = db.prepare(`
    INSERT INTO student_classes
    (studentId, className, status)
    VALUES (?, ?, ?)
  `);

    for (const student of oldStudents) {
        insertStudent.run(
            student.id,
            student.studentCode,
            student.fullName,
            student.phone,
            student.entryLevel || '',
            student.notes || ''
        );

        for (const name of student.currentClasses || []) {
            insertClass.run(student.id, name, 'current');
        }

        for (const name of student.classHistory || []) {
            insertClass.run(student.id, name, 'completed');
        }
    }
}

// Chi tao du lieu mau khi database chua co lop hoc
const classCount = db.prepare('SELECT COUNT(*) AS total FROM classes').get().total;
if (classCount === 0) {
    const insertSampleClass = db.prepare(`
        INSERT INTO classes
        (classCode, className, courseName, teacherName, schedule, room, maxStudents, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertSampleClass.run('ENG-A1', 'Lớp Tiếng Anh A1', 'Tiếng Anh', 'ThS. Nguyễn Văn B', 'Thứ 2, 4, 6 (18:00 - 20:00)', 'P.301', 30, 'active');
    insertSampleClass.run('ENG-B1', 'Lớp Tiếng Anh B1', 'Tiếng Anh', 'TS. Trần Thị C', 'Thứ 3, 5, 7 (18:00 - 20:00)', 'P.302', 30, 'active');
    insertSampleClass.run('IT-WEB01', 'Lập trình Web Cơ bản', 'Công nghệ thông tin', 'ThS. Lê Hoàng D', 'Thứ 7, CN (08:00 - 11:30)', 'Lab 01', 25, 'active');
}

module.exports = db;
