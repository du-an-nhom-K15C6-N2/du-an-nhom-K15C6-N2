const db = require('../database/studentDatabase');
const programs = require('../models/programs');

// Định nghĩa các trạng thái trong vòng đời lớp học (DNKN-207)
const CLASS_STATUSES = {
  PLANNING: 'planning',         // Chuẩn bị
  IN_PROGRESS: 'in_progress',   // Đang học
  COMPLETED: 'completed',       // Kết thúc
  CANCELLED: 'cancelled'        // Huỷ
};

const STATUS_LABELS = {
  planning: 'Chuẩn bị',
  in_progress: 'Đang học',
  completed: 'Kết thúc',
  cancelled: 'Huỷ'
};

// Quy tắc chuyển trạng thái hợp lệ (State Transition Rules)
const VALID_TRANSITIONS = {
  planning: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
};

function normalizeStatus(status) {
  if (!status || typeof status !== 'string') return null;
  const s = status.trim().toLowerCase();
  if (['planning', 'chuan_bi', 'chuanbi', 'chuẩn bị', 'upcoming'].includes(s)) return 'planning';
  if (['in_progress', 'in-progress', 'dang_hoc', 'danghoc', 'đang học', 'active'].includes(s)) return 'in_progress';
  if (['completed', 'ket_thuc', 'ketthuc', 'kết thúc', 'finished'].includes(s)) return 'completed';
  if (['cancelled', 'canceled', 'huy', 'huỷ', 'bị huỷ'].includes(s)) return 'cancelled';
  return null;
}

function formatClass(classItem) {
  if (!classItem) return null;

  let subjects = [];
  try {
    if (classItem.subjects && typeof classItem.subjects === 'string') {
      subjects = JSON.parse(classItem.subjects);
    }
  } catch (_) {
    subjects = [];
  }

  if (subjects.length === 0) {
    subjects = db.prepare(`
      SELECT subjectCode, subjectName, credits, sessions
      FROM class_subjects
      WHERE classId = ?
      ORDER BY id
    `).all(classItem.id);
  }

  const rawStatus = classItem.status || 'planning';
  const canonicalStatus = normalizeStatus(rawStatus) || 'planning';

  return {
    ...classItem,
    status: rawStatus,
    canonicalStatus,
    statusLabel: STATUS_LABELS[canonicalStatus] || rawStatus,
    allowedTransitions: VALID_TRANSITIONS[canonicalStatus] || [],
    subjects
  };
}

// 1. Lấy quy tắc vòng đời lớp học (DNKN-207)
function getLifecycleRules(req, res) {
  res.json({
    success: true,
    statuses: CLASS_STATUSES,
    statusLabels: STATUS_LABELS,
    validTransitions: VALID_TRANSITIONS
  });
}

// 2. Lấy danh sách chương trình đào tạo và các môn học đi kèm
function getPrograms(req, res) {
  res.json({
    success: true,
    data: programs
  });
}

// 3. Lấy danh sách và tra cứu lớp học có phân trang (DNKN-206)
function getClasses(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      classCode,
      maLop,
      programId,
      program,
      chuongTrinh,
      status,
      trangThai,
      startDate,
      ngayKhaiGiang,
      fromStartDate,
      toStartDate,
      studyMode,
      hinhThucHoc,
      sortBy = 'id',
      sortOrder = 'DESC'
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    const params = [];

    // Tìm kiếm tổng quát
    const keyword = String(search || '').trim().toLowerCase();
    if (keyword) {
      conditions.push(`(
        LOWER(classCode) LIKE ?
        OR LOWER(className) LIKE ?
        OR LOWER(teacherName) LIKE ?
        OR LOWER(programName) LIKE ?
        OR LOWER(courseName) LIKE ?
      )`);
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    // Tra cứu theo Mã lớp học
    const targetCode = String(classCode ?? maLop ?? '').trim().toLowerCase();
    if (targetCode) {
      conditions.push('LOWER(classCode) LIKE ?');
      params.push(`%${targetCode}%`);
    }

    // Tra cứu theo Chương trình đào tạo
    const targetProgram = String(programId ?? program ?? chuongTrinh ?? '').trim().toLowerCase();
    if (targetProgram) {
      conditions.push('(LOWER(programId) = ? OR LOWER(programName) LIKE ? OR LOWER(courseName) LIKE ?)');
      params.push(targetProgram, `%${targetProgram}%`, `%${targetProgram}%`);
    }

    // Tra cứu theo Trạng thái lớp học
    const rawStatusFilter = String(status ?? trangThai ?? '').trim().toLowerCase();
    if (rawStatusFilter) {
      conditions.push('LOWER(status) = ?');
      params.push(rawStatusFilter);
    }

    // Tra cứu theo Thời gian khai giảng
    const targetDate = String(startDate ?? ngayKhaiGiang ?? '').trim();
    if (targetDate) {
      conditions.push('startDate = ?');
      params.push(targetDate);
    }

    if (fromStartDate) {
      conditions.push('startDate >= ?');
      params.push(String(fromStartDate).trim());
    }

    if (toStartDate) {
      conditions.push('startDate <= ?');
      params.push(String(toStartDate).trim());
    }

    // Tra cứu theo Hình thức học
    const targetMode = String(studyMode ?? hinhThucHoc ?? '').trim().toLowerCase();
    if (targetMode) {
      conditions.push('LOWER(studyMode) = ?');
      params.push(targetMode);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM classes ${whereClause}`;
    const total = db.prepare(countSql).get(...params).total;

    const allowedSortFields = ['id', 'classCode', 'className', 'startDate', 'maxStudents', 'createdAt'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'id';
    const safeSortOrder = String(sortOrder).toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const dataSql = `
      SELECT * FROM classes
      ${whereClause}
      ORDER BY ${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?
    `;
    const classes = db.prepare(dataSql).all(...params, limitNum, offset);

    const totalPages = Math.ceil(total / limitNum) || 1;

    res.json({
      success: true,
      message: 'Lấy danh sách lớp học thành công.',
      data: classes.map(formatClass),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách lớp học.',
      error: error.message
    });
  }
}

// 4. Lấy thông tin chi tiết một lớp học theo ID hoặc Mã lớp
function getClassById(req, res) {
  try {
    const identifier = String(req.params.id || '').trim();
    let classItem = null;

    if (/^\d+$/.test(identifier)) {
      classItem = db.prepare('SELECT * FROM classes WHERE id = ?').get(Number(identifier));
    }

    if (!classItem) {
      classItem = db.prepare('SELECT * FROM classes WHERE LOWER(classCode) = LOWER(?)').get(identifier);
    }

    if (!classItem) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lớp học.'
      });
    }

    res.json({
      success: true,
      data: formatClass(classItem)
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin lớp học.',
      error: error.message
    });
  }
}

// 5. Kiểm tra mã lớp đã tồn tại hay chưa (dùng cho FE check realtime)
function checkClassCode(req, res) {
  try {
    const code = String(req.params.code || '').trim();

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Mã lớp kiểm tra không được để trống.'
      });
    }

    const existing = db.prepare('SELECT id, classCode, className FROM classes WHERE LOWER(classCode) = LOWER(?)').get(code);

    res.json({
      success: true,
      exists: Boolean(existing),
      message: existing
        ? `Mã lớp "${code}" đã tồn tại trong hệ thống.`
        : `Mã lớp "${code}" hợp lệ, có thể sử dụng.`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi kiểm tra mã lớp.',
      error: error.message
    });
  }
}

// 6. Quản lý vòng đời lớp học: Chuẩn bị -> Đang học -> Kết thúc / Huỷ (DNKN-207)
function updateClassStatus(req, res) {
  try {
    const classId = req.params.id;
    const rawTargetStatus = req.body?.status ?? req.body?.trangThai;
    const reason = req.body?.reason ?? req.body?.lyDo ?? '';

    if (!rawTargetStatus) {
      return res.status(400).json({
        success: false,
        field: 'status',
        error: 'MISSING_STATUS',
        message: 'Trạng thái chuyển đổi không được để trống.'
      });
    }

    const targetStatus = normalizeStatus(rawTargetStatus);
    if (!targetStatus) {
      return res.status(400).json({
        success: false,
        field: 'status',
        error: 'INVALID_STATUS_VALUE',
        message: `Trạng thái "${rawTargetStatus}" không hợp lệ. Các trạng thái trong vòng đời gồm: planning (Chuẩn bị), in_progress (Đang học), completed (Kết thúc), cancelled (Huỷ).`
      });
    }

    const existingClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);
    if (!existingClass) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lớp học.'
      });
    }

    const currentStatus = normalizeStatus(existingClass.status) || 'planning';

    // Nếu cùng trạng thái hiện tại
    if (currentStatus === targetStatus) {
      return res.json({
        success: true,
        message: `Lớp học hiện tại đã ở trạng thái "${STATUS_LABELS[targetStatus]}".`,
        data: formatClass(existingClass)
      });
    }

    // Kiểm tra quy tắc chuyển trạng thái hợp lệ
    const allowedTargets = VALID_TRANSITIONS[currentStatus] || [];
    if (!allowedTargets.includes(targetStatus)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STATE_TRANSITION',
        currentStatus,
        currentStatusLabel: STATUS_LABELS[currentStatus] || currentStatus,
        targetStatus,
        targetStatusLabel: STATUS_LABELS[targetStatus] || targetStatus,
        allowedTransitions: allowedTargets,
        allowedTransitionsLabels: allowedTargets.map(s => STATUS_LABELS[s]),
        message: `Không thể chuyển trạng thái lớp học từ "${STATUS_LABELS[currentStatus] || currentStatus}" sang "${STATUS_LABELS[targetStatus] || targetStatus}". Chỉ cho phép chuyển sang: [${allowedTargets.map(s => STATUS_LABELS[s]).join(', ')}].`
      });
    }

    // Cập nhật trạng thái mới vào cơ sở dữ liệu
    db.prepare(`
      UPDATE classes
      SET status = ?
      WHERE id = ?
    `).run(targetStatus, classId);

    const updated = db.prepare('SELECT * FROM classes WHERE id = ?').get(classId);

    return res.json({
      success: true,
      message: `Chuyển trạng thái lớp học từ "${STATUS_LABELS[currentStatus]}" sang "${STATUS_LABELS[targetStatus]}" thành công.`,
      data: formatClass(updated),
      transition: {
        from: currentStatus,
        to: targetStatus,
        fromLabel: STATUS_LABELS[currentStatus],
        toLabel: STATUS_LABELS[targetStatus],
        reason: String(reason).trim()
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ khi cập nhật trạng thái lớp học.',
      error: error.message
    });
  }
}

// 7. Tạo mới / Mở lớp từ chương trình đào tạo
// [BE] DNKN-176 / [FE] DNKN-204 / [BE] DNKN-205
function createClass(req, res) {
  try {
    const rawClassCode = req.body?.classCode ?? req.body?.maLop;
    const rawProgramId = req.body?.programId ?? req.body?.programCode ?? req.body?.maChuongTrinh;
    const rawStartDate = req.body?.startDate ?? req.body?.ngayKhaiGiang ?? req.body?.ngayKhaiGiangDuKien;
    const rawMaxStudents = req.body?.maxStudents ?? req.body?.siSoToiDa;
    const rawStudyMode = req.body?.studyMode ?? req.body?.hinhThucHoc;
    const rawClassName = req.body?.className ?? req.body?.tenLop;
    const rawTeacher = req.body?.teacherName ?? req.body?.giangVien;
    const rawRoom = req.body?.room ?? req.body?.phongHoc;
    const rawSchedule = req.body?.schedule ?? req.body?.lichHoc;
    const rawStatus = req.body?.status ?? req.body?.trangThai;

    // Ràng buộc: Mã lớp không được để trống
    if (!rawClassCode || typeof rawClassCode !== 'string' || !rawClassCode.trim()) {
      return res.status(400).json({
        success: false,
        field: 'classCode',
        error: 'MISSING_CLASS_CODE',
        message: 'Mã lớp không được để trống.'
      });
    }

    const trimmedCode = rawClassCode.trim();

    // Ràng buộc: Nếu client truyền trường className nhưng lại để rỗng
    if (rawClassName !== undefined && (typeof rawClassName !== 'string' || !rawClassName.trim())) {
      return res.status(400).json({
        success: false,
        field: 'className',
        error: 'MISSING_CLASS_NAME',
        message: 'Tên lớp học không được để trống.'
      });
    }

    // Ràng buộc nghiệp vụ DNKN-176: Kiểm tra mã lớp duy nhất (không phân biệt chữ hoa/thường)
    const existingClass = db.prepare(`
      SELECT id, classCode, className
      FROM classes
      WHERE LOWER(classCode) = LOWER(?)
    `).get(trimmedCode);

    if (existingClass) {
      return res.status(409).json({
        success: false,
        field: 'classCode',
        error: 'DUPLICATE_CLASS_CODE',
        message: `Mã lớp "${trimmedCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã lớp khác.`,
        existingClass: {
          id: existingClass.id,
          classCode: existingClass.classCode,
          className: existingClass.className
        }
      });
    }

    // Nghiệp vụ DNKN-205: Tìm chương trình đào tạo & sao chép danh sách môn học
    let selectedProgram = null;
    let copiedSubjects = [];

    if (rawProgramId) {
      const progKey = String(rawProgramId).trim().toLowerCase();
      selectedProgram = programs.find(p =>
        p.id.toLowerCase() === progKey ||
        p.code.toLowerCase() === progKey ||
        p.name.toLowerCase() === progKey
      );

      if (!selectedProgram) {
        return res.status(404).json({
          success: false,
          field: 'programId',
          error: 'PROGRAM_NOT_FOUND',
          message: `Không tìm thấy chương trình đào tạo với mã "${rawProgramId}".`
        });
      }

      if (Array.isArray(selectedProgram.subjects)) {
        copiedSubjects = selectedProgram.subjects.map(s => ({
          subjectCode: s.code,
          subjectName: s.name,
          credits: s.credits,
          sessions: s.sessions
        }));
      }
    }

    let trimmedName = '';
    if (rawClassName && typeof rawClassName === 'string' && rawClassName.trim()) {
      trimmedName = rawClassName.trim();
    } else if (selectedProgram) {
      trimmedName = `Lớp ${selectedProgram.name} (${trimmedCode})`;
    } else {
      trimmedName = `Lớp học ${trimmedCode}`;
    }

    const programName = selectedProgram ? selectedProgram.name : '';
    const programId = selectedProgram ? selectedProgram.id : (rawProgramId ? String(rawProgramId).trim() : '');
    const assignedStartDate = rawStartDate ? String(rawStartDate).trim() : '';
    const assignedMode = rawStudyMode ? String(rawStudyMode).trim() : 'Offline';
    const assignedMaxStudents = Number(rawMaxStudents) > 0 ? Number(rawMaxStudents) : 30;

    // Trạng thái khởi tạo: mặc định là planning (Chuẩn bị), hoặc in_progress nếu client truyền active
    const assignedStatus = normalizeStatus(rawStatus) || 'planning';

    const insert = db.prepare(`
      INSERT INTO classes
      (classCode, className, programId, programName, startDate, studyMode, subjects, courseName, teacherName, schedule, room, maxStudents, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      trimmedCode,
      trimmedName,
      programId,
      programName,
      assignedStartDate,
      assignedMode,
      JSON.stringify(copiedSubjects),
      programName,
      rawTeacher ? String(rawTeacher).trim() : '',
      rawSchedule ? String(rawSchedule).trim() : '',
      rawRoom ? String(rawRoom).trim() : '',
      assignedMaxStudents,
      assignedStatus
    );

    const newClassId = result.lastInsertRowid;

    if (copiedSubjects.length > 0) {
      const insertSubject = db.prepare(`
        INSERT INTO class_subjects
        (classId, subjectCode, subjectName, credits, sessions)
        VALUES (?, ?, ?, ?, ?)
      `);

      for (const subj of copiedSubjects) {
        insertSubject.run(
          newClassId,
          subj.subjectCode,
          subj.subjectName,
          subj.credits,
          subj.sessions
        );
      }
    }

    const newClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(newClassId);

    return res.status(201).json({
      success: true,
      message: 'Tạo lớp học mới thành công.',
      data: formatClass(newClass)
    });

  } catch (error) {
    if (error.message && (error.message.includes('UNIQUE constraint failed') || error.code === 'SQLITE_CONSTRAINT')) {
      const rawCode = req.body?.classCode ?? req.body?.maLop;
      const trimmedCode = rawCode ? String(rawCode).trim() : '';
      return res.status(409).json({
        success: false,
        field: 'classCode',
        error: 'DUPLICATE_CLASS_CODE',
        message: `Mã lớp "${trimmedCode}" đã tồn tại trong hệ thống. Vui lòng chọn mã lớp khác.`
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Đã xảy ra lỗi máy chủ khi tạo lớp học.',
      error: error.message
    });
  }
}

module.exports = {
  getLifecycleRules,
  getPrograms,
  getClasses,
  getClassById,
  checkClassCode,
  updateClassStatus,
  createClass
};
