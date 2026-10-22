const navigation = document.querySelector('#module-navigation');
const pageContent = document.querySelector('#page-content');
const breadcrumb = document.querySelector('#page-breadcrumb');
const sidebar = document.querySelector('.sidebar');
const defaultDashboard = pageContent.innerHTML;

const moduleDescriptions = {
  programs: 'Quản lý chương trình, ngành học và cấu trúc đào tạo.',
  courses: 'Quản lý danh mục học phần, tín chỉ và đề cương.',
  terms: 'Thiết lập năm học, học kỳ và thời gian đăng ký.',
  classes: 'Tổ chức lớp học và phân công giảng dạy.',
  schedules: 'Sắp xếp lịch học, ca học và phòng học.',
  attendance: 'Theo dõi chuyên cần và tình trạng tham gia lớp học.',
  people: 'Quản lý hồ sơ người học, giảng viên và nhân sự.',
  results: 'Theo dõi điểm số và kết quả học tập.',
  reports: 'Tổng hợp số liệu và báo cáo hoạt động đào tạo.',
  settings: 'Cấu hình các tùy chọn chung của hệ thống.'
};

function formatDate(date) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function renderModule(module) {
  const name = escapeHtml(module.name);
  const description = escapeHtml(moduleDescriptions[module.id] || 'Phân hệ quản lý đào tạo.');
  const fields = ['Mã định danh', 'Tên', 'Trạng thái', 'Ngày cập nhật'];

  breadcrumb.textContent = module.name;
  pageContent.innerHTML = `
    <div class="page-heading">
      <div><p class="eyebrow">${escapeHtml(module.group.toUpperCase())}</p><h1>${name}</h1><p class="page-subtitle">${description}</p></div>
      <span class="date-chip">${formatDate(new Date())}</span>
    </div>
    <div class="module-view">
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">KHUNG PHÂN HỆ</p><h2>Thông tin quản lý</h2></div><span class="status-pill">${escapeHtml(module.status)}</span></div>
        <p class="module-summary">${description} Màn hình này là khung ban đầu để phát triển nghiệp vụ và kết nối dữ liệu.</p>
        <ul class="module-fields">${fields.map(field => `<li>${field}</li>`).join('')}</ul>
      </section>
      <section class="panel">
        <div class="panel-heading"><div><p class="eyebrow">DỮ LIỆU</p><h2>Danh sách ${name.toLowerCase()}</h2></div></div>
        <div class="empty-state">Chưa có dữ liệu. Cần kết nối cơ sở dữ liệu và xây dựng API cho phân hệ này.</div>
      </section>
    </div>
    <footer class="page-footer"><span>EduManager · Khung phân hệ</span><span>Dữ liệu chưa được lưu</span></footer>`;
}

function activateModule(module) {
  navigation.querySelectorAll('[data-module-id]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.moduleId === module.id);
  });
  renderModule(module);
  sidebar.classList.remove('is-open');
}

function renderNavigation(modules) {
  const groups = new Map();
  modules.forEach(module => {
    if (!groups.has(module.group)) groups.set(module.group, []);
    groups.get(module.group).push(module);
  });

  const sections = [...groups].map(([group, items]) => `
    <p class="sidebar-label">${escapeHtml(group.toUpperCase())}</p>
    ${items.map(module => `
      <button class="nav-link" type="button" data-module-id="${escapeHtml(module.id)}">
        <span aria-hidden="true">${module.id === 'people' ? '♙' : '▦'}</span>${escapeHtml(module.name)}
      </button>`).join('')}`).join('');

  navigation.insertAdjacentHTML('beforeend', sections);
  navigation.querySelectorAll('[data-module-id]').forEach(button => {
    button.addEventListener('click', () => {
      const module = modules.find(item => item.id === button.dataset.moduleId);
      if (module) activateModule(module);
    });
  });
}

async function loadModules() {
  const status = document.querySelector('#api-status');
  const statusDetail = document.querySelector('#api-status-detail');

  try {
    const response = await fetch('/api/modules');
    if (!response.ok) throw new Error(`API trả về HTTP ${response.status}`);
    const result = await response.json();
    if (!result.success || !Array.isArray(result.data)) throw new Error('Dữ liệu phân hệ không đúng định dạng.');
    renderNavigation(result.data);
    status.textContent = 'Đang hoạt động';
    status.className = 'status-pill is-online';
    statusDetail.innerHTML = '<i class="status-dot"></i> Đã kết nối';
  } catch (error) {
    status.textContent = 'Không khả dụng';
    status.className = 'status-pill is-error';
    statusDetail.textContent = error.message || 'Không thể kết nối API.';
    const message = document.createElement('p');
    message.className = 'notice-box';
    message.setAttribute('role', 'alert');
    message.textContent = 'Không tải được danh sách phân hệ từ máy chủ. Hãy kiểm tra backend rồi tải lại trang.';
    navigation.append(message);
  }
}

const today = new Date();
document.querySelector('#today-label').textContent = formatDate(today);
document.querySelector('#date-chip').textContent = formatDate(today);
document.querySelector('#year-label').textContent = today.getFullYear();

navigation.querySelector('[data-module-id="dashboard"]').addEventListener('click', () => {
  navigation.querySelectorAll('[data-module-id]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.moduleId === 'dashboard');
  });
  breadcrumb.textContent = 'Tổng quan';
  pageContent.innerHTML = defaultDashboard;
  document.querySelector('#date-chip').textContent = formatDate(new Date());
  sidebar.classList.remove('is-open');
});

document.querySelector('#sidebar-toggle').addEventListener('click', () => {
  sidebar.classList.toggle('is-open');
});

loadModules();
