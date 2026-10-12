/**
 * app.js - Logic điều khiển giao diện Cổng Tư Vấn Tuyển Sinh
 * Module: Chuyển Lead Đã Chốt Sang Hồ Sơ Học Viên (DNKN-174)
 * Hỗ trợ cả 2 chế độ:
 * 1. Online: Kết nối API RESTful thực tế
 * 2. Offline Demo: Mở trực tiếp file index.html qua trình duyệt bằng double-click
 */

// Dữ liệu mẫu phục vụ Offline Demo
const fallbackLeads = [
  {
    id: "lead_001",
    fullName: "Phạm Minh Đức",
    phone: "0982345678",
    email: "duc.pm@gmail.com",
    major: "Kỹ thuật Phần mềm (CNTT)",
    course: "Kỹ thuật Phần mềm K15",
    address: "Số 15 Cầu Giấy, Hà Nội",
    dob: "2005-08-14",
    source: "Hotline Tuyển sinh",
    tuitionFee: 18500000,
    consultantName: "Nguyễn Thuỳ Linh",
    status: "closed_won",
    statusLabel: "Đã chốt",
    isLocked: false,
    notes: "Phụ huynh đã đóng cọc giữ chỗ 2.000.000đ ngày 10/10/2026. Đã đồng ý nộp hồ sơ nhập học.",
    createdAt: "2026-10-01T08:30:00.000Z"
  },
  {
    id: "lead_002",
    fullName: "Hoàng Thu Trang",
    phone: "0918765432",
    email: "trang.ht@gmail.com",
    major: "Khoa học Dữ liệu & Trí tuệ Nhân tạo",
    course: "Khoa học Dữ liệu K15",
    address: "Số 88 Giải Phóng, Hai Bà Trưng, Hà Nội",
    dob: "2005-11-20",
    source: "Fanpage Facebook",
    tuitionFee: 20000000,
    consultantName: "Trần Văn Bình",
    status: "closed_won",
    statusLabel: "Đã chốt",
    isLocked: false,
    notes: "Đã đạt học bổng 30% kỳ đầu. Đã chuyển khoản học phí đợt 1 qua ngân hàng.",
    createdAt: "2026-10-02T09:15:00.000Z"
  },
  {
    id: "lead_003",
    fullName: "Vũ Tuấn Kiệt",
    phone: "0976543210",
    email: "kiet.vt@gmail.com",
    major: "An toàn Thông tin & An ninh Mạng",
    course: "An toàn Thông tin K15",
    address: "Số 234 Hoàng Quốc Việt, Bắc Từ Liêm, Hà Nội",
    dob: "2005-05-10",
    source: "Website Tuyển sinh",
    tuitionFee: 19000000,
    consultantName: "Nguyễn Thuỳ Linh",
    status: "contacted",
    statusLabel: "Đang tư vấn",
    isLocked: false,
    notes: "Khách đang cân nhắc giữa 2 chuyên ngành, hẹn gọi lại vào tuần sau.",
    createdAt: "2026-10-05T11:00:00.000Z"
  },
  {
    id: "lead_004",
    fullName: "Đặng Thùy Dương",
    phone: "0905123456",
    email: "duong.dt@gmail.com",
    major: "Thiết kế Đồ họa Kỹ thuật số",
    course: "Thiết kế Đồ họa K15",
    address: "Số 45 Tam Khương, Đống Đa, Hà Nội",
    dob: "2005-03-25",
    source: "Ngày hội Tuyển sinh",
    tuitionFee: 17500000,
    consultantName: "Trần Văn Bình",
    status: "new",
    statusLabel: "Mới tiếp nhận",
    isLocked: false,
    notes: "Mới để lại thông tin cần tư vấn chương trình đào tạo và học phí.",
    createdAt: "2026-10-12T07:30:00.000Z"
  },
  {
    id: "lead_005",
    fullName: "Trần Bảo Nam",
    phone: "0934567891",
    email: "nam.tb@gmail.com",
    major: "Kỹ thuật Phần mềm (CNTT)",
    course: "Kỹ thuật Phần mềm K15",
    address: "Số 56 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    dob: "2005-09-02",
    source: "Người quen giới thiệu",
    tuitionFee: 18500000,
    consultantName: "Nguyễn Thuỳ Linh",
    status: "enrolled",
    statusLabel: "Đã nhập học",
    studentId: "stu_HV20260001",
    studentCode: "HV20260001",
    convertedAt: "2026-10-09T10:00:00.000Z",
    isLocked: true,
    notes: "Đã hoàn thành thủ tục nhập học ngày 09/10/2026. Đã khóa chỉnh sửa.",
    createdAt: "2026-09-28T14:00:00.000Z"
  }
];

const fallbackStudents = [
  {
    id: "stu_HV20260001",
    studentCode: "HV20260001",
    leadId: "lead_005",
    fullName: "Trần Bảo Nam",
    phone: "0934567891",
    email: "nam.tb@gmail.com",
    major: "Kỹ thuật Phần mềm (CNTT)",
    course: "Kỹ thuật Phần mềm K15",
    address: "Số 56 Nguyễn Trãi, Thanh Xuân, Hà Nội",
    enrolledDate: "2026-10-09",
    status: "enrolled",
    statusLabel: "Đang theo học"
  }
];

let state = {
  isOnline: false,
  leads: [],
  students: [],
  emails: [],
  selectedLead: null,
  activeTab: 'leads'
};

// ====================================================================
// TIỆN ÍCH TOAST & ĐỊNH DẠNG
// ====================================================================

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-600 text-white',
    error: 'bg-rose-600 text-white',
    warning: 'bg-amber-500 text-white',
    info: 'bg-indigo-600 text-white'
  };

  const icons = {
    success: 'fa-circle-check',
    error: 'fa-circle-xmark',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
  };

  toast.className = `pointer-events-auto flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgColors[type] || bgColors.info} animate-scale-in`;
  toast.innerHTML = `
    <i class="fa-solid ${icons[type]} text-base"></i>
    <span class="flex-1">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white ml-2">&times;</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function formatCurrency(num) {
  if (!num) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  } catch (e) {
    return dateStr;
  }
}

// Sinh mã học viên tự động (dùng cho offline mode)
function generateNextStudentCode(students) {
  const year = new Date().getFullYear();
  const prefix = `HV${year}`;
  const regex = new RegExp(`^HV${year}(\\d{4})$`);

  let maxSeq = 0;
  students.forEach(s => {
    const code = s.studentCode || '';
    const match = code.match(regex);
    if (match && match[1]) {
      const seq = parseInt(match[1], 10);
      if (seq > maxSeq) maxSeq = seq;
    }
  });

  return `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
}

// ====================================================================
// KẾT NỐI API & TẢI DỮ LIỆU
// ====================================================================

async function checkConnection() {
  const banner = document.getElementById('connection-banner');
  const text = document.getElementById('connection-text');

  try {
    const res = await fetch('/api/leads');
    if (res.ok) {
      state.isOnline = true;
      if (banner) banner.className = 'bg-emerald-50 border-b border-emerald-200 py-1.5 px-4 text-center text-xs text-emerald-800 flex items-center justify-center space-x-2';
      if (text) text.innerHTML = '<i class="fa-solid fa-server mr-1"></i>Đang kết nối Máy Chủ API Backend (Live API Mode)';
      return true;
    }
  } catch (e) {
    // Offline mode
  }

  state.isOnline = false;
  if (banner) banner.className = 'bg-amber-50 border-b border-amber-200 py-1.5 px-4 text-center text-xs text-amber-800 flex items-center justify-center space-x-2';
  if (text) text.innerHTML = '<i class="fa-solid fa-laptop-code mr-1"></i>Chế độ Offline Demo (Đang mở trực tiếp HTML, dữ liệu lưu cục bộ trong trình duyệt)';
  return false;
}

async function loadData() {
  if (state.isOnline) {
    try {
      const [leadsRes, studentsRes] = await Promise.all([
        fetch('/api/leads'),
        fetch('/api/students')
      ]);
      const leadsJson = await leadsRes.json();
      const studentsJson = await studentsRes.json();

      if (leadsJson.success) state.leads = leadsJson.data;
      if (studentsJson.success) state.students = studentsJson.data;
      updateStats();
      renderLeadsTable();
      renderStudentsTable();
      return;
    } catch (e) {
      console.warn('Lỗi gọi API, chuyển sang dữ liệu cục bộ:', e);
    }
  }

  // Đọc từ LocalStorage nếu có
  const localLeads = localStorage.getItem('lead_conversion_leads');
  const localStudents = localStorage.getItem('lead_conversion_students');
  const localEmails = localStorage.getItem('lead_conversion_emails');

  state.leads = localLeads ? JSON.parse(localLeads) : [...fallbackLeads];
  state.students = localStudents ? JSON.parse(localStudents) : [...fallbackStudents];
  state.emails = localEmails ? JSON.parse(localEmails) : [
    {
      to: "nam.tb@gmail.com",
      studentCode: "HV20260001",
      fullName: "Trần Bảo Nam",
      subject: "[Hệ Thống Quản Lý Đào Tạo] Chào mừng tân học viên - Thông tin tài khoản HV20260001",
      sentAt: "2026-10-09T10:00:01.000Z",
      status: "sent"
    }
  ];

  updateStats();
  renderLeadsTable();
  renderStudentsTable();
  renderEmailsTable();
}

function updateStats() {
  const total = state.leads.length;
  const closed = state.leads.filter(l => l.status === 'closed_won').length;
  const enrolled = state.students.length;
  const emailsCount = state.emails.length || enrolled;

  document.getElementById('stat-total-leads').textContent = total;
  document.getElementById('stat-closed-leads').textContent = closed;
  document.getElementById('stat-enrolled-students').textContent = enrolled;
  document.getElementById('stat-sent-emails').textContent = emailsCount;
  document.getElementById('badge-student-count').textContent = `${enrolled} học viên`;
}

// ====================================================================
// RENDER DANH SÁCH BẢNG LEADS
// ====================================================================

function renderLeadsTable(filteredList = null) {
  const tbody = document.getElementById('leads-table-body');
  const list = filteredList || state.leads;

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center py-8 text-slate-400 text-xs">
          <i class="fa-solid fa-inbox text-3xl mb-2 block"></i>
          Không có lead nào phù hợp với bộ lọc
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(lead => {
    const isClosedWon = lead.status === 'closed_won';
    const isEnrolled = lead.status === 'enrolled';

    let statusBadge = '';
    if (isClosedWon) {
      statusBadge = `<span class="badge-closed-won px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5"><i class="fa-solid fa-handshake"></i>Đã chốt</span>`;
    } else if (isEnrolled) {
      statusBadge = `<span class="badge-enrolled px-2.5 py-1 rounded-full text-xs font-bold inline-flex items-center gap-1.5"><i class="fa-solid fa-lock"></i>Đã nhập học (Khóa)</span>`;
    } else if (lead.status === 'contacted') {
      statusBadge = `<span class="badge-contacted px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5"><i class="fa-regular fa-comments"></i>Đang tư vấn</span>`;
    } else {
      statusBadge = `<span class="badge-new px-2.5 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5"><i class="fa-regular fa-clock"></i>Mới tiếp nhận</span>`;
    }

    let actionBtn = '';
    if (isClosedWon) {
      actionBtn = `
        <button onclick="openConvertModal('${lead.id}')"
          class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-1.5 mx-auto">
          <i class="fa-solid fa-bolt text-amber-300"></i>
          <span>Chuyển Học Viên</span>
        </button>
      `;
    } else if (isEnrolled) {
      actionBtn = `
        <span class="text-xs text-purple-700 font-semibold inline-flex items-center gap-1">
          <i class="fa-solid fa-circle-check text-emerald-500"></i>
          <span>Mã: ${lead.studentCode || 'Đã có'}</span>
        </span>
      `;
    } else {
      actionBtn = `
        <span class="text-xs text-slate-400 italic">Chưa chốt hồ sơ</span>
      `;
    }

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="py-3 px-4">
          <div class="font-bold text-slate-900">${lead.fullName}</div>
          <div class="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
            <i class="fa-solid fa-bullhorn text-[9px]"></i> Nguồn: ${lead.source || 'Trực tiếp'}
          </div>
        </td>
        <td class="py-3 px-4">
          <div class="text-xs font-mono font-semibold text-slate-800">${lead.phone}</div>
          <div class="text-xs text-slate-500">${lead.email}</div>
        </td>
        <td class="py-3 px-4">
          <div class="font-semibold text-xs text-indigo-700">${lead.major || lead.course}</div>
          <div class="text-[11px] text-slate-400">${lead.address || 'Chưa cập nhật địa chỉ'}</div>
        </td>
        <td class="py-3 px-4">
          <span class="font-semibold text-xs text-slate-700">${formatCurrency(lead.tuitionFee)}</span>
        </td>
        <td class="py-3 px-4">
          ${statusBadge}
        </td>
        <td class="py-3 px-4 text-center">
          ${actionBtn}
        </td>
      </tr>
    `;
  }).join('');
}

// ====================================================================
// RENDER BẢNG HỌC VIÊN & BẢNG EMAIL
// ====================================================================

function renderStudentsTable() {
  const tbody = document.getElementById('students-table-body');
  if (!state.students.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">Chưa có học viên nào</td></tr>`;
    return;
  }

  tbody.innerHTML = state.students.map(s => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="py-3 px-4 font-mono font-bold text-indigo-700 text-xs">${s.studentCode}</td>
      <td class="py-3 px-4 font-bold text-slate-900 text-xs">${s.fullName}</td>
      <td class="py-3 px-4 text-xs font-mono text-slate-600">${s.email}</td>
      <td class="py-3 px-4 text-xs font-semibold text-slate-700">${s.course || s.major}</td>
      <td class="py-3 px-4 text-xs text-slate-500">${formatDate(s.enrolledDate)}</td>
      <td class="py-3 px-4">
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          ✓ Đang theo học
        </span>
      </td>
    </tr>
  `).join('');
}

function renderEmailsTable() {
  const tbody = document.getElementById('emails-table-body');
  if (!state.emails.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400 text-xs">Chưa có email nào</td></tr>`;
    return;
  }

  tbody.innerHTML = state.emails.map(e => `
    <tr class="hover:bg-slate-50 transition-colors">
      <td class="py-3 px-4 text-xs font-bold text-slate-800">${e.fullName || '-'}</td>
      <td class="py-3 px-4 text-xs font-mono text-slate-600">${e.to}</td>
      <td class="py-3 px-4 text-xs text-slate-700 font-medium">${e.subject}</td>
      <td class="py-3 px-4 text-xs text-slate-500">${formatDate(e.sentAt)}</td>
      <td class="py-3 px-4">
        <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-max">
          <i class="fa-solid fa-check"></i> Đã gửi
        </span>
      </td>
    </tr>
  `).join('');
}

// ====================================================================
// BỘ LỌC LEADS
// ====================================================================

function filterLeads() {
  const statusFilter = document.getElementById('select-status-filter').value;
  const search = document.getElementById('input-search-lead').value.trim().toLowerCase();

  let list = state.leads;
  if (statusFilter !== 'all') {
    list = list.filter(l => l.status === statusFilter);
  }
  if (search) {
    list = list.filter(l =>
      (l.fullName && l.fullName.toLowerCase().includes(search)) ||
      (l.phone && l.phone.includes(search)) ||
      (l.email && l.email.toLowerCase().includes(search)) ||
      (l.major && l.major.toLowerCase().includes(search))
    );
  }
  renderLeadsTable(list);
}

// ====================================================================
// CHUYỂN TAB GIAO DIỆN
// ====================================================================

function switchTab(tab) {
  state.activeTab = tab;
  ['leads', 'students', 'emails'].forEach(t => {
    document.getElementById(`tab-content-${t}`).classList.add('hidden');
    const btn = document.getElementById(`tab-btn-${t}`);
    btn.className = 'px-4 py-2 rounded-xl text-sm font-semibold bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors flex items-center gap-2';
  });

  document.getElementById(`tab-content-${tab}`).classList.remove('hidden');
  const activeBtn = document.getElementById(`tab-btn-${tab}`);
  activeBtn.className = 'px-4 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white shadow-sm transition-colors flex items-center gap-2';

  const filterBar = document.getElementById('leads-filter-bar');
  if (filterBar) {
    filterBar.style.display = tab === 'leads' ? 'flex' : 'none';
  }
}

// ====================================================================
// MODAL XÁC NHẬN CHUYỂN ĐỔI LEAD
// ====================================================================

function openConvertModal(leadId) {
  const lead = state.leads.find(l => l.id === leadId);
  if (!lead) return;

  state.selectedLead = lead;

  // Xem trước mã học viên tiếp theo
  const previewCode = generateNextStudentCode(state.students);
  document.getElementById('modal-preview-student-code').textContent = previewCode;

  // Điền dữ liệu sao chép (tư vấn viên KHÔNG CẦN NHẬP LẠI)
  document.getElementById('modal-lead-fullname').textContent = lead.fullName;
  document.getElementById('modal-lead-phone').textContent = lead.phone;
  document.getElementById('modal-lead-email').textContent = lead.email;
  document.getElementById('modal-lead-course').textContent = lead.course || lead.major;
  document.getElementById('modal-lead-address').textContent = lead.address || 'Chưa cập nhật';

  document.getElementById('modal-convert').classList.remove('hidden');
}

function closeConvertModal() {
  document.getElementById('modal-convert').classList.add('hidden');
  state.selectedLead = null;
}

// ====================================================================
// THỰC HIỆN CHUYỂN ĐỔI (SUBTASK 1, 2, 3, 4, 5, 6)
// ====================================================================

async function executeConversion() {
  if (!state.selectedLead) return;

  const lead = state.selectedLead;
  const btn = document.getElementById('btn-confirm-convert');
  const btnText = document.getElementById('btn-convert-text');
  btn.disabled = true;
  btnText.textContent = 'Đang chuyển đổi...';

  try {
    if (state.isOnline) {
      // GỌI API BACKEND
      const res = await fetch(`/api/leads/${lead.id}/convert`, {
        method: 'POST'
      });
      const result = await res.json();

      if (res.ok && result.success) {
        showSuccessModal(result.data);
        closeConvertModal();
        await loadData();
        showToast('Chuyển đổi thành học viên thành công!', 'success');
      } else {
        showToast(result.message || 'Lỗi khi chuyển đổi lead', 'error');
      }
    } else {
      // CHẾ ĐỘ OFFLINE DEMO
      const newCode = generateNextStudentCode(state.students);
      const tempPass = `Edu@${new Date().getFullYear()}`;

      // 1. Tạo học viên mới
      const newStudent = {
        id: `stu_${newCode}`,
        studentCode: newCode,
        leadId: lead.id,
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        major: lead.major,
        course: lead.course || lead.major,
        address: lead.address,
        dob: lead.dob,
        source: lead.source,
        tuitionFee: lead.tuitionFee,
        enrolledDate: new Date().toISOString().split('T')[0],
        status: 'enrolled',
        statusLabel: 'Đang theo học'
      };
      state.students.push(newStudent);

      // 2. Cập nhật Lead sang 'enrolled' và khóa sửa
      lead.status = 'enrolled';
      lead.statusLabel = 'Đã nhập học';
      lead.isLocked = true;
      lead.studentCode = newCode;
      lead.studentId = newStudent.id;
      lead.convertedAt = new Date().toISOString();

      // 3. Ghi nhận gửi email
      state.emails.unshift({
        to: lead.email,
        studentCode: newCode,
        fullName: lead.fullName,
        subject: `[Hệ Thống Quản Lý Đào Tạo] Chào mừng tân học viên - Thông tin tài khoản ${newCode}`,
        sentAt: new Date().toISOString(),
        status: 'sent'
      });

      // Lưu LocalStorage
      localStorage.setItem('lead_conversion_leads', JSON.stringify(state.leads));
      localStorage.setItem('lead_conversion_students', JSON.stringify(state.students));
      localStorage.setItem('lead_conversion_emails', JSON.stringify(state.emails));

      showSuccessModal({
        studentCode: newCode,
        account: {
          username: lead.email,
          temporaryPassword: tempPass
        }
      });
      closeConvertModal();
      updateStats();
      renderLeadsTable();
      renderStudentsTable();
      renderEmailsTable();
      showToast('Chuyển đổi thành học viên thành công (Lưu Offline)!', 'success');
    }
  } catch (err) {
    console.error('Lỗi khi chuyển đổi lead:', err);
    showToast('Lỗi kết nối khi chuyển đổi lead.', 'error');
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Xác Nhận Chuyển Đổi Ngay';
  }
}

// ====================================================================
// MODAL THÀNH CÔNG
// ====================================================================

function showSuccessModal(data) {
  document.getElementById('success-student-code').textContent = data.studentCode;
  document.getElementById('success-username').textContent = data.account.username;
  document.getElementById('success-password').textContent = data.account.temporaryPassword;
  document.getElementById('modal-success').classList.remove('hidden');
}

function closeSuccessModal() {
  document.getElementById('modal-success').classList.add('hidden');
}

// ====================================================================
// KHỞI TẠO KHI TẢI TRANG
// ====================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await checkConnection();
  await loadData();
});
