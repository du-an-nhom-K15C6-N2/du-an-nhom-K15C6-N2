'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const config = require('../config/app.config');
const UserModel = require('./userModel');
const ClassModel = require('./classModel');

const DEFAULT_FILE = config.TEACHING_ASSIGNMENT_DATA_FILE || path.resolve(__dirname, '../data/teaching-assignments.json');

const INITIAL_ASSIGNMENTS = [
  {
    id: 'asg_001',
    classId: 'cls_001',
    courseId: 'course_web101',
    primaryTeacherId: 'usr_002',
    assistantIds: ['usr_013'],
    term: 'Học kỳ 1 - 2026',
    academicYear: '2026-2027',
    status: 'active',
    note: 'Phân công chính khóa cho lớp CNTT01',
    assignedAt: '2026-10-10T08:00:00.000Z',
    assignedBy: 'usr_86c4ea113bb01669',
    assignedByName: 'Lê Huy Hoàng',
    updatedAt: '2026-10-10T08:00:00.000Z',
    updatedBy: 'usr_86c4ea113bb01669',
    updatedByName: 'Lê Huy Hoàng'
  },
  {
    id: 'asg_002',
    classId: 'cls_002',
    courseId: 'course_db201',
    primaryTeacherId: 'usr_008',
    assistantIds: ['usr_018'],
    term: 'Học kỳ 1 - 2026',
    academicYear: '2026-2027',
    status: 'active',
    note: 'Phân công môn Cơ sở dữ liệu',
    assignedAt: '2026-10-10T08:30:00.000Z',
    assignedBy: 'usr_86c4ea113bb01669',
    assignedByName: 'Lê Huy Hoàng',
    updatedAt: '2026-10-10T08:30:00.000Z',
    updatedBy: 'usr_86c4ea113bb01669',
    updatedByName: 'Lê Huy Hoàng'
  }
];

class TeachingAssignmentModel {
  constructor(dataFile = DEFAULT_FILE) {
    this.dataFile = dataFile;
    this.ensureStore();
  }

  ensureStore() {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      const initial = {
        assignments: INITIAL_ASSIGNMENTS,
        history: [
          {
            id: 'asgh_001',
            assignmentId: 'asg_001',
            classId: 'cls_001',
            courseId: 'course_web101',
            action: 'CREATE',
            previousPrimaryTeacherId: null,
            newPrimaryTeacherId: 'usr_002',
            previousAssistantIds: [],
            newAssistantIds: ['usr_013'],
            performedAt: '2026-10-10T08:00:00.000Z',
            performedBy: 'usr_86c4ea113bb01669',
            performedByName: 'Lê Huy Hoàng',
            note: 'Khởi tạo phân công'
          },
          {
            id: 'asgh_002',
            assignmentId: 'asg_002',
            classId: 'cls_002',
            courseId: 'course_db201',
            action: 'CREATE',
            previousPrimaryTeacherId: null,
            newPrimaryTeacherId: 'usr_008',
            previousAssistantIds: [],
            newAssistantIds: ['usr_018'],
            performedAt: '2026-10-10T08:30:00.000Z',
            performedBy: 'usr_86c4ea113bb01669',
            performedByName: 'Lê Huy Hoàng',
            note: 'Khởi tạo phân công'
          }
        ]
      };
      this.writeStore(initial);
    }
  }

  readStore() {
    this.ensureStore();
    try {
      const content = fs.readFileSync(this.dataFile, 'utf8');
      const data = JSON.parse(content);
      if (!data || !Array.isArray(data.assignments) || !Array.isArray(data.history)) {
        throw new Error('Dữ liệu phân công không đúng cấu trúc.');
      }
      return data;
    } catch (error) {
      if (error.message.includes('Dữ liệu phân công không đúng cấu trúc')) throw error;
      return { assignments: [...INITIAL_ASSIGNMENTS], history: [] };
    }
  }

  writeStore(store) {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const tempFile = `${this.dataFile}.${process.pid}.${crypto.randomUUID()}.tmp`;
    try {
      fs.writeFileSync(tempFile, JSON.stringify(store, null, 2), 'utf8');
      fs.renameSync(tempFile, this.dataFile);
    } finally {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch (e) { /* ignore */ }
      }
    }
  }

  getCoursesCatalog() {
    const courseFile = config.COURSE_CATALOG_DATA_FILE || path.resolve(__dirname, '../data/courses.json');
    if (!fs.existsSync(courseFile)) return [];
    try {
      return JSON.parse(fs.readFileSync(courseFile, 'utf8'));
    } catch {
      return [];
    }
  }

  enrich(assignment) {
    if (!assignment) return null;

    // Lớp học
    const classes = ClassModel.list();
    const classInfo = classes.find(c => String(c.id) === String(assignment.classId)) || null;

    // Môn học
    const courses = this.getCoursesCatalog();
    const courseInfo = courses.find(c => String(c.id) === String(assignment.courseId)) || null;

    // Giảng viên chính
    const teacher = UserModel.findById(assignment.primaryTeacherId);
    const teacherRoles = teacher ? UserModel.getRoles(teacher) : [];
    const teacherStatus = teacher ? teacher.status : 'missing';
    const isTeacherActive = teacher && teacherStatus === 'active';

    // Trợ giảng (danh sách)
    const assistantIds = Array.isArray(assignment.assistantIds)
      ? assignment.assistantIds
      : (assignment.assistantId ? [assignment.assistantId] : []);

    const assistants = assistantIds.map(id => {
      const u = UserModel.findById(id);
      return u ? {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone || '',
        avatar: u.avatar || '',
        status: u.status,
        statusLabel: u.statusLabel
      } : {
        id,
        name: 'Tài khoản không xác định',
        email: '',
        status: 'missing',
        statusLabel: 'Không tồn tại'
      };
    });

    return {
      ...assignment,
      assistantIds,
      classCode: classInfo?.code || assignment.classId,
      className: classInfo?.name || 'Không xác định',
      classRoom: classInfo?.room || '',
      classSchedule: classInfo?.schedule || '',
      classStatus: classInfo?.status || 'unknown',
      courseCode: courseInfo?.code || assignment.courseId,
      courseName: courseInfo?.name || 'Không xác định',
      courseSessionCount: courseInfo?.sessionCount || 0,
      courseWeight: courseInfo?.weight || 1,
      primaryTeacherName: teacher?.name || 'Chưa phân công',
      primaryTeacherEmail: teacher?.email || '',
      primaryTeacherPhone: teacher?.phone || '',
      primaryTeacherAvatar: teacher?.avatar || '',
      primaryTeacherStatus: teacherStatus,
      primaryTeacherStatusLabel: teacher?.statusLabel || (isTeacherActive ? 'Đang hoạt động' : 'Không xác định'),
      isTeacherActive,
      assistants,
      hasAssistant: assistants.length > 0
    };
  }

  list({ classId, courseId, primaryTeacherId, status } = {}) {
    let assignments = this.readStore().assignments;

    if (classId) {
      assignments = assignments.filter(a => String(a.classId) === String(classId));
    }
    if (courseId) {
      assignments = assignments.filter(a => String(a.courseId) === String(courseId));
    }
    if (primaryTeacherId) {
      assignments = assignments.filter(a => String(a.primaryTeacherId) === String(primaryTeacherId));
    }
    if (status && status !== 'all') {
      assignments = assignments.filter(a => a.status === status);
    }

    return assignments.map(a => this.enrich(a));
  }

  findById(id) {
    const store = this.readStore();
    const assignment = store.assignments.find(a => String(a.id) === String(id));
    return assignment ? this.enrich(assignment) : null;
  }

  findByClassAndCourse(classId, courseId) {
    const store = this.readStore();
    const assignment = store.assignments.find(a =>
      String(a.classId) === String(classId) && String(a.courseId) === String(courseId)
    );
    return assignment ? this.enrich(assignment) : null;
  }

  create(assignmentData, actor = null) {
    const store = this.readStore();
    const now = new Date().toISOString();

    const assistantIds = Array.isArray(assignmentData.assistantIds)
      ? assignmentData.assistantIds
      : (assignmentData.assistantId ? [assignmentData.assistantId] : []);

    const newAssignment = {
      id: assignmentData.id || `asg_${crypto.randomUUID()}`,
      classId: String(assignmentData.classId),
      courseId: String(assignmentData.courseId),
      primaryTeacherId: String(assignmentData.primaryTeacherId),
      assistantIds: [...new Set(assistantIds.map(String))],
      term: assignmentData.term ? String(assignmentData.term).trim() : 'Học kỳ hiện tại',
      academicYear: assignmentData.academicYear ? String(assignmentData.academicYear).trim() : `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      status: assignmentData.status || 'active',
      note: assignmentData.note ? String(assignmentData.note).trim() : '',
      assignedAt: now,
      assignedBy: actor?.id || null,
      assignedByName: actor?.name || actor?.fullName || 'Hệ thống',
      updatedAt: now,
      updatedBy: actor?.id || null,
      updatedByName: actor?.name || actor?.fullName || 'Hệ thống'
    };

    const historyEntry = {
      id: `asgh_${crypto.randomUUID()}`,
      assignmentId: newAssignment.id,
      classId: newAssignment.classId,
      courseId: newAssignment.courseId,
      action: 'CREATE',
      previousPrimaryTeacherId: null,
      newPrimaryTeacherId: newAssignment.primaryTeacherId,
      previousAssistantIds: [],
      newAssistantIds: newAssignment.assistantIds,
      performedAt: now,
      performedBy: actor?.id || null,
      performedByName: actor?.name || actor?.fullName || 'Hệ thống',
      note: assignmentData.note || 'Phân công mới'
    };

    store.assignments.push(newAssignment);
    store.history.unshift(historyEntry);
    this.writeStore(store);

    return this.enrich(newAssignment);
  }

  update(id, updates, actor = null) {
    const store = this.readStore();
    const index = store.assignments.findIndex(a => String(a.id) === String(id));
    if (index === -1) {
      const error = new Error('Không tìm thấy bản ghi phân công cần cập nhật.');
      error.code = 'ASSIGNMENT_NOT_FOUND';
      throw error;
    }

    const current = store.assignments[index];
    const now = new Date().toISOString();

    const assistantIds = updates.assistantIds !== undefined
      ? (Array.isArray(updates.assistantIds) ? updates.assistantIds : [updates.assistantIds])
      : (updates.assistantId !== undefined ? (updates.assistantId ? [updates.assistantId] : []) : current.assistantIds);

    const prevTeacher = current.primaryTeacherId;
    const prevAssistants = current.assistantIds || [];

    const updated = {
      ...current,
      primaryTeacherId: updates.primaryTeacherId !== undefined ? String(updates.primaryTeacherId) : current.primaryTeacherId,
      assistantIds: [...new Set(assistantIds.map(String))],
      term: updates.term !== undefined ? String(updates.term).trim() : current.term,
      academicYear: updates.academicYear !== undefined ? String(updates.academicYear).trim() : current.academicYear,
      status: updates.status !== undefined ? updates.status : current.status,
      note: updates.note !== undefined ? String(updates.note).trim() : current.note,
      updatedAt: now,
      updatedBy: actor?.id || null,
      updatedByName: actor?.name || actor?.fullName || 'Hệ thống'
    };

    const isTeacherChanged = prevTeacher !== updated.primaryTeacherId;
    const isAssistantChanged = JSON.stringify(prevAssistants) !== JSON.stringify(updated.assistantIds);

    const historyEntry = {
      id: `asgh_${crypto.randomUUID()}`,
      assignmentId: updated.id,
      classId: updated.classId,
      courseId: updated.courseId,
      action: isTeacherChanged ? 'REASSIGN' : 'UPDATE',
      previousPrimaryTeacherId: prevTeacher,
      newPrimaryTeacherId: updated.primaryTeacherId,
      previousAssistantIds: prevAssistants,
      newAssistantIds: updated.assistantIds,
      performedAt: now,
      performedBy: actor?.id || null,
      performedByName: actor?.name || actor?.fullName || 'Hệ thống',
      note: updates.reason || updates.note || (isTeacherChanged ? 'Thay đổi giảng viên' : 'Cập nhật phân công')
    };

    store.assignments[index] = updated;
    store.history.unshift(historyEntry);
    this.writeStore(store);

    return this.enrich(updated);
  }

  remove(id, actor = null) {
    const store = this.readStore();
    const index = store.assignments.findIndex(a => String(a.id) === String(id));
    if (index === -1) {
      const error = new Error('Không tìm thấy bản ghi phân công cần xóa.');
      error.code = 'ASSIGNMENT_NOT_FOUND';
      throw error;
    }

    const removed = store.assignments[index];
    const now = new Date().toISOString();

    const historyEntry = {
      id: `asgh_${crypto.randomUUID()}`,
      assignmentId: removed.id,
      classId: removed.classId,
      courseId: removed.courseId,
      action: 'DELETE',
      previousPrimaryTeacherId: removed.primaryTeacherId,
      newPrimaryTeacherId: null,
      previousAssistantIds: removed.assistantIds,
      newAssistantIds: [],
      performedAt: now,
      performedBy: actor?.id || null,
      performedByName: actor?.name || actor?.fullName || 'Hệ thống',
      note: 'Hủy phân công môn học'
    };

    store.assignments.splice(index, 1);
    store.history.unshift(historyEntry);
    this.writeStore(store);

    return this.enrich(removed);
  }

  listHistory({ classId, courseId, assignmentId, limit = 100 } = {}) {
    let history = this.readStore().history;

    if (assignmentId) {
      history = history.filter(h => String(h.assignmentId) === String(assignmentId));
    }
    if (classId) {
      history = history.filter(h => String(h.classId) === String(classId));
    }
    if (courseId) {
      history = history.filter(h => String(h.courseId) === String(courseId));
    }

    const classes = ClassModel.list();
    const courses = this.getCoursesCatalog();

    return history.slice(0, limit).map(h => {
      const cls = classes.find(c => String(c.id) === String(h.classId));
      const crs = courses.find(c => String(c.id) === String(h.courseId));
      const prevTeacher = h.previousPrimaryTeacherId ? UserModel.findById(h.previousPrimaryTeacherId) : null;
      const newTeacher = h.newPrimaryTeacherId ? UserModel.findById(h.newPrimaryTeacherId) : null;

      return {
        ...h,
        className: cls?.name || h.classId,
        classCode: cls?.code || '',
        courseName: crs?.name || h.courseId,
        courseCode: crs?.code || '',
        previousPrimaryTeacherName: prevTeacher?.name || (h.previousPrimaryTeacherId ? 'N/A' : null),
        newPrimaryTeacherName: newTeacher?.name || (h.newPrimaryTeacherId ? 'N/A' : null)
      };
    });
  }
}

module.exports = TeachingAssignmentModel;
