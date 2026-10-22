// DNKN-175: Model quản lý hồ sơ học viên

const path = require('path');

const fs = require('fs');
const crypto = require('crypto');

const backendPath = path.resolve(__dirname, '../../../backend');

const UserModel = require(
    path.join(backendPath, 'models/userModel')
);

const ClassModel = require(
    path.join(backendPath, 'models/classModel')
);

const EnrollmentModel = require(
    path.join(backendPath, 'models/enrollmentModel')
);
const appConfig =
    require('../../../backend/config/app.config');

// DNKN-175: Dữ liệu bổ sung cho hồ sơ học viên
const PROFILE_DATA_FILE = path.resolve(
    __dirname,
    'studentProfileData.json'
);

function readProfileData() {
    if (!fs.existsSync(PROFILE_DATA_FILE)) {
        return {};
    }

    const data = JSON.parse(
        fs.readFileSync(PROFILE_DATA_FILE, 'utf8')
    );

    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new Error('Dữ liệu hồ sơ học viên không hợp lệ.');
    }

    return data;
}

function writeProfileData(data) {
    const temporaryFile = `${PROFILE_DATA_FILE}.${crypto.randomUUID()}.tmp`;

    fs.writeFileSync(
        temporaryFile,
        JSON.stringify(data, null, 2),
        { encoding: 'utf8', mode: 0o600 }
    );

    try {
        fs.renameSync(temporaryFile, PROFILE_DATA_FILE);
    } finally {
        if (fs.existsSync(temporaryFile)) {
            fs.unlinkSync(temporaryFile);
        }
    }
}

class StudentProfileModel {

    static getAllStudents() {
        return UserModel.getAllRaw()
            .filter(user =>
                UserModel.getRoles(user).includes('student')
            )
            .map(user => UserModel.toPublicUser(user));
    }

    static getStudentById(studentId) {
        const user = UserModel.findById(studentId);

        if (!user || !UserModel.getRoles(user).includes('student')) {
            return null;
        }

        return UserModel.toPublicUser(user);
    }

    static getStudentClasses(studentId) {
        const enrollmentModel = new EnrollmentModel();

        const enrollments = enrollmentModel
            .readStore()
            .enrollments
            .filter(item =>
                String(item.studentId) === String(studentId)
            );

        const classes = ClassModel.list();

        return enrollments.map(enrollment => {
            const classInfo = classes.find(
                item => String(item.id) === String(enrollment.classId)
            );

            return {
                enrollmentId: enrollment.id,
                enrolledAt: enrollment.enrolledAt,
                classId: enrollment.classId,
                classInfo: classInfo || null
            };
        });
    }

    static getStudentHistory(studentId) {
        const enrollmentModel = new EnrollmentModel();

        return enrollmentModel
            .readStore()
            .history
            .filter(item =>
                String(item.studentId) === String(studentId)
            )
            .sort((a, b) =>
                String(b.enrolledAt || '').localeCompare(
                    String(a.enrolledAt || '')
                )
            );
    }
    // DNKN-175: Cập nhật thông tin hồ sơ học viên
    static updateStudentProfile(studentId, profileData) {
        const student = this.getStudentById(studentId);

        if (!student) {
            return null;
        }

        const allowedData = {
            name: profileData.name,
            phone: profileData.phone,
            dateOfBirth: profileData.dateOfBirth,
            address: profileData.address
        };

        const updatedUser = UserModel.updateProfile(
            studentId,
            allowedData
        );

        return UserModel.toPublicUser(updatedUser);
    }

    // Lấy trình độ đầu vào và ghi chú
    static getStudentExtra(studentId) {
        const data = readProfileData();

        return data[studentId] || {
            entryLevel: '',
            notes: ''
        };
    }

    // Cập nhật trình độ đầu vào và ghi chú
    static updateStudentExtra(studentId, extraData) {
        const student = this.getStudentById(studentId);

        if (!student) {
            return null;
        }

        const data = readProfileData();
        const current = this.getStudentExtra(studentId);

        const updated = {
            entryLevel: extraData.entryLevel !== undefined
                ? extraData.entryLevel
                : current.entryLevel,
            notes: extraData.notes !== undefined
                ? extraData.notes
                : current.notes
        };

        data[studentId] = updated;
        writeProfileData(data);

        return updated;
    }

    // DNKN-175: Lấy điểm danh của học viên
    static getStudentAttendance(studentId) {
        const file = appConfig.ATTENDANCE_DATA_FILE;

        if (!fs.existsSync(file)) {
            return [];
        }

        const records = JSON.parse(
            fs.readFileSync(file, 'utf8')
        );

        if (!Array.isArray(records)) {
            throw new Error('Dữ liệu điểm danh không hợp lệ.');
        }

        return records
            .filter(record =>
                String(record.studentId) === String(studentId)
            )
            .sort((a, b) =>
                String(b.attendanceDate || '').localeCompare(
                    String(a.attendanceDate || '')
                )
            );
    }

    // DNKN-175: Lấy điểm số của học viên
    static getStudentGrades(studentId) {
        const file = appConfig.GRADES_DATA_FILE;

        if (!fs.existsSync(file)) {
            return [];
        }

        const records = JSON.parse(
            fs.readFileSync(file, 'utf8')
        );

        if (!Array.isArray(records)) {
            throw new Error('Dữ liệu điểm số không hợp lệ.');
        }

        return records
            .filter(record =>
                String(record.studentId) === String(studentId)
            )
            .sort((a, b) =>
                String(b.updatedAt || '').localeCompare(
                    String(a.updatedAt || '')
                )
            );
    }

    static getStudentProfile(studentId) {
        const student = this.getStudentById(studentId);

        if (!student) {
            return null;
        }

        return {
            student,
            classes: this.getStudentClasses(studentId),
            history: this.getStudentHistory(studentId),
            extra: this.getStudentExtra(studentId),
            attendance: this.getStudentAttendance(studentId),
            grades: this.getStudentGrades(studentId)
        };
    }
}

module.exports = StudentProfileModel;