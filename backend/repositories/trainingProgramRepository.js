/**
 * Training Program Repository
 * Chịu trách nhiệm truy xuất, lưu trữ và kiểm tra liên kết dữ liệu với lớp học
 */

const fs = require('fs');
const path = require('path');
let config = {};
try {
  config = require('../config/app.config');
} catch (e) {
  config = {};
}

const INITIAL_PROGRAMS = [
  {
    id: 'tp_cntt_01',
    code: 'PROG-IT-01',
    name: 'Kỹ thuật Phần mềm Chuyên sâu',
    description: 'Chương trình đào tạo kỹ sư phần mềm từ cơ bản đến nâng cao, bao gồm Web, Mobile và An toàn thông tin.',
    duration: 120,
    standard_tuition: 15000000,
    status: 'ACTIVE',
    created_at: '2026-01-10T08:00:00.000Z',
    updated_at: '2026-01-10T08:00:00.000Z'
  },
  {
    id: 'tp_data_02',
    code: 'PROG-DATA-02',
    name: 'Khoa học Dữ liệu & AI',
    description: 'Đào tạo phân tích dữ liệu lớn, trực quan hóa và ứng dụng Machine Learning trong doanh nghiệp.',
    duration: 90,
    standard_tuition: 18500000,
    status: 'ACTIVE',
    created_at: '2026-02-15T09:30:00.000Z',
    updated_at: '2026-02-15T09:30:00.000Z'
  },
  {
    id: 'tp_mkt_03',
    code: 'PROG-MKT-03',
    name: 'Digital Marketing Thực chiến',
    description: 'Khóa học quản trị chiến dịch số, SEO, Performance Ads và sáng tạo nội dung đa kênh.',
    duration: 45,
    standard_tuition: 8500000,
    status: 'INACTIVE',
    created_at: '2026-03-01T10:00:00.000Z',
    updated_at: '2026-03-20T14:15:00.000Z'
  },
  {
    id: 'tp_uiux_04',
    code: 'PROG-UIUX-04',
    name: 'Thiết kế Trải nghiệm Người dùng UI/UX',
    description: 'Nghiên cứu hành vi người dùng, wireframing, thiết kế Design System và Prototype với Figma.',
    duration: 60,
    standard_tuition: 11000000,
    status: 'ACTIVE',
    created_at: '2026-03-15T11:00:00.000Z',
    updated_at: '2026-03-15T11:00:00.000Z'
  },
  {
    id: 'tp_free_05',
    code: 'PROG-DEMO-NEW',
    name: 'Kỹ năng Giao tiếp & Thuyết trình Chuyên nghiệp',
    description: 'Chương trình mới khai báo, chưa liên kết lớp học nào để người dùng thử nghiệm tính năng Xóa cứng.',
    duration: 30,
    standard_tuition: 3500000,
    status: 'ACTIVE',
    created_at: '2026-04-01T08:00:00.000Z',
    updated_at: '2026-04-01T08:00:00.000Z'
  }
];

class TrainingProgramRepository {
  constructor() {
    this.ensureStore();
  }

  getDataFile() {
    return process.env.TRAINING_PROGRAMS_DATA_FILE
      || config.TRAINING_PROGRAMS_DATA_FILE
      || path.resolve(__dirname, '../data/training-programs.json');
  }

  getClassesFile() {
    return process.env.CLASS_DATA_FILE
      || config.CLASS_DATA_FILE
      || path.resolve(__dirname, '../data/classes.json');
  }

  ensureStore() {
    const dataFile = this.getDataFile();
    const dir = path.dirname(dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(dataFile)) {
      fs.writeFileSync(dataFile, JSON.stringify(INITIAL_PROGRAMS, null, 2), 'utf8');
    }
  }

  readAll() {
    this.ensureStore();
    try {
      const content = fs.readFileSync(this.getDataFile(), 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Lỗi đọc dữ liệu chương trình đào tạo:', error);
      return [];
    }
  }

  writeAll(programs) {
    this.ensureStore();
    const dataFile = this.getDataFile();
    const tempFile = `${dataFile}.${Date.now()}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(programs, null, 2), 'utf8');
    fs.renameSync(tempFile, dataFile);
    return true;
  }

  findAll() {
    return this.readAll();
  }

  findById(id) {
    if (!id) return null;
    const programs = this.readAll();
    return programs.find(p => p.id === id) || null;
  }

  findByCode(code) {
    if (!code) return null;
    const cleanCode = String(code).trim().toUpperCase();
    const programs = this.readAll();
    return programs.find(p => String(p.code).trim().toUpperCase() === cleanCode) || null;
  }

  create(programData) {
    const programs = this.readAll();
    programs.unshift(programData);
    this.writeAll(programs);
    return programData;
  }

  update(id, updatedFields) {
    const programs = this.readAll();
    const index = programs.findIndex(p => p.id === id);
    if (index === -1) return null;

    programs[index] = {
      ...programs[index],
      ...updatedFields,
      updated_at: new Date().toISOString()
    };

    this.writeAll(programs);
    return programs[index];
  }

  delete(id) {
    const programs = this.readAll();
    const index = programs.findIndex(p => p.id === id);
    if (index === -1) return false;

    const [deleted] = programs.splice(index, 1);
    this.writeAll(programs);
    return deleted;
  }

  /**
   * Đọc danh sách lớp học từ database/file json
   */
  readClasses() {
    const classesFile = this.getClassesFile();
    try {
      if (!fs.existsSync(classesFile)) return [];
      const content = fs.readFileSync(classesFile, 'utf8');
      return JSON.parse(content);
    } catch (e) {
      console.error('Lỗi đọc classes file trong repository:', e);
      return [];
    }
  }

  /**
   * Kiểm tra và lấy danh sách lớp học liên kết với chương trình đào tạo
   * (Ràng buộc nghiệp vụ 2: Kiểm tra lớp học đã/đang có liên kết hay chưa)
   */
  getLinkedClasses(programId, programCode = null) {
    const classes = this.readClasses();
    const targetId = String(programId || '').trim();
    const targetCode = String(programCode || '').trim().toUpperCase();

    return classes.filter(cls => {
      const clsProgId = cls.trainingProgramId || cls.programId || cls.training_program_id;
      const clsProgCode = cls.trainingProgramCode || cls.programCode;
      
      const idMatch = clsProgId && String(clsProgId).trim() === targetId;
      const codeMatch = targetCode && clsProgCode && String(clsProgCode).trim().toUpperCase() === targetCode;
      
      return Boolean(idMatch || codeMatch);
    });
  }

  hasClassLinked(programId, programCode = null) {
    const linked = this.getLinkedClasses(programId, programCode);
    return linked.length > 0;
  }
}

module.exports = new TrainingProgramRepository();
