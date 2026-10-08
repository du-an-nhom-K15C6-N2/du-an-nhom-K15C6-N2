const fs = require('fs');
const path = require('path');
const config = require('./app.config');

const INITIAL_USERS = [
  { id: 'usr_001', name: 'Giáp Văn Hiếu', email: 'admin@edu.vn', phone: '0981234567', role: 'admin', roleLabel: 'Quản trị viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1995-05-15', address: 'Số 1 Đại Cồ Việt, Hai Bà Trưng, Hà Nội' },
  { id: 'usr_002', name: 'ThS. Trần Thị Mai', email: 'teacher@edu.vn', phone: '0912345678', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1988-10-20', address: 'Số 144 Xuân Thủy, Cầu Giấy, Hà Nội' },
  { id: 'usr_003', name: 'Nguyễn Văn An', email: 'student@edu.vn', phone: '0901234567', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-03-12', address: 'Số 234 Hoàng Quốc Việt, Bắc Từ Liêm, Hà Nội' },
  { id: 'usr_004', name: 'Lê Thị Thu Thảo', email: 'thao.le@edu.vn', phone: '0934567890', role: 'assistant', roleLabel: 'Trợ giảng', status: 'active', statusLabel: 'Đang hoạt động', dob: '2000-08-05', address: 'Số 18 Tam Khương, Đống Đa, Hà Nội' },
  { id: 'usr_005', name: 'Trần Minh Quân', email: 'quan.tm@edu.vn', phone: '0945678901', role: 'student', roleLabel: 'Học sinh', status: 'locked', statusLabel: 'Đang bị khóa', dob: '2003-11-25', address: 'Hà Nội' },
  { id: 'usr_006', name: 'Phạm Hoàng Nam', email: 'nam.ph@edu.vn', phone: '0967890123', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-01-18', address: 'Hải Phòng' },
  { id: 'usr_007', name: 'Đỗ Bích Phương', email: 'phuong.db@edu.vn', phone: '0978901234', role: 'student', roleLabel: 'Học sinh', status: 'pending', statusLabel: 'Chờ kích hoạt', dob: '2004-07-09', address: 'Quảng Ninh' },
  { id: 'usr_008', name: 'TS. Nguyễn Bảo Ngọc', email: 'ngoc.nb@edu.vn', phone: '0989012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1982-12-04', address: 'Hà Nội' },
  { id: 'usr_009', name: 'Vũ Quốc Khánh', email: 'khanh.vq@edu.vn', phone: '0919012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-09-14', address: 'Nam Định' },
  { id: 'usr_010', name: 'Bùi Lan Anh', email: 'anh.bl@edu.vn', phone: '0929012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-06-30', address: 'Thái Bình' },
  { id: 'usr_011', name: 'Hoàng Văn Thắng', email: 'thang.hv@edu.vn', phone: '0939012345', role: 'student', roleLabel: 'Học sinh', status: 'locked', statusLabel: 'Đang bị khóa', dob: '2003-04-12', address: 'Hà Nội' },
  { id: 'usr_012', name: 'PGS. TS. Lê Đức Hùng', email: 'hung.ld@edu.vn', phone: '0949012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1975-02-28', address: 'Hà Nội' },
  { id: 'usr_013', name: 'Ngô Thanh Vân', email: 'van.nt@edu.vn', phone: '0959012345', role: 'assistant', roleLabel: 'Trợ giảng', status: 'active', statusLabel: 'Đang hoạt động', dob: '2001-10-10', address: 'Hà Nội' },
  { id: 'usr_014', name: 'Đinh Tiến Đạt', email: 'dat.dt@edu.vn', phone: '0969012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-05-22', address: 'Bắc Ninh' },
  { id: 'usr_015', name: 'Võ Thị Kim Yến', email: 'yen.vtk@edu.vn', phone: '0979012345', role: 'student', roleLabel: 'Học sinh', status: 'pending', statusLabel: 'Chờ kích hoạt', dob: '2004-12-15', address: 'Hà Nội' },
  { id: 'usr_016', name: 'Dương Tuấn Kiệt', email: 'kiet.dt@edu.vn', phone: '0988012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-08-08', address: 'Hà Nội' },
  { id: 'usr_017', name: 'Mai Phương Thúy', email: 'thuy.mp@edu.vn', phone: '0918012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-02-17', address: 'Hà Nội' },
  { id: 'usr_018', name: 'Phan Anh Tuấn', email: 'tuan.pa@edu.vn', phone: '0928012345', role: 'assistant', roleLabel: 'Trợ giảng', status: 'active', statusLabel: 'Đang hoạt động', dob: '1999-07-21', address: 'Hà Nội' },
  { id: 'usr_019', name: 'Trịnh Thùy Linh', email: 'linh.tt@edu.vn', phone: '0938012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-11-03', address: 'Hà Nội' },
  { id: 'usr_020', name: 'Hà Quang Huy', email: 'huy.hq@edu.vn', phone: '0948012345', role: 'student', roleLabel: 'Học sinh', status: 'active', statusLabel: 'Đang hoạt động', dob: '2004-04-19', address: 'Hà Nội' },
  { id: 'usr_021', name: 'Cao Bá Quát', email: 'quat.cb@edu.vn', phone: '0958012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1980-01-01', address: 'Hà Nội' },
  { id: 'usr_022', name: 'Chu Văn An', email: 'an.cv@edu.vn', phone: '0968012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1979-05-18', address: 'Hà Nội' },
  { id: 'usr_023', name: 'Lương Thế Vinh', email: 'vinh.lt@edu.vn', phone: '0978012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1983-09-09', address: 'Nam Định' },
  { id: 'usr_024', name: 'Nguyễn Bỉnh Khiêm', email: 'khiem.nb@edu.vn', phone: '0987012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1981-06-16', address: 'Hải Phòng' },
  { id: 'usr_025', name: 'Tạ Quang Bửu', email: 'buu.tq@edu.vn', phone: '0917012345', role: 'admin', roleLabel: 'Quản trị viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1985-03-23', address: 'Hà Nội' },
  { id: 'usr_026', name: 'Lê Văn Thiêm', email: 'thiem.lv@edu.vn', phone: '0927012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'locked', statusLabel: 'Đang bị khóa', dob: '1978-08-12', address: 'Hà Tĩnh' },
  { id: 'usr_027', name: 'Hoàng Tụy', email: 'tuy.h@edu.vn', phone: '0937012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'active', statusLabel: 'Đang hoạt động', dob: '1977-12-07', address: 'Đà Nẵng' },
  { id: 'usr_028', name: 'Nguyễn Cảnh Toàn', email: 'toan.nc@edu.vn', phone: '0947012345', role: 'teacher', roleLabel: 'Giảng viên', status: 'pending', statusLabel: 'Chờ kích hoạt', dob: '1984-04-14', address: 'Nghệ An' }
];

class Database {
  constructor() {
    this.dataFile = config.DATA_FILE;
    this.initDatabase();
  }

  initDatabase() {
    const dataDir = path.dirname(this.dataFile);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.dataFile)) {
      this.writeUsers(INITIAL_USERS);
      console.log('📦 Đã khởi tạo cơ sở dữ liệu với 28 tài khoản mẫu chuẩn EP-01.');
    }
  }

  readUsers() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        this.writeUsers(INITIAL_USERS);
        return [...INITIAL_USERS];
      }
      const raw = fs.readFileSync(this.dataFile, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      console.error('Lỗi đọc database:', error);
      return [...INITIAL_USERS];
    }
  }

  writeUsers(users) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(users, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Lỗi ghi database:', error);
      return false;
    }
  }

  reset() {
    this.writeUsers(INITIAL_USERS);
    return [...INITIAL_USERS];
  }
}

module.exports = new Database();
