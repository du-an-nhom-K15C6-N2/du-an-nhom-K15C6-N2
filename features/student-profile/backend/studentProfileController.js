// DNKN-175: Controller quản lý hồ sơ học viên

const StudentProfileModel = require('./studentProfileModel');

class StudentProfileController {

    // Lấy danh sách học viên
    static getAllStudents(req, res, next) {
        try {
            const students = StudentProfileModel.getAllStudents();

            return res.status(200).json({
                success: true,
                data: students,
                total: students.length
            });
        } catch (error) {
            next(error);
        }
    }

    // Lấy hồ sơ chi tiết theo ID học viên
    static getStudentProfile(req, res, next) {
        try {
            const { studentId } = req.params;

            const profile =
                StudentProfileModel.getStudentProfile(studentId);

            if (!profile) {
                return res.status(404).json({
                    success: false,
                    code: 'STUDENT_NOT_FOUND',
                    message: 'Không tìm thấy hồ sơ học viên.'
                });
            }

            return res.status(200).json({
                success: true,
                data: profile
            });
        } catch (error) {
            next(error);
        }
    }

    // Lấy danh sách lớp học của học viên
    static getStudentClasses(req, res, next) {
        try {
            const { studentId } = req.params;

            const student =
                StudentProfileModel.getStudentById(studentId);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy học viên.'
                });
            }

            return res.status(200).json({
                success: true,
                data: StudentProfileModel.getStudentClasses(studentId)
            });
        } catch (error) {
            next(error);
        }
    }

    // Lấy lịch sử ghi danh của học viên
    static getStudentHistory(req, res, next) {
        try {
            const { studentId } = req.params;

            const student =
                StudentProfileModel.getStudentById(studentId);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy học viên.'
                });
            }

            return res.status(200).json({
                success: true,
                data: StudentProfileModel.getStudentHistory(studentId)
            });
        } catch (error) {
            next(error);
        }
    }
    // DNKN-175: Cập nhật hồ sơ học viên
    static updateStudentProfile(req, res, next) {
        try {
            const { studentId } = req.params;
            const body = req.body;

            if (!body || typeof body !== 'object' || Array.isArray(body)) {
                return res.status(400).json({
                    success: false,
                    message: 'Dữ liệu cập nhật không hợp lệ.'
                });
            }

            const allowedFields = [
                'name',
                'phone',
                'dateOfBirth',
                'address',
            ];

            const fields = Object.keys(body);

            if (
                fields.length === 0 ||
                fields.some(field => !allowedFields.includes(field))
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Có trường dữ liệu không được phép cập nhật.'
                });
            }

            if (
                typeof body.name !== 'string' ||
                body.name.trim().length < 2 ||
                body.name.trim().length > 120
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Họ tên phải có từ 2 đến 120 ký tự.'
                });
            }

            if (
                body.phone !== undefined &&
                (typeof body.phone !== 'string' ||
                    body.phone.length > 32)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Số điện thoại không hợp lệ.'
                });
            }

            if (
                body.address !== undefined &&
                (typeof body.address !== 'string' ||
                    body.address.length > 255)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Địa chỉ không hợp lệ.'
                });
            }

            if (body.dateOfBirth !== undefined) {
                const dob = body.dateOfBirth;

                if (
                    typeof dob !== 'string' ||
                    (dob !== '' &&
                        (!/^\d{4}-\d{2}-\d{2}$/.test(dob) ||
                            !Number.isFinite(Date.parse(dob)) ||
                            new Date(dob).toISOString().slice(0, 10) !== dob ||
                            dob > new Date().toISOString().slice(0, 10)))
                ) {
                    return res.status(400).json({
                        success: false,
                        message: 'Ngày sinh không hợp lệ.'
                    });
                }
            }

            // DNKN-175: Kiểm tra trình độ đầu vào
            if (
                body.entryLevel !== undefined &&
                (
                    typeof body.entryLevel !== 'string' ||
                    body.entryLevel.length > 100
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Trình độ đầu vào không hợp lệ.'
                });
            }

            // DNKN-175: Kiểm tra ghi chú học viên
            if (
                body.notes !== undefined &&
                (
                    typeof body.notes !== 'string' ||
                    body.notes.length > 1000
                )
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Ghi chú không được vượt quá 1000 ký tự.'
                });
            }

            const updatedStudent =
                StudentProfileModel.updateStudentProfile(studentId, body);

            if (!updatedStudent) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy học viên.'
                });
            }

            return res.status(200).json({
                success: true,
                data: updatedStudent,
                message: 'Cập nhật hồ sơ học viên thành công.'
            });

        } catch (error) {
            next(error);
        }
    }
    // DNKN-175: Cập nhật trình độ đầu vào và ghi chú
    static updateStudentExtra(req, res, next) {
        try {
            const { studentId } = req.params;
            const body = req.body;

            if (!body || typeof body !== 'object' ||
                Array.isArray(body)) {
                return res.status(400).json({
                    success: false,
                    message: 'Dữ liệu không hợp lệ.'
                });
            }

            const fields = Object.keys(body);
            const allowedFields = ['entryLevel', 'notes'];

            if (
                fields.length === 0 ||
                fields.some(field => !allowedFields.includes(field))
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Trường dữ liệu không được phép cập nhật.'
                });
            }

            if (
                fields.some(field => typeof body[field] !== 'string') ||
                (body.entryLevel !== undefined &&
                    body.entryLevel.length > 100) ||
                (body.notes !== undefined &&
                    body.notes.length > 1000)
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Trình độ hoặc ghi chú không hợp lệ.'
                });
            }

            const updated =
                StudentProfileModel.updateStudentExtra(studentId, body);

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Không tìm thấy học viên.'
                });
            }

            return res.status(200).json({
                success: true,
                data: updated,
                message: 'Đã cập nhật trình độ và ghi chú.'
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = StudentProfileController;