-- =====================================================================
-- DATABASE MIGRATION & SCHEMA DEFINITION: TRAINING PROGRAMS MANAGEMENT
-- Module: Quản lý danh mục chương trình đào tạo (Training Program Management)
-- Hệ thống: Quản lý Lớp học & Dữ liệu Đào tạo An toàn (TTCS MVC)
-- =====================================================================

-- 1. Tạo bảng danh mục chương trình đào tạo
CREATE TABLE IF NOT EXISTS training_programs (
    id VARCHAR(64) PRIMARY KEY,                         -- UUID hoặc khóa chính tự sinh (VD: tp_uuid)
    code VARCHAR(50) NOT NULL,                          -- Mã chương trình (VD: PROG-IT-01), BẮT BUỘC, DUY NHẤT
    name VARCHAR(255) NOT NULL,                         -- Tên chương trình, BẮT BUỘC
    description TEXT NULL,                              -- Mô tả chi tiết chương trình (Tùy chọn)
    duration INT NOT NULL,                              -- Tổng thời lượng (giờ/buổi), BẮT BUỘC, > 0
    standard_tuition DECIMAL(15, 2) NOT NULL DEFAULT 0, -- Học phí chuẩn, BẮT BUỘC, >= 0
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',       -- Trạng thái: 'ACTIVE' hoặc 'INACTIVE'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Ràng buộc kiểm tra tính hợp lệ dữ liệu (Constraints)
    CONSTRAINT uk_training_programs_code UNIQUE (code),
    CONSTRAINT chk_training_programs_duration CHECK (duration > 0),
    CONSTRAINT chk_training_programs_tuition CHECK (standard_tuition >= 0),
    CONSTRAINT chk_training_programs_status CHECK (status IN ('ACTIVE', 'INACTIVE'))
);

-- 2. Chỉ mục tối ưu hóa tìm kiếm & lọc dữ liệu (Indexes)
CREATE INDEX IF NOT EXISTS idx_training_programs_code ON training_programs(code);
CREATE INDEX IF NOT EXISTS idx_training_programs_status ON training_programs(status);
CREATE INDEX IF NOT EXISTS idx_training_programs_name ON training_programs(name);

-- 3. Liên kết khóa ngoại với bảng Lớp học (Classes)
-- Khi tạo lớp học mới, chỉ cần chọn chương trình có sẵn từ bảng này
ALTER TABLE IF EXISTS classes 
    ADD COLUMN IF NOT EXISTS training_program_id VARCHAR(64) NULL;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_classes_training_program'
    ) THEN
        ALTER TABLE classes
            ADD CONSTRAINT fk_classes_training_program 
            FOREIGN KEY (training_program_id) 
            REFERENCES training_programs(id)
            ON DELETE RESTRICT; -- Chặn xóa cứng nếu đã có lớp học liên kết
    END IF;
END $$;

-- 4. Dữ liệu khởi tạo mẫu (Seed Data)
INSERT INTO training_programs (id, code, name, description, duration, standard_tuition, status, created_at, updated_at)
VALUES 
    ('tp_cntt_01', 'PROG-IT-01', 'Kỹ thuật Phần mềm Chuyên sâu', 'Chương trình đào tạo kỹ sư phần mềm từ cơ bản đến nâng cao, bao gồm Web, Mobile và An toàn thông tin.', 120, 15000000.00, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tp_data_02', 'PROG-DATA-02', 'Khoa học Dữ liệu & AI', 'Đào tạo phân tích dữ liệu lớn, trực quan hóa và ứng dụng Machine Learning trong doanh nghiệp.', 90, 18500000.00, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tp_mkt_03', 'PROG-MKT-03', 'Digital Marketing Thực chiến', 'Khóa học quản trị chiến dịch số, SEO, Performance Ads và sáng tạo nội dung đa kênh.', 45, 8500000.00, 'INACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tp_uiux_04', 'PROG-UIUX-04', 'Thiết kế Trải nghiệm Người dùng UI/UX', 'Nghiên cứu hành vi người dùng, wireframing, thiết kế Design System và Prototype với Figma.', 60, 11000000.00, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('tp_free_05', 'PROG-DEMO-NEW', 'Kỹ năng Giao tiếp & Thuyết trình Chuyên nghiệp', 'Chương trình mới khai báo, chưa liên kết lớp học nào để thử nghiệm tính năng Xóa cứng.', 30, 3500000.00, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (code) DO NOTHING;
