
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
`);

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

module.exports = db;
