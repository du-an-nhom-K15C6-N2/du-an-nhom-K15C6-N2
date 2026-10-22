(() => {
  "use strict";

  const STORAGE_KEY = "edulead.leads.v1";
  const API_TOKEN_KEY = "edulead.apiToken";
  const usesApplicationAuth = window.LEAD_USE_APP_AUTH === true;
  const PAGE_SIZE = 5;
  const AVATAR_COLORS = [
    ["#e8e4ff", "#695bc9"], ["#fff0e4", "#bd7d44"], ["#e2f4ef", "#438d78"],
    ["#e6f0ff", "#5280bb"], ["#fce8ee", "#b7627d"], ["#fff5dc", "#9e823e"]
  ];
  const initialLeads = [
    { id: "lead-1001", name: "Nguyễn Minh Anh", phone: "0912 345 678", email: "minhanh.nguyen@gmail.com", source: "Facebook", status: "Mới", createdAt: "2024-06-12", note: "" },
    { id: "lead-1002", name: "Trần Hoàng Nam", phone: "0987 654 321", email: "nam.tran@example.com", source: "Website", status: "Đang tư vấn", createdAt: "2024-06-11", note: "" },
    { id: "lead-1003", name: "Lê Thu Hà", phone: "0903 112 233", email: "thuha.le@gmail.com", source: "Giới thiệu", status: "Mới", createdAt: "2024-06-10", note: "" },
    { id: "lead-1004", name: "Phạm Gia Bảo", phone: "0378 999 888", email: "giabao.pham@example.com", source: "Sự kiện", status: "Đã chuyển đổi", createdAt: "2024-06-09", note: "" },
    { id: "lead-1005", name: "Đỗ Khánh Linh", phone: "0865 432 109", email: "khanhlinh.do@gmail.com", source: "Facebook", status: "Đang tư vấn", createdAt: "2024-06-08", note: "" },
    { id: "lead-1006", name: "Võ Đức Huy", phone: "0321 456 789", email: "duchuy.vo@example.com", source: "Hotline", status: "Mới", createdAt: "2024-06-07", note: "" },
    { id: "lead-1007", name: "Ngô Phương Thảo", phone: "0798 123 456", email: "thao.ngo@gmail.com", source: "Website", status: "Không tiềm năng", createdAt: "2024-06-06", note: "" },
    { id: "lead-1008", name: "Bùi Quang Minh", phone: "0909 876 543", email: "quangminh.bui@gmail.com", source: "Giới thiệu", status: "Đang tư vấn", createdAt: "2024-06-05", note: "" },
    { id: "lead-1009", name: "Phan Ngọc Yến", phone: "0856 321 098", email: "ngocyen.phan@example.com", source: "Facebook", status: "Mới", createdAt: "2024-06-04", note: "" },
    { id: "lead-1010", name: "Đặng Tuấn Kiệt", phone: "0934 567 812", email: "tuan.kiet@example.com", source: "Sự kiện", status: "Đã chuyển đổi", createdAt: "2024-06-03", note: "" }
  ];
  const apiBase = (window.LEAD_API_BASE_URL || "").replace(/\/+$/, "");
  const apiEnabled = window.LEAD_API_ENABLED === true || Boolean(apiBase);
  const elements = {
    tableBody: document.querySelector("#lead-table-body"),
    emptyState: document.querySelector("#empty-state"),
    search: document.querySelector("#search-input"),
    status: document.querySelector("#status-filter"),
    source: document.querySelector("#source-filter"),
    pageSize: document.querySelector("#page-size"),
    modal: document.querySelector("#lead-modal-backdrop"),
    form: document.querySelector("#lead-form"),
    modalTitle: document.querySelector("#modal-title"),
    saveButton: document.querySelector("#save-lead-button"),
    saveLabel: document.querySelector(".save-label"),
    saveSpinner: document.querySelector(".save-spinner"),
    apiError: document.querySelector("#form-api-error"),
    toastRegion: document.querySelector("#toast-region"),
    apiToken: document.querySelector("#api-token"),
    apiAuthButton: document.querySelector("#api-auth-button"),
    apiAuthStatus: document.querySelector("#api-auth-status"),
    careModal: document.querySelector("#care-modal-backdrop"),
    careForm: document.querySelector("#care-log-form"),
    careLeadName: document.querySelector("#care-lead-name"),
    careLeadContact: document.querySelector("#care-lead-contact"),
    careLeadAvatar: document.querySelector("#care-lead-avatar"),
    careLeadReminderBox: document.querySelector("#care-lead-reminder-box"),
    careLeadSubinfo: document.querySelector("#care-lead-subinfo"),
    careHistoryCount: document.querySelector("#care-history-count"),
    careHistoryList: document.querySelector("#care-history-list"),
    careFormApiError: document.querySelector("#care-form-api-error"),
    careSaveButton: document.querySelector("#save-care-button"),
    enableCallbackReminder: document.querySelector("#enable-callback-reminder"),
    reminderFieldsGroup: document.querySelector("#reminder-fields-group"),
    careReminderAt: document.querySelector("#care-reminder-at")
  };

  let leads = [];
  let page = 1;
  let apiPagination = null;
  let apiSummary = null;
  function getApplicationToken() {
    return localStorage.getItem("dnkn_auth_token")
      || sessionStorage.getItem("dnkn_auth_token")
      || "";
  }

  let apiToken = usesApplicationAuth ? getApplicationToken() : (window.LEAD_API_TOKEN || "");
  let editingId = null;
  let saving = false;
  let selectedIds = new Set();

  try {
    if (!usesApplicationAuth) apiToken ||= sessionStorage.getItem(API_TOKEN_KEY) || "";
  } catch (error) {
    console.error("Không thể đọc token API trong phiên trình duyệt:", error);
  }
  if (elements.apiToken) elements.apiToken.value = apiToken;
  if (usesApplicationAuth) {
    if (elements.apiToken?.closest(".api-token-field")) {
      elements.apiToken.closest(".api-token-field").style.display = "none";
    }
    if (elements.apiAuthButton) elements.apiAuthButton.style.display = "none";
  }
  updateApiAuthStatus();

  function loadStoredLeads() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        const leadsWithPrograms = initialLeads.map(lead => ({
          ...lead,
          programOfInterest: "Chưa xác định"
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leadsWithPrograms));
        return leadsWithPrograms;
      }
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) throw new Error("Dữ liệu Lead đã lưu không đúng định dạng.");
      return parsed.map(lead => ({
        ...lead,
        programOfInterest: lead.programOfInterest || lead.program || "Chưa xác định"
      }));
    } catch (error) {
      console.error("Không thể đọc dữ liệu Lead đã lưu:", error);
      showToast("Không thể tải dữ liệu Lead từ trình duyệt. Vui lòng kiểm tra dung lượng lưu trữ.", "error");
      return [];
    }
  }

  function persistLeads(nextLeads) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextLeads));
    } catch (error) {
      console.error("Không thể lưu dữ liệu Lead:", error);
      throw new Error("Không thể lưu dữ liệu vào trình duyệt. Vui lòng thử lại.");
    }
  }

  async function apiRequest(path, options = {}) {
    const requestToken = usesApplicationAuth ? getApplicationToken() : apiToken;
    if (usesApplicationAuth && !requestToken) {
      window.location.assign("/login");
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(requestToken ? { Authorization: `Bearer ${requestToken}` } : {}),
        ...options.headers
      }
    });
    const text = await response.text();
    let payload = null;
    if (text) {
      try { payload = JSON.parse(text); }
      catch { payload = { message: text }; }
    }
    if (!response.ok) {
      const error = new Error(getApiMessage(payload, response.status));
      error.status = response.status;
      error.code = payload && (payload.code || payload.errorCode);
      error.details = payload && payload.errors;
      throw error;
    }
    return payload;
  }

  function getApiMessage(payload, status) {
    if (typeof payload === "string") return payload;
    if (!payload || typeof payload !== "object") return `Yêu cầu không thành công (HTTP ${status}). Vui lòng thử lại.`;
    const message = payload.message || payload.error_description || payload.error;
    if (typeof message === "string" && message.trim()) return message;
    if (payload.errors && typeof payload.errors === "object") {
      const messages = Object.values(payload.errors).flat().filter(value => typeof value === "string");
      if (messages.length) return messages.join(" ");
    }
    return `Yêu cầu không thành công (HTTP ${status}). Vui lòng thử lại.`;
  }

  async function loadLeads() {
    if (!apiEnabled) {
      leads = loadStoredLeads();
      render();
      return;
    }
    try {
      const pageSize = Number(elements.pageSize.value) || PAGE_SIZE;
      const query = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
        sortBy: "createdAt",
        sortOrder: "DESC"
      });
      if (elements.search.value.trim()) query.set("q", elements.search.value.trim());
      if (elements.status.value) query.set("status", elements.status.value);
      if (elements.source.value) query.set("source", elements.source.value);
      const result = await apiRequest(`/api/leads?${query}`);
      const list = Array.isArray(result) ? result : result && (result.items || result.data || result.leads);
      if (!Array.isArray(list)) throw new Error("API trả về dữ liệu Lead không đúng định dạng.");
      leads = list.map(normalizeLeadFromApi);
      apiPagination = result.pagination || null;
      apiSummary = result.summary || null;
      render();
    } catch (error) {
      console.error("Không thể tải danh sách Lead:", error);
      leads = [];
      render();
      showToast(`Không thể tải danh sách Lead: ${error.message}`, "error");
    }
  }

  function normalizeLeadFromApi(lead) {
    const careLogs = Array.isArray(lead.careLogs) ? lead.careLogs : [];
    let callbackReminder = lead.callbackReminder || null;
    if (!callbackReminder && lead.reminderAt) {
      callbackReminder = {
        reminderAt: lead.reminderAt,
        note: lead.reminderNote || "",
        isCompleted: Boolean(lead.reminderCompleted)
      };
    }
    const isOverdue = lead.isOverdue !== undefined
      ? Boolean(lead.isOverdue)
      : (callbackReminder && callbackReminder.reminderAt && !callbackReminder.isCompleted && new Date(callbackReminder.reminderAt).getTime() < Date.now());

    return {
      ...lead,
      id: String(lead.id ?? lead.leadId ?? ""),
      name: lead.name ?? lead.fullName ?? "",
      phone: lead.phone ?? lead.phoneNumber ?? "",
      email: lead.email ?? "",
      source: lead.source ?? lead.leadSource ?? "",
      programOfInterest: lead.programOfInterest ?? lead.program ?? "",
      status: lead.status ?? "Mới",
      createdAt: lead.createdAt ?? lead.created_at ?? new Date().toISOString().slice(0, 10),
      note: lead.note ?? lead.notes ?? "",
      careLogs,
      callbackReminder,
      isOverdue,
      overdueStatus: lead.overdueStatus || (isOverdue ? "Quá hạn" : (callbackReminder && !callbackReminder.isCompleted ? "Chờ gọi lại" : null))
    };
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(-2).map(part => part[0] || "").join("").toUpperCase();
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
  }

  function statusClass(status) {
    return ({
      "Mới": "status-new",
      "Đã liên hệ": "status-contacted",
      "Đang tư vấn": "status-consulting",
      "Hẹn học thử": "status-trial",
      "Chốt": "status-converted",
      "Đã chuyển đổi": "status-converted",
      "Đã nhập học": "status-enrolled",
      "Từ chối": "status-unqualified",
      "Không tiềm năng": "status-unqualified"
    })[status] || "status-unqualified";
  }

  function renderReminderCell(lead) {
    const reminder = lead.callbackReminder;
    if (!reminder || !reminder.reminderAt) {
      return `<span class="reminder-none">Chưa đặt lịch</span>`;
    }
    const dateFormatted = formatDateTime(reminder.reminderAt);
    if (lead.isOverdue) {
      return `<span class="reminder-pill reminder-overdue" title="Quá hạn từ ${dateFormatted}">Quá hạn: ${escapeHtml(dateFormatted)}</span>`;
    }
    if (reminder.isCompleted) {
      return `<span class="reminder-pill reminder-completed" title="Đã hoàn thành">Đã gọi: ${escapeHtml(dateFormatted)}</span>`;
    }
    return `<span class="reminder-pill reminder-pending" title="Hẹn gọi lại">Hẹn gọi: ${escapeHtml(dateFormatted)}</span>`;
  }

  function getFilteredLeads() {
    if (apiEnabled) return leads;
    const query = elements.search.value.trim().toLocaleLowerCase("vi");
    return leads.filter(lead => {
      const matchesSearch = !query || [lead.name, lead.phone, lead.email].some(value => String(value || "").toLocaleLowerCase("vi").includes(query));
      return matchesSearch && (!elements.status.value || lead.status === elements.status.value) && (!elements.source.value || lead.source === elements.source.value);
    }).sort((first, second) => String(second.createdAt).localeCompare(String(first.createdAt)));
  }

  function render() {
    const filtered = getFilteredLeads();
    const pageSize = Number(elements.pageSize.value) || PAGE_SIZE;
    const pageCount = Math.max(1, apiEnabled
      ? Number(apiPagination?.totalPages) || 1
      : Math.ceil(filtered.length / pageSize));
    page = Math.min(page, pageCount);
    const start = (page - 1) * pageSize;
    const visible = apiEnabled ? filtered : filtered.slice(start, start + pageSize);
    elements.tableBody.innerHTML = visible.map(lead => {
      const color = AVATAR_COLORS[Math.abs(String(lead.id).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0)) % AVATAR_COLORS.length];
      const isOverdue = Boolean(lead.isOverdue);
      return `<tr class="${isOverdue ? 'row-overdue' : ''}">
        <td><input class="row-checkbox" type="checkbox" data-id="${escapeHtml(lead.id)}" aria-label="Chọn ${escapeHtml(lead.name)}" ${selectedIds.has(String(lead.id)) ? "checked" : ""}></td>
        <td><div class="lead-person"><span class="lead-avatar" style="background:${color[0]};color:${color[1]}">${escapeHtml(initials(lead.name))}</span><span class="lead-name"><strong>${escapeHtml(lead.name)}</strong><span>ID: ${escapeHtml(lead.id)}</span></span></div></td>
        <td><div class="contact-info"><span>${escapeHtml(lead.phone)}</span><span>${escapeHtml(lead.email || "Chưa cập nhật email")}</span></div></td>
        <td><span class="source-label">${escapeHtml(lead.source)}</span></td>
        <td>
          <span class="status-pill ${statusClass(lead.status)}">${escapeHtml(lead.status)}${lead.isLocked ? ' 🔒' : ''}</span>
          ${lead.studentCode ? `<small style="display:block;color:#059669;font-weight:600;font-size:10px;margin-top:2px">Mã: ${escapeHtml(lead.studentCode)}</small>` : ''}
        </td>
        <td>${renderReminderCell(lead)}</td>
        <td class="date-cell">${escapeHtml(formatDate(lead.createdAt))}</td>
        <td class="row-actions"><button class="row-menu-button" type="button" data-menu-id="${escapeHtml(lead.id)}" aria-label="Thao tác với ${escapeHtml(lead.name)}" aria-expanded="false">···</button></td>
      </tr>`;
    }).join("");
    elements.emptyState.hidden = filtered.length > 0;
    const total = apiEnabled ? Number(apiPagination?.total) || 0 : filtered.length;
    document.querySelector("#pagination-summary").textContent = total
      ? `Hiển thị ${start + 1}–${Math.min(start + visible.length, total)} trong ${total} Lead`
      : "Hiển thị 0 Lead";
    document.querySelector("#page-indicator").textContent = `${page} / ${pageCount}`;
    document.querySelector("#previous-page").disabled = page <= 1;
    document.querySelector("#next-page").disabled = page >= pageCount;
    const allVisibleSelected = visible.length > 0 && visible.every(lead => selectedIds.has(String(lead.id)));
    const selectAll = document.querySelector("#select-all");
    selectAll.checked = allVisibleSelected;
    selectAll.indeterminate = visible.some(lead => selectedIds.has(String(lead.id))) && !allVisibleSelected;
    document.querySelector("#stat-total").textContent = apiEnabled ? (apiSummary?.total ?? total) : leads.length;
    document.querySelector("#stat-new").textContent = apiEnabled ? (apiSummary?.new ?? 0) : leads.filter(lead => lead.status === "Mới").length;
    document.querySelector("#stat-consulting").textContent = apiEnabled ? (apiSummary?.consulting ?? 0) : leads.filter(lead => lead.status === "Đang tư vấn").length;
    document.querySelector("#stat-converted").textContent = apiEnabled ? (apiSummary?.converted ?? 0) : leads.filter(lead => lead.status === "Đã chuyển đổi").length;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function formatDateTime(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(date);
  }

  function clearFilters() {
    elements.search.value = "";
    elements.status.value = "";
    elements.source.value = "";
    page = 1;
    if (apiEnabled) loadLeads();
    else render();
  }

  function openModal(lead = null) {
    if (lead && (lead.status === "Đã nhập học" || lead.isLocked)) {
      showToast("Lead đã ở trạng thái Đã nhập học và đã bị khóa, không thể chỉnh sửa.", "error");
      return;
    }
    editingId = lead ? String(lead.id) : null;
    elements.form.reset();
    clearValidation();
    hideApiError();
    elements.modalTitle.textContent = lead ? "Chỉnh sửa Lead" : "Tạo Lead mới";
    elements.saveLabel.textContent = lead ? "Lưu thay đổi" : "Lưu Lead";
    if (lead) {
      for (const field of ["name", "phone", "email", "source", "programOfInterest", "status", "note"]) {
        elements.form.elements[field].value = lead[field] || (field === "status" ? "Mới" : "");
      }
    }
    elements.modal.hidden = false;
    document.body.style.overflow = "hidden";
    elements.form.elements.name.focus();
  }

  function closeModal() {
    if (saving) return;
    elements.modal.hidden = true;
    document.body.style.overflow = "";
    editingId = null;
  }

  function clearValidation() {
    elements.form.querySelectorAll(".field-error").forEach(error => {
      error.textContent = "";
      const input = elements.form.elements[error.dataset.errorFor];
      if (input) {
        input.removeAttribute("aria-invalid");
        if (input.getAttribute("aria-describedby") === error.id) input.removeAttribute("aria-describedby");
      }
    });
    elements.form.querySelectorAll(".form-field").forEach(field => field.classList.remove("has-error"));
  }

  function showFieldError(name, message) {
    const input = elements.form.elements[name];
    const error = elements.form.querySelector(`[data-error-for="${name}"]`);
    if (!input || !error) return;
    error.textContent = message;
    input.closest(".form-field").classList.add("has-error");
    input.setAttribute("aria-invalid", "true");
    input.setAttribute("aria-describedby", error.id || `error-${name}`);
    if (!error.id) error.id = `error-${name}`;
  }

  function validate(formData) {
    clearValidation();
    const errors = {};
    const name = String(formData.get("name") || "").trim();
    const phone = String(formData.get("phone") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const source = String(formData.get("source") || "").trim();
    const programOfInterest = String(formData.get("programOfInterest") || "").trim();
    if (!name) errors.name = "Vui lòng nhập họ và tên.";
    else if (name.length < 2) errors.name = "Họ và tên cần có ít nhất 2 ký tự.";
    if (!phone) errors.phone = "Vui lòng nhập số điện thoại.";
    else if (!/^(?:0|84)(?:3|5|7|8|9)\d{8}$|^0084(?:3|5|7|8|9)\d{8}$/.test(phone.replace(/[^\d]/g, ""))) errors.phone = "Số điện thoại chưa đúng định dạng (ví dụ: 0912 345 678).";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.email = "Email chưa đúng định dạng.";
    if (!source) errors.source = "Vui lòng chọn nguồn Lead.";
    if (!programOfInterest) errors.programOfInterest = "Vui lòng nhập chương trình quan tâm.";
    for (const [field, message] of Object.entries(errors)) showFieldError(field, message);
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) elements.form.elements[firstInvalid].focus();
    return { valid: Object.keys(errors).length === 0, values: { name, phone, email, source, programOfInterest, status: String(formData.get("status") || "Mới"), note: String(formData.get("note") || "").trim() } };
  }

  function normalizePhone(phone) {
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("0084")) return `0${digits.slice(4)}`;
    return digits.startsWith("84") ? `0${digits.slice(2)}` : digits;
  }

  function isDuplicatePhone(error) {
    const haystack = `${error.code || ""} ${error.message || ""}`.toLocaleLowerCase("vi");
    return error.status === 409 || /duplicate|phone.?exists|số điện thoại|dien thoai|đã tồn tại|already exists/.test(haystack);
  }

  function showApiError(message) {
    elements.apiError.textContent = message;
    elements.apiError.hidden = false;
  }

  function hideApiError() {
    elements.apiError.hidden = true;
    elements.apiError.textContent = "";
  }

  function setSaving(value) {
    saving = value;
    elements.saveButton.disabled = value;
    elements.saveLabel.hidden = value;
    elements.saveSpinner.hidden = !value;
  }

  async function saveLead(event) {
    event.preventDefault();
    if (saving) return;
    hideApiError();
    const result = validate(new FormData(elements.form));
    if (!result.valid) return;
    const values = result.values;
    const normalizedPhone = normalizePhone(values.phone);
    const duplicateLocally = leads.some(lead => String(lead.id) !== String(editingId) && normalizePhone(String(lead.phone || "")) === normalizedPhone);
    if (!apiEnabled && duplicateLocally) {
      showApiError("Số điện thoại này đã được sử dụng cho một Lead khác. Vui lòng kiểm tra lại.");
      showFieldError("phone", "Số điện thoại đã tồn tại.");
      return;
    }
    setSaving(true);
    try {
      let saved;
      const originalId = editingId;
      if (apiEnabled) {
        const path = editingId ? `/api/leads/${encodeURIComponent(editingId)}` : "/api/leads";
        const response = await apiRequest(path, {
          method: editingId ? "PATCH" : "POST",
          body: JSON.stringify({
            fullName: values.name,
            phoneNumber: values.phone,
            email: values.email || null,
            source: values.source,
            programOfInterest: values.programOfInterest,
            status: values.status,
            note: values.note
          })
        });
        const rawLead = response && (response.data || response.lead || response);
        const apiLead = rawLead && typeof rawLead === "object" ? rawLead : {};
        const existingLead = leads.find(lead => String(lead.id) === String(originalId));
        saved = {
          ...values,
          ...apiLead,
          id: String(apiLead.id ?? apiLead.leadId ?? originalId ?? `lead-${Date.now()}`),
          name: apiLead.name ?? apiLead.fullName ?? values.name,
          phone: apiLead.phone ?? apiLead.phoneNumber ?? values.phone,
          email: apiLead.email ?? values.email,
          source: apiLead.source ?? apiLead.leadSource ?? values.source,
          programOfInterest: apiLead.programOfInterest ?? apiLead.program ?? values.programOfInterest,
          status: apiLead.status ?? values.status,
          createdAt: apiLead.createdAt ?? apiLead.created_at ?? (existingLead && existingLead.createdAt) ?? new Date().toISOString().slice(0, 10),
          note: apiLead.note ?? apiLead.notes ?? values.note
        };
      } else {
        const now = new Date().toISOString().slice(0, 10);
        saved = { ...values, id: editingId || `lead-${Date.now()}`, createdAt: editingId ? leads.find(lead => String(lead.id) === String(editingId)).createdAt : now };
      }
      let updatedLeads;
      if (editingId) {
        updatedLeads = leads.map(lead => String(lead.id) === String(editingId) ? { ...lead, ...saved, id: editingId } : lead);
      } else {
        updatedLeads = [saved, ...leads];
      }
      if (!apiEnabled) persistLeads(updatedLeads);
      leads = updatedLeads;
      elements.modal.hidden = true;
      document.body.style.overflow = "";
      editingId = null;
      page = 1;
      if (apiEnabled) await loadLeads();
      else render();
      showToast(originalId ? "Đã cập nhật thông tin Lead." : "Tạo Lead mới thành công.");
    } catch (error) {
      console.error("Không thể lưu Lead:", error);
      if (isDuplicatePhone(error)) {
        showFieldError("phone", "Số điện thoại đã tồn tại.");
        showApiError(error.message || "Số điện thoại này đã được sử dụng cho một Lead khác. Vui lòng kiểm tra lại.");
      } else {
        showApiError(error.message || "Đã xảy ra lỗi khi lưu Lead. Vui lòng thử lại.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(id) {
    const lead = leads.find(item => String(item.id) === String(id));
    if (lead && (lead.status === "Đã nhập học" || lead.isLocked)) {
      showToast("Lead đã ở trạng thái Đã nhập học và đã bị khóa, không thể xóa.", "error");
      return;
    }
    if (!lead || !window.confirm(`Bạn có chắc muốn xóa Lead "${lead.name}"?`)) return;
    try {
      if (apiEnabled) await apiRequest(`/api/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
      const updatedLeads = leads.filter(item => String(item.id) !== String(id));
      if (!apiEnabled) persistLeads(updatedLeads);
      leads = updatedLeads;
      selectedIds.delete(String(id));
      if (apiEnabled) await loadLeads();
      else render();
      showToast("Đã xóa Lead.");
    } catch (error) {
      console.error("Không thể xóa Lead:", error);
      showToast(`Không thể xóa Lead: ${error.message}`, "error");
    }
  }

  function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = `toast${type === "error" ? " error" : ""}`;
    toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span class="toast-message">${escapeHtml(message)}</span>`;
    elements.toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 4500);
  }

  function updateApiAuthStatus() {
    if (!elements.apiAuthStatus) return;
    if (usesApplicationAuth) {
      elements.apiAuthStatus.textContent = "Dùng phiên nhóm";
      return;
    }
    elements.apiAuthStatus.textContent = apiToken ? "Đã nhập token" : "Chưa đăng nhập";
    if (elements.apiAuthButton) {
      elements.apiAuthButton.textContent = apiToken ? "Cập nhật token" : "Đăng nhập API";
    }
  }

  async function exportLeads() {
    let rows = getFilteredLeads();
    if (apiEnabled && apiPagination?.totalPages > 1) {
      try {
        const pageSize = 100;
        const query = new URLSearchParams({
          page: "1",
          pageSize: String(pageSize),
          sortBy: "createdAt",
          sortOrder: "DESC"
        });
        if (elements.search.value.trim()) query.set("q", elements.search.value.trim());
        if (elements.status.value) query.set("status", elements.status.value);
        if (elements.source.value) query.set("source", elements.source.value);
        const firstPage = await apiRequest(`/api/leads?${query}`);
        rows = (firstPage.items || []).map(normalizeLeadFromApi);
        const totalPages = firstPage.pagination?.totalPages || 1;
        for (let currentPage = 2; currentPage <= totalPages; currentPage += 1) {
          query.set("page", String(currentPage));
          const result = await apiRequest(`/api/leads?${query}`);
          if (!Array.isArray(result.items)) throw new Error("API trả về dữ liệu Lead không đúng định dạng.");
          rows.push(...result.items.map(normalizeLeadFromApi));
        }
      } catch (error) {
        console.error("Không thể tải toàn bộ Lead để xuất:", error);
        showToast(`Không thể xuất danh sách Lead: ${error.message}`, "error");
        return;
      }
    }
    const header = ["Họ và tên", "Số điện thoại", "Email", "Nguồn", "Trạng thái", "Ngày tạo", "Ghi chú"];
    const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [header, ...rows.map(lead => [lead.name, lead.phone, lead.email, lead.source, lead.status, formatDate(lead.createdAt), lead.note])].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "danh-sach-lead.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Đã xuất ${rows.length} Lead ra file CSV.`);
  }

  elements.form.addEventListener("submit", saveLead);
  document.querySelector("#create-lead-button").addEventListener("click", () => openModal());
  document.querySelector("#close-modal-button").addEventListener("click", closeModal);
  document.querySelector("#cancel-modal-button").addEventListener("click", closeModal);
  elements.modal.addEventListener("click", event => { if (event.target === elements.modal) closeModal(); });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !elements.modal.hidden) closeModal();
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      elements.search.focus();
    }
  });
  elements.search.addEventListener("input", () => {
    page = 1;
    if (apiEnabled) window.clearTimeout(elements.search.searchTimer), elements.search.searchTimer = window.setTimeout(loadLeads, 250);
    else render();
  });
  elements.status.addEventListener("change", () => { page = 1; apiEnabled ? loadLeads() : render(); });
  elements.source.addEventListener("change", () => { page = 1; apiEnabled ? loadLeads() : render(); });
  elements.pageSize.addEventListener("change", () => { page = 1; apiEnabled ? loadLeads() : render(); });
  document.querySelector("#previous-page").addEventListener("click", () => { page -= 1; apiEnabled ? loadLeads() : render(); });
  document.querySelector("#next-page").addEventListener("click", () => { page += 1; apiEnabled ? loadLeads() : render(); });
  document.querySelector("#clear-filters-button").addEventListener("click", clearFilters);
  document.querySelector("#empty-clear-button").addEventListener("click", clearFilters);
  document.querySelector("#export-button").addEventListener("click", exportLeads);
  if (elements.apiAuthButton) {
    elements.apiAuthButton.addEventListener("click", () => {
      apiToken = elements.apiToken.value.trim();
      try {
        if (apiToken) sessionStorage.setItem(API_TOKEN_KEY, apiToken);
        else sessionStorage.removeItem(API_TOKEN_KEY);
      } catch (error) {
        console.error("Không thể lưu token API trong phiên trình duyệt:", error);
        showToast("Không thể lưu token trong phiên trình duyệt.", "error");
        return;
      }
      updateApiAuthStatus();
      showToast(apiToken ? "Đã cập nhật token API cho phiên này." : "Đã xóa token API khỏi phiên này.");
      loadLeads();
    });
  }
  document.querySelector("#select-all").addEventListener("change", event => {
    const pageSize = Number(elements.pageSize.value) || PAGE_SIZE;
    const visible = apiEnabled
      ? getFilteredLeads()
      : getFilteredLeads().slice((page - 1) * pageSize, page * pageSize);
    visible.forEach(lead => event.target.checked ? selectedIds.add(String(lead.id)) : selectedIds.delete(String(lead.id)));
    render();
  });
  elements.tableBody.addEventListener("change", event => {
    if (!event.target.matches(".row-checkbox")) return;
    if (event.target.checked) selectedIds.add(event.target.dataset.id);
    else selectedIds.delete(event.target.dataset.id);
    render();
  });
  elements.tableBody.addEventListener("click", event => {
    const menuButton = event.target.closest("[data-menu-id]");
    if (!menuButton) {
      if (!event.target.closest(".row-menu")) elements.tableBody.querySelectorAll(".row-menu").forEach(menu => menu.remove());
      return;
    }
    const id = menuButton.dataset.menuId;
    const row = menuButton.closest("tr");
    const existing = row.querySelector(".row-menu");
    elements.tableBody.querySelectorAll(".row-menu").forEach(menu => menu.remove());
    if (existing) {
      menuButton.setAttribute("aria-expanded", "false");
      return;
    }
    menuButton.setAttribute("aria-expanded", "true");
    const menu = document.createElement("div");
    menu.className = "row-menu";
    const canDelete = !usesApplicationAuth || (() => {
      try {
        const rawUser = localStorage.getItem("dnkn_user_info") || sessionStorage.getItem("dnkn_user_info");
        const user = rawUser ? JSON.parse(rawUser) : null;
        const roles = Array.isArray(user?.roles) ? user.roles : [user?.role];
        return roles.includes("admin") || roles.includes("manager");
      } catch (error) {
        console.error("Không thể xác định quyền xóa Lead từ phiên hiện tại:", error);
        return false;
      }
    })();
    const targetLead = leads.find(item => String(item.id) === String(id));
    const isEnrolled = targetLead && (targetLead.status === "Đã nhập học" || targetLead.isLocked);
    const isClosed = targetLead && (targetLead.status === "Chốt" || targetLead.status === "Đã chuyển đổi");

    menu.innerHTML = `
      ${isClosed ? '<button type="button" data-action="convert" style="color:#059669;font-weight:700">🎓 Chuyển thành học viên</button>' : ''}
      <button type="button" data-action="care" style="color:#5c50c3;font-weight:600">📝 Chăm sóc & Nhắc hẹn</button>
      ${!isEnrolled ? '<button type="button" data-action="edit">Chỉnh sửa</button>' : '<button type="button" disabled style="opacity:0.5;cursor:not-allowed">🔒 Đã khóa (Đã nhập học)</button>'}
      ${canDelete && !isEnrolled ? '<button type="button" class="danger" data-action="delete">Xóa Lead</button>' : ""}
    `;
    row.querySelector(".row-actions").append(menu);
    menu.addEventListener("click", menuEvent => {
      const action = menuEvent.target.dataset.action;
      const currentLead = leads.find(item => String(item.id) === String(id));
      menu.remove();
      if (action === "convert" && currentLead) openConvertStudentModal(currentLead);
      if (action === "care" && currentLead) openCareModal(currentLead);
      if (action === "edit" && currentLead) openModal(currentLead);
      if (action === "delete") deleteLead(id);
    });
  });

  // --- KẾT NỐI VỚI MODULE NHẬT KÝ CHĂM SÓC (careLogs.js) ---
  function openCareModal(lead) {
    if (window.LeadCareLogsModule) {
      window.LeadCareLogsModule.openCareModal(lead, {
        apiRequest: apiEnabled ? apiRequest : null,
        onComplete: handleCompleteReminder,
        onDelete: handleDeleteReminder
      });
    }
  }

  function closeCareModal() {
    if (window.LeadCareLogsModule) window.LeadCareLogsModule.closeCareModal();
  }

  async function handleCompleteReminder(leadId) {
    try {
      if (apiEnabled) {
        await apiRequest(`/api/leads/${encodeURIComponent(leadId)}/reminder/complete`, { method: "PATCH" });
      } else {
        const index = leads.findIndex(l => String(l.id) === String(leadId));
        if (index >= 0) {
          if (leads[index].callbackReminder) leads[index].callbackReminder.isCompleted = true;
          leads[index].isOverdue = false;
          persistLeads(leads);
        }
      }
      showToast("Đã đánh dấu hoàn thành lịch nhắc gọi lại.");
      if (apiEnabled) await loadLeads();
      else render();
      const updatedLead = leads.find(l => String(l.id) === String(leadId));
      if (updatedLead && window.LeadCareLogsModule) {
        window.LeadCareLogsModule.setActiveCareLead(updatedLead);
        window.LeadCareLogsModule.renderCareLeadReminderBox(updatedLead, handleCompleteReminder, handleDeleteReminder);
      }
    } catch (error) {
      showToast(`Không thể hoàn thành nhắc hẹn: ${error.message}`, "error");
    }
  }

  async function handleDeleteReminder(leadId) {
    if (!window.confirm("Bạn có chắc muốn hủy lịch nhắc gọi lại này?")) return;
    try {
      if (apiEnabled) {
        await apiRequest(`/api/leads/${encodeURIComponent(leadId)}/reminder`, { method: "DELETE" });
      } else {
        const index = leads.findIndex(l => String(l.id) === String(leadId));
        if (index >= 0) {
          leads[index].callbackReminder = null;
          leads[index].reminderAt = null;
          leads[index].isOverdue = false;
          persistLeads(leads);
        }
      }
      showToast("Đã xóa lịch nhắc gọi lại.");
      if (apiEnabled) await loadLeads();
      else render();
      const updatedLead = leads.find(l => String(l.id) === String(leadId));
      if (updatedLead && window.LeadCareLogsModule) {
        window.LeadCareLogsModule.setActiveCareLead(updatedLead);
        window.LeadCareLogsModule.renderCareLeadReminderBox(updatedLead, handleCompleteReminder, handleDeleteReminder);
      }
    } catch (error) {
      showToast(`Không thể xóa nhắc hẹn: ${error.message}`, "error");
    }
  }

  async function saveCareLog(event) {
    event.preventDefault();
    const mod = window.LeadCareLogsModule;
    const activeLead = mod ? mod.getActiveCareLead() : null;
    if (!activeLead) return;

    mod.hideCareApiError(elements.careFormApiError);
    mod.clearCareValidation(elements.careForm);

    const form = elements.careForm;
    const type = form.elements.type.value;
    const timestampVal = form.elements.timestamp.value;
    const content = form.elements.content.value.trim();
    const enableReminder = elements.enableCallbackReminder.checked;
    const reminderAtVal = elements.careReminderAt.value;
    const reminderNote = form.elements.reminderNote.value.trim();

    if (!type) {
      mod.showCareFieldError(form, "type", "Vui lòng chọn loại tương tác.");
      return;
    }
    if (!timestampVal) {
      mod.showCareFieldError(form, "timestamp", "Vui lòng chọn thời điểm chăm sóc.");
      return;
    }
    if (!content) {
      mod.showCareFieldError(form, "content", "Vui lòng nhập nội dung chăm sóc.");
      return;
    }

    let reminderIso = null;
    if (enableReminder) {
      if (!reminderAtVal) {
        mod.showCareFieldError(form, "reminderAt", "Vui lòng chọn ngày và giờ nhắc gọi lại.");
        return;
      }
      const reminderDate = new Date(reminderAtVal);
      if (reminderDate.getTime() < Date.now() - 60000) {
        mod.showCareFieldError(form, "reminderAt", "Ngày nhắc gọi lại không được nhỏ hơn thời điểm hiện tại.");
        return;
      }
      reminderIso = reminderDate.toISOString();
    }

    const payload = {
      type,
      timestamp: new Date(timestampVal).toISOString(),
      content,
      ...(reminderIso ? { reminderAt: reminderIso, reminderNote } : {})
    };

    try {
      elements.careSaveButton.disabled = true;
      if (apiEnabled) {
        await apiRequest(`/api/leads/${encodeURIComponent(activeLead.id)}/care-logs`, {
          method: "POST",
          body: JSON.stringify(payload)
        });
      } else {
        const lead = leads.find(l => String(l.id) === String(activeLead.id));
        if (lead) {
          if (!lead.careLogs) lead.careLogs = [];
          lead.careLogs.unshift({
            id: `log-${Date.now()}`,
            type,
            content,
            timestamp: payload.timestamp,
            createdAt: new Date().toISOString()
          });
          if (reminderIso) {
            lead.callbackReminder = {
              reminderAt: reminderIso,
              note: reminderNote,
              isCompleted: false,
              createdAt: new Date().toISOString()
            };
            lead.isOverdue = false;
          }
          persistLeads(leads);
        }
      }

      showToast("Đã lưu nhật ký chăm sóc thành công!");
      if (apiEnabled) await loadLeads();
      else render();

      const updatedLead = leads.find(l => String(l.id) === String(activeLead.id));
      if (updatedLead) {
        mod.setActiveCareLead(updatedLead);
        mod.renderCareLeadReminderBox(updatedLead, handleCompleteReminder, handleDeleteReminder);
        await mod.loadAndRenderCareLogs(updatedLead.id, apiEnabled ? apiRequest : null, updatedLead);
        mod.switchCareTab("log-history");
      }
    } catch (err) {
      mod.showCareApiError(elements.careFormApiError, err.message || "Đã xảy ra lỗi khi lưu nhật ký chăm sóc.");
    } finally {
      elements.careSaveButton.disabled = false;
    }
  }

  // Gắn sự kiện Care Modal
  elements.careForm.addEventListener("submit", saveCareLog);
  document.querySelector("#close-care-modal-button").addEventListener("click", closeCareModal);
  document.querySelector("#cancel-care-modal-button").addEventListener("click", closeCareModal);
  document.querySelector("#close-history-button").addEventListener("click", closeCareModal);
  elements.careModal.addEventListener("click", e => { if (e.target === elements.careModal) closeCareModal(); });

  document.querySelectorAll(".care-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      if (window.LeadCareLogsModule) window.LeadCareLogsModule.switchCareTab(tab.dataset.tab);
    });
  });

  elements.enableCallbackReminder.addEventListener("change", e => {
    elements.reminderFieldsGroup.hidden = !e.target.checked;
    if (e.target.checked) {
      elements.careReminderAt.focus();
    }
  });

  // --- ĐIỀU HƯỚNG CÁC TAB WORKSPACE (Tổng quan, Quản lý Lead, Phễu tư vấn, Chiến dịch, Lịch tư vấn, Báo cáo) ---
  const views = {
    leads: document.querySelector("#view-leads"),
    pipeline: document.querySelector("#view-pipeline"),
    overview: document.querySelector("#view-overview"),
    campaigns: document.querySelector("#view-campaigns"),
    schedule: document.querySelector("#view-schedule"),
    reports: document.querySelector("#view-reports")
  };

  function switchWorkspaceView(viewName) {
    document.querySelectorAll("#sidebar-main-nav .nav-item").forEach(item => {
      const isActive = item.dataset.view === viewName;
      item.classList.toggle("active", isActive);
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });

    Object.entries(views).forEach(([name, container]) => {
      if (container) {
        container.hidden = name !== viewName;
      }
    });

    if (viewName === "pipeline") renderPipelineView();
    if (viewName === "overview") renderOverviewView();
    if (viewName === "schedule") renderScheduleView();
    if (viewName === "reports") renderReportsView();
  }

  // --- DNKN-172: PHỄU TƯ VẤN (LEAD PIPELINE & KANBAN) ---
  const PIPELINE_STATUSES = ["Mới", "Đã liên hệ", "Đang tư vấn", "Hẹn học thử", "Chốt", "Từ chối"];
  const PIPELINE_STATUS_CLASSES = {
    "Mới": "new",
    "Đã liên hệ": "contacted",
    "Đang tư vấn": "consulting",
    "Hẹn học thử": "trial",
    "Chốt": "won",
    "Từ chối": "rejected"
  };

  let selectedPipelineLead = null;
  let pendingPipelineMove = null;
  let pipelineFilterMode = "all"; // "all" | "today"

  function formatPipelineDate(value) {
    if (!value) return "Chưa lên lịch";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Chưa lên lịch";
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    return `${isToday ? "Hôm nay" : date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" })} · ${date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
  }

  function getInitials(name) {
    return String(name || "?").trim().split(/\s+/).slice(-2).map(part => part[0] || "").join("").toUpperCase();
  }

  function getPipelineGroupedLeads() {
    let sourceLeads = [...leads];
    if (pipelineFilterMode === "today") {
      const today = new Date().toDateString();
      sourceLeads = sourceLeads.filter(l => {
        const time = l.nextCallAt || l.reminderAt;
        if (!time) return false;
        return new Date(time).toDateString() === today || l.isOverdue;
      });
    }

    // Sắp xếp: lead có lịch hẹn lên trước, sau đó theo tên
    sourceLeads.sort((a, b) => {
      const aTime = a.nextCallAt || a.reminderAt;
      const bTime = b.nextCallAt || b.reminderAt;
      if (aTime && !bTime) return -1;
      if (!aTime && bTime) return 1;
      if (aTime && bTime) {
        const diff = new Date(aTime).getTime() - new Date(bTime).getTime();
        if (diff !== 0) return diff;
      }
      return String(a.name || "").localeCompare(String(b.name || ""), "vi");
    });

    const grouped = Object.fromEntries(PIPELINE_STATUSES.map(s => [s, []]));
    sourceLeads.forEach(lead => {
      let st = lead.status;
      if (st === "Đã chuyển đổi") st = "Chốt";
      else if (st === "Không tiềm năng") st = "Từ chối";

      if (grouped[st]) grouped[st].push(lead);
      else grouped["Mới"].push(lead);
    });
    return grouped;
  }

  function updatePipelineHeaderCounts() {
    const totalCount = leads.length;
    const elTotal = document.querySelector("#pipeline-total-leads");
    const elTabAll = document.querySelector("#pipeline-tab-count");
    const elNavPipeline = document.querySelector("#nav-pipeline-count");
    const elTabToday = document.querySelector("#pipeline-today-count");

    if (elTotal) elTotal.textContent = totalCount;
    if (elTabAll) elTabAll.textContent = totalCount;
    if (elNavPipeline) elNavPipeline.textContent = totalCount;

    const today = new Date().toDateString();
    const todayCount = leads.filter(l => {
      const time = l.nextCallAt || l.reminderAt;
      return (time && new Date(time).toDateString() === today) || l.isOverdue;
    }).length;
    if (elTabToday) elTabToday.textContent = todayCount;
  }

  function renderPipelineView() {
    updatePipelineHeaderCounts();
    const container = document.querySelector("#pipeline-columns-container");
    if (!container) return;

    const grouped = getPipelineGroupedLeads();
    container.innerHTML = "";

    PIPELINE_STATUSES.forEach((status, colIndex) => {
      const columnLeads = grouped[status] || [];
      const colClass = PIPELINE_STATUS_CLASSES[status] || "new";

      const colEl = document.createElement("div");
      colEl.className = `pipeline-column ${colClass}`;
      colEl.dataset.status = status;

      // Drag & Drop cho cột
      colEl.addEventListener("dragover", e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        colEl.classList.add("drag-over");
      });
      colEl.addEventListener("dragleave", () => {
        colEl.classList.remove("drag-over");
      });
      colEl.addEventListener("drop", e => {
        e.preventDefault();
        colEl.classList.remove("drag-over");
        const draggedId = e.dataTransfer.getData("text/plain");
        const found = leads.find(l => String(l.id) === String(draggedId));
        if (found) {
          askMovePipelineLead(found, status);
        }
      });

      // Header cột
      colEl.innerHTML = `
        <div class="column-heading">
          <div class="column-title">
            <span class="status-dot"></span>
            <h2>${escapeHtml(status)}</h2>
            <span class="count-badge">${columnLeads.length}</span>
          </div>
          <span class="card-menu">···</span>
        </div>
        <div class="lead-list" data-list-status="${escapeHtml(status)}"></div>
        ${columnLeads.length === 0 ? '<div class="empty-column">Chưa có lead ở bước này</div>' : ''}
        ${colIndex === 0 ? '<span class="column-footnote">Ưu tiên liên hệ sớm</span>' : ''}
      `;

      const listContainer = colEl.querySelector(".lead-list");

      // Render từng Lead card
      columnLeads.forEach((lead, cardIndex) => {
        const card = document.createElement("article");
        const isSelected = selectedPipelineLead && String(selectedPipelineLead.id) === String(lead.id);
        card.className = `lead-card ${isSelected ? "selected" : ""}`;
        card.draggable = true;
        card.dataset.leadId = lead.id;

        card.addEventListener("dragstart", e => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", String(lead.id));
        });

        card.addEventListener("click", () => {
          openPipelineDrawer(lead);
        });

        const avatarClass = `avatar-${cardIndex % 5}`;
        const leadDisplayId = `LEAD-${String(lead.id).replace(/\D/g, "").slice(-4) || String(lead.id).slice(-4)}`;
        const courseName = lead.course || lead.program || lead.programOfInterest || "Chưa chọn môn";
        const callTime = lead.nextCallAt || lead.reminderAt;

        card.innerHTML = `
          <div class="card-topline">
            <span class="lead-id">${escapeHtml(leadDisplayId)}</span>
            <span class="card-menu">···</span>
          </div>
          <div class="lead-name-row">
            <span class="lead-avatar ${avatarClass}">${escapeHtml(getInitials(lead.name))}</span>
            <strong>${escapeHtml(lead.name)}</strong>
          </div>
          <div class="lead-meta"><span class="meta-icon">▱</span> ${escapeHtml(lead.phone || "—")}</div>
          <div class="course-tag">${escapeHtml(courseName)}</div>
          <div class="card-footer">
            <span class="due-date"><span aria-hidden="true">◷</span> ${escapeHtml(formatPipelineDate(callTime))}</span>
            <span class="source-tag">${escapeHtml(lead.source || "Website")}</span>
          </div>
          <label class="quick-move" onclick="event.stopPropagation()">
            <span class="sr-only">Đổi trạng thái</span>
            <select aria-label="Đổi trạng thái cho ${escapeHtml(lead.name)}">
              <option value="" disabled selected>Chuyển đến...</option>
              ${PIPELINE_STATUSES.filter(s => s !== lead.status).map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
            </select>
          </label>
        `;

        const select = card.querySelector("select");
        if (select) {
          select.addEventListener("change", e => {
            const targetStatus = e.target.value;
            select.value = "";
            if (targetStatus) {
              askMovePipelineLead(lead, targetStatus);
            }
          });
        }

        listContainer.appendChild(card);
      });

      container.appendChild(colEl);
    });
  }

  // Mở Slide-over Drawer xem chi tiết lead & lịch sử trạng thái
  async function openPipelineDrawer(lead) {
    selectedPipelineLead = lead;
    document.querySelectorAll(".lead-card").forEach(c => {
      c.classList.toggle("selected", c.dataset.leadId === String(lead.id));
    });

    const drawer = document.querySelector("#pipeline-detail-drawer");
    const backdrop = document.querySelector("#pipeline-drawer-backdrop");
    if (!drawer || !backdrop) return;

    // Render thông tin hồ sơ
    const profileCard = document.querySelector("#drawer-profile-card");
    const statusClass = PIPELINE_STATUS_CLASSES[lead.status] || "new";
    profileCard.innerHTML = `
      <span class="lead-avatar large avatar-0">${escapeHtml(getInitials(lead.name))}</span>
      <div>
        <h3>${escapeHtml(lead.name)}</h3>
        <span class="status-pill ${statusClass}">${escapeHtml(lead.status)}</span>
      </div>
    `;

    // Render thông tin liên hệ
    const contactDl = document.querySelector("#drawer-contact-info");
    const courseName = lead.course || lead.program || lead.programOfInterest || "Chưa xác định";
    const callTime = lead.nextCallAt || lead.reminderAt;
    contactDl.innerHTML = `
      <div><dt>Số điện thoại</dt><dd>${escapeHtml(lead.phone || "—")}</dd></div>
      <div><dt>Email</dt><dd>${escapeHtml(lead.email || "—")}</dd></div>
      <div><dt>Khóa học quan tâm</dt><dd>${escapeHtml(courseName)}</dd></div>
      <div><dt>Nguồn lead</dt><dd>${escapeHtml(lead.source || "Website")}</dd></div>
      <div><dt>Lịch hẹn gọi lại</dt><dd>${escapeHtml(formatPipelineDate(callTime))}</dd></div>
      <div><dt>Ghi chú</dt><dd>${escapeHtml(lead.note || "Không có")}</dd></div>
    `;

    // Tải và hiển thị lịch sử trạng thái
    const historyList = document.querySelector("#drawer-history-list");
    const historyCount = document.querySelector("#drawer-history-count");
    historyList.innerHTML = '<li class="history-item" style="border:0">Đang tải lịch sử...</li>';

    try {
      let historyItems = [];
      if (apiEnabled) {
        const res = await fetch(`${apiBase}/api/leads/${lead.id}/history`, {
          headers: apiToken ? { Authorization: `Bearer ${apiToken}` } : {}
        });
        if (res.ok) {
          historyItems = await res.json();
        }
      }
      if (!Array.isArray(historyItems) || historyItems.length === 0) {
        historyItems = Array.isArray(lead.statusHistory) ? lead.statusHistory : [];
      }

      historyCount.textContent = historyItems.length;
      if (historyItems.length === 0) {
        historyList.innerHTML = '<p class="history-empty">Chưa có lần thay đổi trạng thái nào.</p>';
      } else {
        historyList.innerHTML = historyItems.map(item => `
          <li>
            <span class="history-marker"></span>
            <div class="history-item">
              <strong>${escapeHtml(item.fromStatus || "Tạo mới")} <span>→</span> ${escapeHtml(item.toStatus)}</strong>
              <time>${escapeHtml(new Date(item.changedAt).toLocaleString("vi-VN"))}</time>
              <span class="history-actor">Thực hiện bởi ${escapeHtml(item.changedBy || "Tư vấn viên")}</span>
              ${item.reason ? `<span class="history-reason">Lý do: ${escapeHtml(item.reason)}</span>` : ""}
            </div>
          </li>
        `).join("");
      }
    } catch (err) {
      historyList.innerHTML = '<p class="history-empty">Không thể tải lịch sử thay đổi.</p>';
    }

    const convertBtn = document.querySelector("#drawer-convert-student-button");
    const enrolledBanner = document.querySelector("#drawer-enrolled-banner");
    const enrolledCodeSpan = document.querySelector("#drawer-enrolled-code");
    const careBtn = document.querySelector("#drawer-open-care-button");

    const isEnrolled = lead.status === "Đã nhập học" || lead.isLocked;
    const isClosed = lead.status === "Chốt" || lead.status === "Đã chuyển đổi";

    if (convertBtn) convertBtn.hidden = !isClosed;
    if (careBtn) careBtn.hidden = isEnrolled;
    if (enrolledBanner) {
      enrolledBanner.hidden = !isEnrolled;
      if (enrolledCodeSpan) {
        enrolledCodeSpan.textContent = `Mã HV: ${lead.studentCode || 'Đã có'}`;
      }
    }

    drawer.hidden = false;
    backdrop.hidden = false;
  }

  function closePipelineDrawer() {
    selectedPipelineLead = null;
    const drawer = document.querySelector("#pipeline-detail-drawer");
    const backdrop = document.querySelector("#pipeline-drawer-backdrop");
    if (drawer) drawer.hidden = true;
    if (backdrop) backdrop.hidden = true;
    document.querySelectorAll(".lead-card").forEach(c => c.classList.remove("selected"));
  }

  // Xác nhận chuyển trạng thái (Confirm Move Modal)
  function askMovePipelineLead(lead, targetStatus) {
    if (lead.status === "Đã nhập học" || lead.isLocked) {
      showToast("Lead đã ở trạng thái Đã nhập học và đã bị khóa, không thể chuyển đổi trạng thái.", "error");
      return;
    }
    if (lead.status === targetStatus) return;
    pendingPipelineMove = { lead, targetStatus };

    const modal = document.querySelector("#pipeline-confirm-modal");
    const desc = document.querySelector("#move-modal-description");
    const icon = document.querySelector("#confirm-modal-icon");
    const reasonGroup = document.querySelector("#rejection-reason-group");
    const reasonSelect = document.querySelector("#rejection-reason-select");
    const errorEl = document.querySelector("#move-reason-error");

    if (errorEl) errorEl.textContent = "";
    if (reasonSelect) reasonSelect.value = "";

    if (desc) {
      desc.innerHTML = `Lead <strong>${escapeHtml(lead.name)}</strong> sẽ được chuyển từ <strong>${escapeHtml(lead.status)}</strong> sang <strong>${escapeHtml(targetStatus)}</strong>.`;
    }

    const isReject = targetStatus === "Từ chối";
    if (icon) {
      icon.textContent = isReject ? "!" : "↗";
      icon.classList.toggle("danger", isReject);
    }
    if (reasonGroup) {
      reasonGroup.hidden = !isReject;
    }

    if (modal) modal.hidden = false;
  }

  async function confirmPipelineMove() {
    if (!pendingPipelineMove) return;
    const { lead, targetStatus } = pendingPipelineMove;
    const isReject = targetStatus === "Từ chối";
    const reasonSelect = document.querySelector("#rejection-reason-select");
    const errorEl = document.querySelector("#move-reason-error");
    const confirmBtn = document.querySelector("#confirm-move-btn");
    const label = document.querySelector("#confirm-move-label");

    let reason = "";
    if (isReject) {
      reason = reasonSelect?.value?.trim() || "";
      if (!reason) {
        if (errorEl) errorEl.textContent = "Vui lòng chọn một lý do từ chối.";
        return;
      }
    }

    if (confirmBtn) confirmBtn.disabled = true;
    if (label) label.textContent = "Đang lưu...";

    try {
      if (apiEnabled) {
        const res = await fetch(`${apiBase}/api/leads/${lead.id}/status`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {})
          },
          body: JSON.stringify({
            status: targetStatus,
            ...(isReject ? { reason } : {})
          })
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.message || body?.error || "Không thể cập nhật trạng thái.");
        }
      }

      // Cập nhật trạng thái trong bộ nhớ và localStorage
      lead.status = targetStatus;
      lead.updatedAt = new Date().toISOString();
      if (!Array.isArray(lead.statusHistory)) lead.statusHistory = [];
      lead.statusHistory.unshift({
        id: lead.statusHistory.length + 1,
        leadId: lead.id,
        fromStatus: lead.status,
        toStatus: targetStatus,
        reason: isReject ? reason : null,
        changedAt: new Date().toISOString(),
        changedBy: "Tư vấn viên"
      });

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
      } catch (_) {}

      // Đóng modal
      const modal = document.querySelector("#pipeline-confirm-modal");
      if (modal) modal.hidden = true;
      pendingPipelineMove = null;

      // Cập nhật UI
      renderPipelineView();
      renderTable();
      renderStats();

      // Nếu drawer đang mở cho lead này, cập nhật lại
      if (selectedPipelineLead && String(selectedPipelineLead.id) === String(lead.id)) {
        openPipelineDrawer(lead);
      }

      showToast(`Đã chuyển trạng thái của "${lead.name}" sang ${targetStatus}.`, "success");
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message;
      } else {
        showToast(err.message, "error");
      }
    } finally {
      if (confirmBtn) confirmBtn.disabled = false;
      if (label) label.textContent = "Xác nhận chuyển";
    }
  }

  // Gắn sự kiện điều khiển phễu
  document.querySelector("#close-drawer-button")?.addEventListener("click", closePipelineDrawer);
  document.querySelector("#pipeline-drawer-backdrop")?.addEventListener("click", closePipelineDrawer);
  document.querySelector("#drawer-open-care-button")?.addEventListener("click", () => {
    if (selectedPipelineLead && window.LeadCareLogsModule) {
      window.LeadCareLogsModule.openCareModal(selectedPipelineLead);
    }
  });

  document.querySelector("#close-confirm-modal-btn")?.addEventListener("click", () => {
    const modal = document.querySelector("#pipeline-confirm-modal");
    if (modal) modal.hidden = true;
    pendingPipelineMove = null;
  });
  document.querySelector("#cancel-move-btn")?.addEventListener("click", () => {
    const modal = document.querySelector("#pipeline-confirm-modal");
    if (modal) modal.hidden = true;
    pendingPipelineMove = null;
  });
  document.querySelector("#confirm-move-btn")?.addEventListener("click", confirmPipelineMove);

  document.querySelector("#pipeline-tab-all")?.addEventListener("click", () => {
    pipelineFilterMode = "all";
    document.querySelector("#pipeline-tab-all")?.classList.add("active");
    document.querySelector("#pipeline-tab-today")?.classList.remove("active");
    renderPipelineView();
  });
  document.querySelector("#pipeline-tab-today")?.addEventListener("click", () => {
    pipelineFilterMode = "today";
    document.querySelector("#pipeline-tab-today")?.classList.add("active");
    document.querySelector("#pipeline-tab-all")?.classList.remove("active");
    renderPipelineView();
  });

  const triggerTableView = () => switchWorkspaceView("leads");
  const triggerPipelineView = () => switchWorkspaceView("pipeline");

  document.querySelector("#switch-table-view")?.addEventListener("click", triggerTableView);
  document.querySelector("#switch-pipeline-view")?.addEventListener("click", triggerPipelineView);
  document.querySelector("#switch-table-view-2")?.addEventListener("click", triggerTableView);
  document.querySelector("#switch-pipeline-view-2")?.addEventListener("click", triggerPipelineView);


  function renderOverviewView() {
    const total = leads.length;
    const converted = leads.filter(l => l.status === "Đã chuyển đổi").length;
    const convRate = total > 0 ? `${Math.round((converted / total) * 100)}%` : "0%";
    const withReminders = leads.filter(l => l.callbackReminder && l.callbackReminder.reminderAt && !l.callbackReminder.isCompleted);
    const overdue = leads.filter(l => l.isOverdue);
    let totalLogs = 0;
    leads.forEach(l => { if (Array.isArray(l.careLogs)) totalLogs += l.careLogs.length; });

    const elRate = document.querySelector("#overview-conv-rate");
    const elPending = document.querySelector("#overview-pending-reminders");
    const elOverdue = document.querySelector("#overview-overdue-reminders");
    const elLogs = document.querySelector("#overview-total-care-logs");

    if (elRate) elRate.textContent = convRate;
    if (elPending) elPending.textContent = withReminders.length;
    if (elOverdue) elOverdue.textContent = overdue.length;
    if (elLogs) elLogs.textContent = totalLogs;
  }

  function renderScheduleView() {
    const scheduleContainer = document.querySelector("#schedule-list-container");
    if (!scheduleContainer) return;

    const leadsWithReminder = leads.filter(l => l.callbackReminder && l.callbackReminder.reminderAt);
    if (leadsWithReminder.length === 0) {
      scheduleContainer.innerHTML = `
        <div style="text-align:center;padding:48px 16px;color:#8f92a1">
          <span style="font-size:36px;display:block;margin-bottom:12px">📅</span>
          <strong>Hiện chưa có lịch tư vấn hoặc hẹn gọi lại nào</strong>
          <p style="font-size:12px;margin-top:6px">Hãy vào mục Quản lý Lead, chọn "📝 Chăm sóc & Nhắc hẹn" để đặt lịch gọi lại cho ứng viên.</p>
        </div>
      `;
      return;
    }

    // Sắp xếp ngày hẹn từ gần đến xa
    leadsWithReminder.sort((a, b) => new Date(a.callbackReminder.reminderAt).getTime() - new Date(b.callbackReminder.reminderAt).getTime());

    scheduleContainer.innerHTML = `
      <div style="display:grid;gap:12px">
        ${leadsWithReminder.map(lead => {
          const reminder = lead.callbackReminder;
          const isOverdue = Boolean(lead.isOverdue);
          return `
            <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;border:1px solid ${isOverdue ? '#fca5a5' : '#e5e7eb'};border-radius:10px;background:${isOverdue ? '#fff5f5' : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,0.03)">
              <div style="display:flex;align-items:center;gap:14px">
                <span style="font-size:24px">${isOverdue ? '⚠️' : (reminder.isCompleted ? '✓' : '⏰')}</span>
                <div>
                  <strong style="font-size:13px;color:#1f2937">${escapeHtml(lead.name)}</strong>
                  <span style="font-size:11px;color:#6b7280;margin-left:8px">${escapeHtml(lead.phone)} • ${escapeHtml(lead.programOfInterest || 'Tư vấn')}</span>
                  <div style="font-size:11px;color:#4b5563;margin-top:4px">
                    <b>Hẹn lúc:</b> ${escapeHtml(formatDateTime(reminder.reminderAt))}
                    ${reminder.note ? ` • <i>"${escapeHtml(reminder.note)}"</i>` : ''}
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:8px">
                ${isOverdue ? '<span class="reminder-pill reminder-overdue">Quá hạn</span>' : (reminder.isCompleted ? '<span class="reminder-pill reminder-completed">Đã gọi</span>' : '<span class="reminder-pill reminder-pending">Chờ gọi</span>')}
                <button type="button" class="button button-secondary" style="min-height:30px;font-size:10px;padding:0 10px" data-open-lead-care="${escapeHtml(lead.id)}">Mở chăm sóc</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    scheduleContainer.querySelectorAll('[data-open-lead-care]').forEach(btn => {
      btn.addEventListener('click', () => {
        const lead = leads.find(l => String(l.id) === btn.dataset.openLeadCare);
        if (lead) openCareModal(lead);
      });
    });
  }

  function renderReportsView() {
    let calls = 0;
    let msgs = 0;
    let meetings = 0;
    leads.forEach(l => {
      if (Array.isArray(l.careLogs)) {
        l.careLogs.forEach(log => {
          if (log.type === "Gọi điện") calls += 1;
          else if (log.type === "Nhắn tin") msgs += 1;
          else if (log.type === "Gặp mặt") meetings += 1;
        });
      }
    });

    const overdueCount = leads.filter(l => l.isOverdue).length;
    const totalScheduled = leads.filter(l => l.callbackReminder && l.callbackReminder.reminderAt).length;
    const onTimeRate = totalScheduled > 0 ? `${Math.round(((totalScheduled - overdueCount) / totalScheduled) * 100)}%` : "100%";

    const elCalls = document.querySelector("#report-calls-count");
    const elMsgs = document.querySelector("#report-msgs-count");
    const elMeetings = document.querySelector("#report-meetings-count");
    const elRate = document.querySelector("#report-on-time-rate");

    if (elCalls) elCalls.textContent = calls;
    if (elMsgs) elMsgs.textContent = msgs;
    if (elMeetings) elMeetings.textContent = meetings;
    if (elRate) elRate.textContent = onTimeRate;
  }

  const sidebarNav = document.querySelector("#sidebar-main-nav");
  if (sidebarNav) {
    sidebarNav.addEventListener("click", e => {
      const link = e.target.closest(".nav-item");
      if (!link) return;
      e.preventDefault();
      const viewName = link.dataset.view;
      if (viewName) switchWorkspaceView(viewName);
    });
  }

  // Cập nhật số đếm ở menu và phễu khi tải xong
  const originalLoadLeads = loadLeads;
  loadLeads = async function() {
    await originalLoadLeads();
    const countBadge = document.querySelector("#nav-leads-count");
    if (countBadge) countBadge.textContent = leads.length;
    updatePipelineHeaderCounts();
    const pipelineView = document.querySelector("#view-pipeline");
    if (pipelineView && !pipelineView.hidden) {
      renderPipelineView();
    }
  };

  // --- CHUYỂN LEAD ĐÃ CHỐT THÀNH HỒ SƠ HỌC VIÊN ---
  let convertingLead = null;

  function openConvertStudentModal(lead) {
    if (!lead) return;
    if (lead.status === "Đã nhập học" || lead.isLocked) {
      showToast("Lead này đã được chuyển thành hồ sơ học viên (Đã nhập học).", "error");
      return;
    }
    if (lead.status !== "Chốt" && lead.status !== "Đã chuyển đổi") {
      showToast(`Chỉ có thể chuyển đổi lead có trạng thái "Chốt" thành học viên. Trạng thái hiện tại: "${lead.status}".`, "error");
      return;
    }

    convertingLead = lead;
    const modal = document.querySelector("#convert-student-modal-backdrop");
    const nameInput = document.querySelector("#convert-name-input");
    const phoneInput = document.querySelector("#convert-phone-input");
    const emailInput = document.querySelector("#convert-email-input");
    const courseInput = document.querySelector("#convert-course-input");
    const noteInput = document.querySelector("#convert-note-input");
    const errorEl = document.querySelector("#convert-form-api-error");

    if (errorEl) {
      errorEl.textContent = "";
      errorEl.hidden = true;
    }
    document.querySelectorAll("#convert-student-form .field-error").forEach(el => el.textContent = "");

    if (nameInput) nameInput.value = lead.name || "";
    if (phoneInput) phoneInput.value = lead.phone || "";
    if (emailInput) emailInput.value = lead.email || "";
    if (courseInput) courseInput.value = lead.course || lead.program || lead.programOfInterest || "";
    if (noteInput) noteInput.value = lead.note || "";

    if (modal) modal.hidden = false;
  }

  function closeConvertStudentModal() {
    const modal = document.querySelector("#convert-student-modal-backdrop");
    if (modal) modal.hidden = true;
    convertingLead = null;
  }

  async function handleConvertStudentSubmit(event) {
    event.preventDefault();
    if (!convertingLead) return;

    const emailInput = document.querySelector("#convert-email-input");
    const courseInput = document.querySelector("#convert-course-input");
    const noteInput = document.querySelector("#convert-note-input");
    const errorEl = document.querySelector("#convert-form-api-error");
    const submitBtn = document.querySelector("#confirm-convert-btn");
    const submitLabel = document.querySelector("#confirm-convert-label");
    const submitSpinner = document.querySelector("#confirm-convert-spinner");

    const email = emailInput?.value?.trim() || "";
    const course = courseInput?.value?.trim() || "";
    const note = noteInput?.value?.trim() || "";

    let hasError = false;
    const emailError = document.querySelector('#convert-email-error');
    const courseError = document.querySelector('#convert-course-error');
    if (emailError) emailError.textContent = "";
    if (courseError) courseError.textContent = "";

    if (!email) {
      if (emailError) emailError.textContent = "Vui lòng nhập email học viên.";
      hasError = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (emailError) emailError.textContent = "Email không đúng định dạng.";
      hasError = true;
    }

    if (!course) {
      if (courseError) courseError.textContent = "Vui lòng nhập khóa học / chương trình.";
      hasError = true;
    }

    if (hasError) return;

    if (submitBtn) submitBtn.disabled = true;
    if (submitSpinner) submitSpinner.hidden = false;
    if (submitLabel) submitLabel.textContent = "Đang chuyển đổi...";

    try {
      let resultData = null;
      if (apiEnabled) {
        const payload = await apiRequest(`/api/leads/${encodeURIComponent(convertingLead.id)}/convert-to-student`, {
          method: "POST",
          body: JSON.stringify({ email, course, note })
        });
        resultData = payload?.data?.student || payload?.data || payload;
      } else {
        const year = new Date().getFullYear();
        const studentCode = `HV${year}0001`;
        convertingLead.status = "Đã nhập học";
        convertingLead.isLocked = true;
        convertingLead.studentCode = studentCode;
        convertingLead.email = email;
        convertingLead.course = course;
        convertingLead.updatedAt = new Date().toISOString();
        if (!Array.isArray(convertingLead.statusHistory)) convertingLead.statusHistory = [];
        convertingLead.statusHistory.unshift({
          id: convertingLead.statusHistory.length + 1,
          leadId: convertingLead.id,
          fromStatus: "Chốt",
          toStatus: "Đã nhập học",
          reason: `Chuyển đổi thành hồ sơ học viên (${studentCode})`,
          changedAt: new Date().toISOString(),
          changedBy: "Tư vấn viên"
        });
        persistLeads(leads);
        resultData = { studentCode, fullName: convertingLead.name };
      }

      const stuCode = resultData?.studentCode || resultData?.student?.studentCode || "mới";
      const stuName = resultData?.fullName || resultData?.student?.fullName || convertingLead.name;

      closeConvertStudentModal();
      showToast(`🎉 Chuyển đổi thành công! Học viên "${stuName}" được cấp mã [${stuCode}]. Lead đã chuyển sang Đã nhập học.`);

      if (apiEnabled) {
        await loadLeads();
      } else {
        render();
      }
      renderPipelineView();

      if (selectedPipelineLead && String(selectedPipelineLead.id) === String(convertingLead?.id)) {
        const updated = leads.find(l => String(l.id) === String(convertingLead.id));
        if (updated) openPipelineDrawer(updated);
      }
    } catch (err) {
      if (errorEl) {
        errorEl.textContent = err.message || "Đã xảy ra lỗi khi chuyển đổi sang học viên.";
        errorEl.hidden = false;
      } else {
        showToast(err.message, "error");
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (submitSpinner) submitSpinner.hidden = true;
      if (submitLabel) submitLabel.textContent = "Xác nhận chuyển đổi";
    }
  }

  document.querySelector("#close-convert-modal-btn")?.addEventListener("click", closeConvertStudentModal);
  document.querySelector("#cancel-convert-modal-btn")?.addEventListener("click", closeConvertStudentModal);
  document.querySelector("#convert-student-form")?.addEventListener("submit", handleConvertStudentSubmit);
  document.querySelector("#drawer-convert-student-button")?.addEventListener("click", () => {
    if (selectedPipelineLead) {
      openConvertStudentModal(selectedPipelineLead);
    }
  });

  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  loadLeads();
})();
