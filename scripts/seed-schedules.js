/**
 * DNKN-240: Seed Script tạo dữ liệu mẫu cho Quản lý Lịch học
 *
 * Chạy lệnh:
 *   node scripts/seed-schedules.js
 *   npm run seed
 *
 * Để khôi phục/đặt lại dữ liệu gốc:
 *   node scripts/seed-schedules.js --reset
 *
 * Đặc điểm:
 * - Idempotent: Chạy nhiều lần an toàn, không sinh bản ghi trùng lặp.
 * - Khóa ngoại và ID hợp lệ theo schema.
 * - Không xóa dữ liệu khác của nhóm.
 * - Không chứa mật khẩu hay thông tin cá nhân thật.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SAMPLE_FIXTURE_PATH = path.join(ROOT_DIR, 'data', 'schedules-sample.json');
const TARGET_DATA_PATH = path.join(ROOT_DIR, 'data', 'schedules.json');
const AUDIT_DATA_PATH = path.join(ROOT_DIR, 'data', 'schedule-audit.json');

function loadFixture() {
  if (!fs.existsSync(SAMPLE_FIXTURE_PATH)) {
    throw new Error(`Không tìm thấy file fixture tại ${SAMPLE_FIXTURE_PATH}`);
  }
  const raw = fs.readFileSync(SAMPLE_FIXTURE_PATH, 'utf8');
  return JSON.parse(raw);
}

function loadExisting(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : (parsed.schedules || []);
  } catch {
    return [];
  }
}

function runSeed() {
  const isReset = process.argv.includes('--reset');
  console.log(`[SEED] Bắt đầu khởi tạo dữ liệu mẫu (Chế độ: ${isReset ? 'RESET' : 'MERGE/UPSERT'})...`);

  const fixture = loadFixture();
  const sampleSchedules = fixture.schedules || [];

  let finalSchedules = [];

  if (isReset) {
    finalSchedules = [...sampleSchedules];
  } else {
    const existing = loadExisting(TARGET_DATA_PATH);
    const existingMap = new Map(existing.map(item => [String(item.id), item]));

    // Upsert: nếu đã có ID thì giữ nguyên hoặc cập nhật trường, nếu chưa có thì thêm mới
    for (const sample of sampleSchedules) {
      if (!existingMap.has(String(sample.id))) {
        existingMap.set(String(sample.id), sample);
      }
    }
    finalSchedules = Array.from(existingMap.values());
  }

  // Lưu file schedules.json
  fs.mkdirSync(path.dirname(TARGET_DATA_PATH), { recursive: true });
  fs.writeFileSync(TARGET_DATA_PATH, JSON.stringify(finalSchedules, null, 2), 'utf8');
  console.log(`[SEED] Đã lưu ${finalSchedules.length} lịch học vào ${TARGET_DATA_PATH}`);

  // Tạo Audit logs cho các lịch học mẫu đã ghi đè (SCHED-005, SCHED-007)
  const auditRecords = [];
  for (const s of finalSchedules) {
    if (s.isOverridden) {
      auditRecords.push({
        id: `AUDIT-SEED-${s.id}`,
        action: 'SCHEDULE_OVERRIDE_SEED',
        scheduleId: s.id,
        actorId: s.overriddenBy?.id || 'mgr-01',
        actorName: s.overriddenBy?.name || 'Nguyễn Quản Lý Đào Tạo',
        actorRole: s.overriddenBy?.role || 'training_manager',
        timestamp: s.overriddenAt || new Date().toISOString(),
        overrideReason: s.overrideReason || 'Phê duyệt đào tạo',
        conflictsOverridden: [
          {
            type: s.id === 'SCHED-005' ? 'lecturer' : 'room',
            message: s.note || 'Xung đột đã được Quản lý đào tạo phê duyệt ghi đè'
          }
        ],
        scheduleData: s
      });
    }
  }

  fs.writeFileSync(AUDIT_DATA_PATH, JSON.stringify(auditRecords, null, 2), 'utf8');
  console.log(`[SEED] Đã tạo ${auditRecords.length} bản ghi audit mẫu vào ${AUDIT_DATA_PATH}`);

  console.log(`\n=== TỔNG KẾT DỮ LIỆU MẪU ĐÃ TẠO ===`);
  console.log(`- Giảng viên: GV01 (TS. An), GV02 (ThS. Bình), GV03 (PGS. Cường), GV04 (ThS. Dung)`);
  console.log(`- Phòng học: P301, P302, LAB01, LAB02`);
  console.log(`- Lớp & Môn: K15C6-N1..N3, K15KTPM-N1; INT1340, INT1330, INT1410, INT1305`);
  console.log(`- Buổi học hợp lệ không trùng: SCHED-001, SCHED-002`);
  console.log(`- Cặp trùng GIẢNG VIÊN để kiểm tra: SCHED-004 & SCHED-005 (cùng GV01, 2026-10-28 Ca 1)`);
  console.log(`- Cặp trùng PHÒNG HỌC để kiểm tra: SCHED-006 & SCHED-007 (cùng LAB01, 2026-10-29 Ca 2)`);
  console.log(`- Buổi học khác ngày xác nhận không báo sai: SCHED-008 (2026-10-30)`);
  console.log(`- Buổi học khác giờ xác nhận không báo sai: SCHED-009 (Ca 3: 13:00-15:15)`);
  console.log(`- Buổi học ĐÃ HỦY: SCHED-003 (status: cancelled, không gây xung đột)`);
  console.log(`===================================\n`);
}

runSeed();
