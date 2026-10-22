(() => {
  "use strict";

  const STORAGE_KEY = "edulead.leads.v1";
  const API_TOKEN_KEY = "edulead.apiToken";
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
    apiAuthStatus: document.querySelector("#api-auth-status")
  };

  let leads = [];
  let page = 1;
  let apiPagination = null;
  let apiSummary = null;
  let apiToken = window.LEAD_API_TOKEN || "";
  let editingId = null;
  let saving = false;
  let selectedIds = new Set();

  try {
    apiToken ||= sessionStorage.getItem(API_TOKEN_KEY) || "";
  } catch (error) {
    console.error("Không thể đọc token API trong phiên trình duyệt:", error);
  }
  if (elements.apiToken) elements.apiToken.value = apiToken;
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
    const response = await fetch(`${apiBase}${path}`, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
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
      note: lead.note ?? lead.notes ?? ""
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
    return ({ "Mới": "status-new", "Đang tư vấn": "status-consulting", "Đã chuyển đổi": "status-converted", "Không tiềm năng": "status-unqualified" })[status] || "status-unqualified";
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
      return `<tr>
        <td><input class="row-checkbox" type="checkbox" data-id="${escapeHtml(lead.id)}" aria-label="Chọn ${escapeHtml(lead.name)}" ${selectedIds.has(String(lead.id)) ? "checked" : ""}></td>
        <td><div class="lead-person"><span class="lead-avatar" style="background:${color[0]};color:${color[1]}">${escapeHtml(initials(lead.name))}</span><span class="lead-name"><strong>${escapeHtml(lead.name)}</strong><span>ID: ${escapeHtml(lead.id)}</span></span></div></td>
        <td><div class="contact-info"><span>${escapeHtml(lead.phone)}</span><span>${escapeHtml(lead.email || "Chưa cập nhật email")}</span></div></td>
        <td><span class="source-label">${escapeHtml(lead.source)}</span></td>
        <td><span class="status-pill ${statusClass(lead.status)}">${escapeHtml(lead.status)}</span></td>
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

  function clearFilters() {
    elements.search.value = "";
    elements.status.value = "";
    elements.source.value = "";
    page = 1;
    if (apiEnabled) loadLeads();
    else render();
  }

  function openModal(lead = null) {
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
    menu.innerHTML = '<button type="button" data-action="edit">Chỉnh sửa</button><button type="button" class="danger" data-action="delete">Xóa Lead</button>';
    row.querySelector(".row-actions").append(menu);
    menu.addEventListener("click", menuEvent => {
      const action = menuEvent.target.dataset.action;
      const lead = leads.find(item => String(item.id) === String(id));
      menu.remove();
      if (action === "edit" && lead) openModal(lead);
      if (action === "delete") deleteLead(id);
    });
  });
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());
  loadLeads();
})();
