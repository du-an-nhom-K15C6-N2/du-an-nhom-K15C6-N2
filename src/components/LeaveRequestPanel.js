/**
 * LeaveRequestPanel.js - Giao diện Đơn xin phép vắng & Theo dõi kết quả duyệt
 * Đáp ứng User Story: Là Học viên, tôi muốn gửi đơn xin phép vắng và theo dõi kết quả duyệt,
 * để nghỉ có lý do chính đáng không bị tính là vắng không phép.
 */

import './LeaveRequestPanel.css';
import {
  getMyLeaveRequests,
  createLeaveRequest,
  cancelLeaveRequest,
  getAllLeaveRequests,
  reviewLeaveRequest,
  getLeaveOptions
} from '../core/leaveRequestService.js';
import { authState } from '../core/authState.js';
import { getAuthSession } from '../core/storage.js';

export function renderLeaveRequestPanel(container) {
  const state = authState.getState();
  const session = getAuthSession();
  const user = state.user || session.user;
  const role = (state.role || session.role || 'STUDENT').toUpperCase();
  const isStudent = role === 'STUDENT';

  let currentRequests = [];
  let availableClasses = [];
  let activeFilter = 'all';
  let searchQuery = '';

  function getLocalToday() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]);
  }

  function getStatusBadge(status) {
    switch (status) {
      case 'pending':
        return '<span class="leave-chip is-pending">⏳ Chờ phê duyệt</span>';
      case 'approved':
        return '<span class="leave-chip is-approved">✓ Đã chấp thuận</span>';
      case 'rejected':
        return '<span class="leave-chip is-rejected">✕ Đã từ chối</span>';
      case 'cancelled':
        return '<span class="leave-chip is-cancelled">⊘ Đã huỷ</span>';
      default:
        return `<span class="leave-chip">${escapeHtml(status)}</span>`;
    }
  }

  container.innerHTML = `
    <div class="leave-request-panel" id="leave-request-root">
      <!-- Header Card -->
      <section class="leave-header-card">
        <div class="leave-header-top">
          <div class="leave-header-title">
            <div class="leave-header-icon">📝</div>
            <div>
              <h2>${isStudent ? 'Đơn Xin Phép Vắng &amp; Theo Dõi Kết Quả Duyệt' : 'Phê Duyệt Đơn Xin Phép Vắng Của Học Viên'}</h2>
              <p class="leave-header-desc">
                ${isStudent
                  ? 'Gửi đơn xin phép nghỉ học có lý do chính đáng để không bị tính là vắng không phép. Hệ thống tự động ghi nhận điểm danh Có phép (excused) ngay khi đơn được phê duyệt.'
                  : 'Kiểm tra, xem xét và phê duyệt đơn xin nghỉ phép của học viên. Khi duyệt, hệ thống tự động đồng bộ trạng thái Có phép (excused) vào sổ điểm danh.'}
              </p>
            </div>
          </div>
          <span class="leave-header-benefit">🛡️ Bảo lưu điểm chuyên cần &amp; quyền lợi học viên</span>
        </div>
      </section>

      <!-- KPI Summary -->
      <section class="leave-stats-grid" id="leave-stats-container">
        <div class="leave-stat-card is-total">
          <span>Tổng số đơn</span>
          <strong id="stat-total">0</strong>
          <small>Hồ sơ lưu trữ trên hệ thống</small>
        </div>
        <div class="leave-stat-card is-pending">
          <span>Đang chờ duyệt</span>
          <strong id="stat-pending">0</strong>
          <small>Đang đợi giảng viên/quản lý phản hồi</small>
        </div>
        <div class="leave-stat-card is-approved">
          <span>Đã chấp thuận</span>
          <strong id="stat-approved">0</strong>
          <small>✓ Đã tự động tính Có phép (excused)</small>
        </div>
        <div class="leave-stat-card is-rejected">
          <span>Từ chối</span>
          <strong id="stat-rejected">0</strong>
          <small>Không hợp lệ hoặc không được duyệt</small>
        </div>
      </section>

      ${isStudent ? `
        <!-- Form gửi đơn dành cho Học viên -->
        <section class="leave-form-card" id="leave-form-wrapper">
          <h3>
            <span>✍️</span> Gửi đơn xin phép vắng mới
          </h3>
          <form id="leave-submission-form">
            <div class="leave-form-grid">
              <div class="leave-form-group">
                <label for="leave-class-select">Lớp học <span class="required">*</span></label>
                <select id="leave-class-select" name="className" class="leave-form-control" required>
                  <option value="">-- Đang nạp danh sách lớp --</option>
                </select>
              </div>

              <div class="leave-form-group">
                <label for="leave-date-input">Ngày xin nghỉ <span class="required">*</span></label>
                <input
                  type="date"
                  id="leave-date-input"
                  name="leaveDate"
                  class="leave-form-control"
                  value="${getLocalToday()}"
                  required
                />
              </div>

              <div class="leave-form-group is-full">
                <label for="leave-reason-input">Lý do xin vắng <span class="required">*</span> (tối thiểu 5 ký tự)</label>
                <textarea
                  id="leave-reason-input"
                  name="reason"
                  class="leave-form-control"
                  rows="3"
                  placeholder="Vui lòng nêu rõ lý do chính đáng: ốm/sốt, đi khám bệnh, việc gia đình cấp thiết, thi chứng chỉ..."
                  required
                ></textarea>
              </div>

              <div class="leave-form-group is-full">
                <label for="leave-evidence-input">Minh chứng / Giấy tờ đính kèm (không bắt buộc)</label>
                <input
                  type="text"
                  id="leave-evidence-input"
                  name="evidence"
                  class="leave-form-control"
                  placeholder="Đường dẫn ảnh/tài liệu (Google Drive, ảnh đơn viết tay, giấy hẹn khám...)"
                />
              </div>
            </div>

            <div class="leave-form-actions">
              <button type="submit" class="btn-primary-glow" id="btn-submit-leave">
                <span>🚀</span> Gửi đơn xin phép vắng
              </button>
            </div>
            <div class="leave-feedback" id="leave-feedback-banner"></div>
          </form>
        </section>
      ` : ''}

      <!-- Danh sách đơn & Bộ lọc -->
      <section class="leave-list-card">
        <div class="leave-toolbar">
          <div class="leave-tabs" id="leave-filter-tabs">
            <button type="button" class="leave-tab-btn is-active" data-filter="all">Tất cả</button>
            <button type="button" class="leave-tab-btn" data-filter="pending">Chờ duyệt</button>
            <button type="button" class="leave-tab-btn" data-filter="approved">Đã chấp thuận</button>
            <button type="button" class="leave-tab-btn" data-filter="rejected">Từ chối</button>
          </div>

          <div style="display:flex; gap:0.5rem; align-items:center;">
            <input
              type="search"
              class="leave-search-input"
              id="leave-search-box"
              placeholder="Tìm theo lớp, lý do, người gửi..."
            />
            <button type="button" class="btn-secondary" id="btn-refresh-leave" title="Tải lại danh sách">
              🔄 Làm mới
            </button>
          </div>
        </div>

        <div class="leave-table-wrap">
          <table class="leave-table">
            <thead>
              <tr>
                ${!isStudent ? '<th>Học viên</th>' : ''}
                <th>Lớp học</th>
                <th>Ngày xin nghỉ</th>
                <th>Lý do xin vắng</th>
                <th>Trạng thái duyệt</th>
                <th>Kết quả &amp; Ghi chú điểm danh</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody id="leave-table-body">
              <tr>
                <td colspan="${isStudent ? 6 : 7}" style="text-align: center; padding: 2rem;">
                  Đang tải dữ liệu đơn xin phép...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Modal Xem xét / Duyệt / Từ chối (Dành cho Reviewer) -->
      <div id="leave-review-modal-mount"></div>
    </div>
  `;

  // Nạp danh sách lớp cho học viên
  async function loadClasses() {
    if (!isStudent) return;
    const select = container.querySelector('#leave-class-select');
    if (!select) return;

    try {
      const options = await getLeaveOptions();
      availableClasses = options.classes || [];
      select.replaceChildren();

      if (availableClasses.length === 0) {
        select.add(new Option('Chưa có danh sách lớp học', ''));
        return;
      }

      select.add(new Option('-- Chọn lớp học của bạn --', ''));
      availableClasses.forEach(cls => {
        const option = new Option(`${cls.code} - ${cls.name}`, cls.name);
        option.dataset.classId = cls.id;
        select.add(option);
      });
    } catch (error) {
      console.warn('Lỗi nạp lớp học:', error);
      select.replaceChildren(new Option('Không thể tải lớp học. Vui lòng thử lại.', ''));
    }
  }

  // Tải danh sách đơn
  async function fetchRequests() {
    const tableBody = container.querySelector('#leave-table-body');
    if (!tableBody) return;

    try {
      if (isStudent) {
        currentRequests = await getMyLeaveRequests();
      } else {
        currentRequests = await getAllLeaveRequests();
      }
      updateStats();
      renderTable();
    } catch (error) {
      console.error('Lỗi tải danh sách đơn xin phép:', error);
      tableBody.innerHTML = `
        <tr>
          <td colspan="${isStudent ? 6 : 7}" style="text-align:center; color:#f87171; padding:2rem;">
            ${escapeHtml(error.message || 'Không thể tải danh sách đơn xin phép.')}
          </td>
        </tr>
      `;
    }
  }

  // Cập nhật thẻ KPI
  function updateStats() {
    const total = currentRequests.length;
    const pending = currentRequests.filter(r => r.status === 'pending').length;
    const approved = currentRequests.filter(r => r.status === 'approved').length;
    const rejected = currentRequests.filter(r => r.status === 'rejected').length;

    const elTotal = container.querySelector('#stat-total');
    const elPending = container.querySelector('#stat-pending');
    const elApproved = container.querySelector('#stat-approved');
    const elRejected = container.querySelector('#stat-rejected');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elApproved) elApproved.textContent = approved;
    if (elRejected) elRejected.textContent = rejected;
  }

  // Render bảng
  function renderTable() {
    const tableBody = container.querySelector('#leave-table-body');
    if (!tableBody) return;

    let filtered = currentRequests.slice();

    // Lọc theo tab trạng thái
    if (activeFilter !== 'all') {
      filtered = filtered.filter(item => item.status === activeFilter);
    }

    // Lọc theo ô tìm kiếm
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(item =>
        (item.className && item.className.toLowerCase().includes(q))
        || (item.reason && item.reason.toLowerCase().includes(q))
        || (item.studentName && item.studentName.toLowerCase().includes(q))
        || (item.studentEmail && item.studentEmail.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${isStudent ? 6 : 7}">
            <div class="leave-empty-state">
              <div class="leave-empty-icon">📭</div>
              <p>Chưa có đơn xin phép vắng nào phù hợp với điều kiện lọc.</p>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    tableBody.innerHTML = filtered.map(req => {
      const createdDate = new Date(req.createdAt).toLocaleDateString('vi-VN');

      let attendanceInfo = '—';
      if (req.status === 'approved') {
        attendanceInfo = `
          <div>
            <div class="excused-tag">✓ Đã tính Có phép (excused)</div>
            <small style="color:#94a3b8; display:block; margin-top:2px;">
              Duyệt bởi: <strong>${escapeHtml(req.reviewedByName || 'Giảng viên')}</strong>
              ${req.reviewNote ? `<br><em>"${escapeHtml(req.reviewNote)}"</em>` : ''}
            </small>
          </div>
        `;
      } else if (req.status === 'rejected') {
        attendanceInfo = `
          <div style="color:#f87171; font-size:0.82rem;">
            <strong>Từ chối bởi ${escapeHtml(req.reviewedByName || 'Giảng viên')}</strong>
            ${req.reviewNote ? `<br>Lý do: <em>${escapeHtml(req.reviewNote)}</em>` : ''}
          </div>
        `;
      } else if (req.status === 'cancelled') {
        attendanceInfo = '<span style="color:#94a3b8; font-size:0.82rem;">Học viên đã huỷ đơn</span>';
      } else {
        attendanceInfo = '<span style="color:#fbbf24; font-size:0.82rem;">⏳ Đang chờ giáo viên/quản lý duyệt</span>';
      }

      let actions = '—';
      if (isStudent) {
        if (req.status === 'pending') {
          actions = `
            <button type="button" class="btn-xs-cancel" data-action="cancel" data-id="${req.id}">
              Huỷ đơn
            </button>
          `;
        }
      } else {
        // Cho người duyệt (Teacher/Admin/Manager)
        if (req.status === 'pending') {
          actions = `
            <div class="leave-row-actions">
              <button type="button" class="btn-xs-approve" data-action="approve" data-id="${req.id}" data-name="${escapeHtml(req.studentName)}" data-date="${escapeHtml(req.leaveDate)}">
                Duyệt
              </button>
              <button type="button" class="btn-xs-reject" data-action="reject" data-id="${req.id}" data-name="${escapeHtml(req.studentName)}">
                Từ chối
              </button>
            </div>
          `;
        }
      }

      return `
        <tr>
          ${!isStudent ? `
            <td>
              <strong>${escapeHtml(req.studentName)}</strong>
              <small style="display:block; color:#94a3b8;">${escapeHtml(req.studentEmail)}</small>
            </td>
          ` : ''}
          <td>
            <strong>${escapeHtml(req.className)}</strong>
            <small style="display:block; color:#94a3b8;">Gửi ngày: ${createdDate}</small>
          </td>
          <td>
            <span style="font-weight:600; color:#cbd5e1;">📅 ${escapeHtml(req.leaveDate)}</span>
          </td>
          <td>
            <div>${escapeHtml(req.reason)}</div>
            ${req.evidence ? `<small style="display:block; margin-top:2px;"><a href="${escapeHtml(req.evidence)}" target="_blank" rel="noopener noreferrer" style="color:#818cf8; text-decoration:underline;">📎 Xem minh chứng</a></small>` : ''}
          </td>
          <td>${getStatusBadge(req.status)}</td>
          <td>${attendanceInfo}</td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');
  }

  // Sự kiện gửi đơn xin nghỉ phép
  function bindFormEvents() {
    const form = container.querySelector('#leave-submission-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('#btn-submit-leave');
      const feedback = form.querySelector('#leave-feedback-banner');

      const selectClass = form.elements.className;
      const selectedOption = selectClass.selectedOptions[0];
      const classId = selectedOption?.dataset?.classId || null;
      const className = selectClass.value;
      const leaveDate = form.elements.leaveDate.value;
      const reason = form.elements.reason.value;
      const evidence = form.elements.evidence.value;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>⏳</span> Đang gửi đơn...';
      feedback.className = 'leave-feedback';
      feedback.textContent = '';

      try {
        const response = await createLeaveRequest({
          classId,
          className,
          leaveDate,
          reason,
          evidence
        });

        feedback.textContent = response.message || 'Đã gửi đơn xin phép vắng thành công.';
        feedback.className = 'leave-feedback is-visible is-success';
        form.reset();
        form.elements.leaveDate.value = getLocalToday();

        await fetchRequests();
      } catch (error) {
        feedback.textContent = error.message || 'Không thể gửi đơn xin nghỉ phép. Vui lòng kiểm tra lại.';
        feedback.className = 'leave-feedback is-visible is-error';
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>🚀</span> Gửi đơn xin phép vắng';
      }
    });
  }

  // Xử lý modal duyệt / từ chối
  function openReviewModal({ id, studentName, action, leaveDate = '' }) {
    const modalMount = container.querySelector('#leave-review-modal-mount');
    if (!modalMount) return;

    const isApprove = action === 'approve';
    modalMount.innerHTML = `
      <div class="leave-modal-backdrop" id="modal-review-backdrop">
        <div class="leave-modal-dialog">
          <h3>${isApprove ? '✓ Duyệt đơn xin phép vắng' : '✕ Từ chối đơn xin phép vắng'}</h3>
          <p style="color:#cbd5e1; font-size:0.92rem; margin:0;">
            Học viên: <strong>${escapeHtml(studentName)}</strong>
            ${leaveDate ? `<br>Ngày xin nghỉ: <strong>${escapeHtml(leaveDate)}</strong>` : ''}
          </p>

          ${isApprove ? `
            <div style="background:rgba(16,185,129,0.12); border:1px solid rgba(16,185,129,0.25); border-radius:0.5rem; padding:0.75rem; color:#34d399; font-size:0.85rem;">
              ℹ️ <strong>Tự động đồng bộ điểm danh:</strong> Khi phê duyệt, học viên sẽ được ghi nhận trạng thái <strong>Có phép (excused)</strong> trong sổ điểm danh lớp học, không bị tính là vắng không phép.
            </div>
          ` : ''}

          <div class="leave-form-group">
            <label for="modal-review-note">
              ${isApprove ? 'Ghi chú / Phản hồi cho học sinh (không bắt buộc):' : 'Lý do từ chối (bắt buộc):'}
            </label>
            <textarea
              id="modal-review-note"
              class="leave-form-control"
              rows="3"
              placeholder="${isApprove ? 'Ví dụ: Đã nhận đơn, chúc em mau khỏe.' : 'Vui lòng nêu rõ lý do từ chối...'}"
            ></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:0.5rem;">
            <button type="button" class="btn-secondary" id="btn-modal-cancel">Đóng</button>
            <button
              type="button"
              class="${isApprove ? 'btn-xs-approve' : 'btn-xs-reject'}"
              style="padding:0.6rem 1.2rem; font-size:0.9rem;"
              id="btn-modal-confirm"
            >
              ${isApprove ? 'Xác nhận Duyệt đơn' : 'Xác nhận Từ chối'}
            </button>
          </div>
          <div class="leave-feedback" id="modal-feedback"></div>
        </div>
      </div>
    `;

    const closeBtn = modalMount.querySelector('#btn-modal-cancel');
    const confirmBtn = modalMount.querySelector('#btn-modal-confirm');
    const backdrop = modalMount.querySelector('#modal-review-backdrop');
    const noteInput = modalMount.querySelector('#modal-review-note');
    const feedback = modalMount.querySelector('#modal-feedback');

    function closeModal() {
      modalMount.replaceChildren();
    }

    closeBtn.addEventListener('click', closeModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal();
    });

    confirmBtn.addEventListener('click', async () => {
      const reviewNote = noteInput.value.trim();

      if (!isApprove && reviewNote.length < 3) {
        feedback.textContent = 'Vui lòng nhập lý do từ chối (tối thiểu 3 ký tự).';
        feedback.className = 'leave-feedback is-visible is-error';
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Đang xử lý...';

      try {
        await reviewLeaveRequest(id, {
          status: isApprove ? 'approved' : 'rejected',
          reviewNote
        });
        closeModal();
        await fetchRequests();
      } catch (error) {
        feedback.textContent = error.message || 'Có lỗi xảy ra khi xử lý đơn.';
        feedback.className = 'leave-feedback is-visible is-error';
        confirmBtn.disabled = false;
        confirmBtn.textContent = isApprove ? 'Xác nhận Duyệt đơn' : 'Xác nhận Từ chối';
      }
    });
  }

  // Sự kiện bảng & bộ lọc
  function bindTableEvents() {
    // Tabs lọc
    container.querySelectorAll('.leave-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.leave-tab-btn').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        activeFilter = btn.dataset.filter || 'all';
        renderTable();
      });
    });

    // Tìm kiếm
    const searchBox = container.querySelector('#leave-search-box');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderTable();
      });
    }

    // Làm mới
    const refreshBtn = container.querySelector('#btn-refresh-leave');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        await fetchRequests();
        refreshBtn.disabled = false;
      });
    }

    // Thao tác dòng: Huỷ đơn hoặc Duyệt / Từ chối
    const tableBody = container.querySelector('#leave-table-body');
    if (tableBody) {
      tableBody.addEventListener('click', async (e) => {
        const target = e.target.closest('button[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        if (action === 'cancel') {
          if (!confirm('Bạn có chắc chắn muốn huỷ đơn xin phép vắng này?')) return;
          target.disabled = true;
          try {
            await cancelLeaveRequest(id);
            await fetchRequests();
          } catch (err) {
            alert(err.message || 'Không thể huỷ đơn.');
            target.disabled = false;
          }
        } else if (action === 'approve' || action === 'reject') {
          openReviewModal({
            id,
            action,
            studentName: target.dataset.name || 'Học viên',
            leaveDate: target.dataset.date || ''
          });
        }
      });
    }
  }

  // Khởi tạo
  loadClasses();
  bindFormEvents();
  bindTableEvents();
  fetchRequests();
}
