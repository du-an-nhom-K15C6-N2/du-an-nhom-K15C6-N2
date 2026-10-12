const programs = [
  {
    id: 'PROG-WEB',
    code: 'WEB-DEV',
    name: 'Kỹ thuật Phần mềm (Web Fullstack)',
    durationMonths: 6,
    totalCredits: 19,
    description: 'Đào tạo kỹ sư lập trình web từ Frontend đến Backend với Node.js, React, SQLite/PostgreSQL.',
    subjects: [
      { code: 'WEB101', name: 'Nhập môn Lập trình Web & HTML5/CSS3', credits: 3, sessions: 15 },
      { code: 'WEB102', name: 'Lập trình JavaScript nâng cao & ES6+', credits: 4, sessions: 20 },
      { code: 'WEB103', name: 'Phát triển Backend với Node.js & Express', credits: 4, sessions: 20 },
      { code: 'WEB104', name: 'Thiết kế & Quản trị Cơ sở dữ liệu', credits: 3, sessions: 15 },
      { code: 'WEB105', name: 'Đồ án Phát triển Ứng dụng Thực chiến', credits: 5, sessions: 25 }
    ]
  },
  {
    id: 'PROG-AI',
    code: 'AI-DATA',
    name: 'Khoa học Dữ liệu & Trí tuệ Nhân tạo',
    durationMonths: 8,
    totalCredits: 18,
    description: 'Chuyên sâu về phân tích dữ liệu, Machine Learning và các mô hình học sâu hiện đại.',
    subjects: [
      { code: 'AI101', name: 'Lập trình Python cho Khoa học Dữ liệu', credits: 3, sessions: 15 },
      { code: 'AI102', name: 'Toán cho Trí tuệ Nhân tạo & Xác suất thống kê', credits: 3, sessions: 15 },
      { code: 'AI103', name: 'Học máy Cơ bản & Ứng dụng (Machine Learning)', credits: 4, sessions: 20 },
      { code: 'AI104', name: 'Mô hình Học sâu & Thị giác Máy tính (Deep Learning)', credits: 4, sessions: 20 },
      { code: 'AI105', name: 'Đồ án Trí tuệ Nhân tạo Thực chiến', credits: 4, sessions: 20 }
    ]
  },
  {
    id: 'PROG-ENG',
    code: 'ENG-GLOBAL',
    name: 'Tiếng Anh Giao tiếp & Chuẩn Quốc tế',
    durationMonths: 4,
    totalCredits: 14,
    description: 'Rèn luyện phản xạ phát âm, giao tiếp thương mại và luyện đề chứng chỉ quốc tế.',
    subjects: [
      { code: 'ENG101', name: 'Ngữ âm Chuẩn & Phát xạ Giao tiếp', credits: 3, sessions: 15 },
      { code: 'ENG102', name: 'Tiếng Anh Học thuật & Viết luận', credits: 3, sessions: 15 },
      { code: 'ENG103', name: 'Thuyết trình & Đàm phán Thương mại', credits: 4, sessions: 20 },
      { code: 'ENG104', name: 'Chiến thuật Luyện đề & Thi chứng chỉ', credits: 4, sessions: 20 }
    ]
  },
  {
    id: 'PROG-SEC',
    code: 'CYBER-SEC',
    name: 'An toàn Thông tin & Quản trị Mạng',
    durationMonths: 6,
    totalCredits: 16,
    description: 'Quản trị hệ thống máy chủ mạng, phòng thủ bảo mật và đánh giá lỗ hổng an ninh.',
    subjects: [
      { code: 'SEC101', name: 'Mạng máy tính & Giao thức TCP/IP', credits: 3, sessions: 15 },
      { code: 'SEC102', name: 'Quản trị Máy chủ Linux & Windows Server', credits: 4, sessions: 20 },
      { code: 'SEC103', name: 'Phòng thủ Mạng & Bảo mật Hệ thống', credits: 4, sessions: 20 },
      { code: 'SEC104', name: 'Đồ án Đánh giá An ninh & Giám sát', credits: 5, sessions: 25 }
    ]
  }
];

module.exports = programs;
