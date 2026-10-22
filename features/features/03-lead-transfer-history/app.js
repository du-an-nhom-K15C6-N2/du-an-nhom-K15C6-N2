const config = window.LEAD_ASSIGNMENT_CONFIG || {};
const demoMode = config.demo === true || new URLSearchParams(location.search).get("demo") === "1";
const apiBase = (config.apiBaseUrl || "").replace(/\/$/, "");

const demoLeads = [
  { id: "LD-24018", name: "Trần Minh Khôi", email: "khoi.tran@email.vn", phone: "090 312 45 08", source: "Website", createdAt: "2025-03-18T09:24:00", consultantId: null },
  { id: "LD-24017", name: "Lê Ngọc Hà", email: "ha.le@email.vn", phone: "091 870 22 16", source: "Facebook", createdAt: "2025-03-18T08:51:00", consultantId: "tv-02" },
  { id: "LD-24016", name: "Phạm Quốc Bảo", email: "bao.pham@email.vn", phone: "098 442 90 31", source: "Giới thiệu", createdAt: "2025-03-17T16:12:00", consultantId: null },
  { id: "LD-24015", name: "Nguyễn Thùy Linh", email: "linh.nguyen@email.vn", phone: "093 642 18 75", source: "Website", createdAt: "2025-03-17T14:06:00", consultantId: "tv-01" },
  { id: "LD-24014", name: "Đỗ Anh Tuấn", email: "tuan.do@email.vn", phone: "097 330 61 52", source: "Facebook", createdAt: "2025-03-17T11:39:00", consultantId: null },
  { id: "LD-24013", name: "Vũ Hoàng Yến", email: "yen.vu@email.vn", phone: "090 118 74 26", source: "Sự kiện", createdAt: "2025-03-16T15:20:00", consultantId: "tv-03" },
  { id: "LD-24012", name: "Bùi Đức Thành", email: "thanh.bui@email.vn", phone: "096 228 51 44", source: "Giới thiệu", createdAt: "2025-03-16T10:08:00", consultantId: null },
];
const demoConsultants = [
  { id: "tv-01", name: "Nguyễn Minh Châu", team: "Hà Nội" },
  { id: "tv-02", name: "Trần Hoàng Nam", team: "Hà Nội" },
  { id: "tv-03", name: "Lê Phương Thảo", team: "Hồ Chí Minh" },
];

const state = { leads: [], consultants: [], selected: new Set(), loading: false, assigning: false, error: "", lastUpdated: null };
const elements = {
  rows: document.querySelector("#lead-rows"),
  selectAll: document.querySelector("#select-all"),
  selectionBar: document.querySelector("#selection-bar"),
  selectedCount: document.querySelector("#selected-count"),
  dialog: document.querySelector("#assignment-dialog"),
  form: document.querySelector("#assignment-form"),
  consultant: document.querySelector("#consultant-select"),
  note: document.querySelector("#assignment-note"),
  dialogError: document.querySelector("#dialog-error"),
  confirm: document.querySelector("#confirm-assignment"),
  toastRegion: document.querySelector("#toast-region"),
  search: document.querySelector("#search-input"),
  filter: document.querySelector("#status-filter"),
};

function normalizeList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  throw new Error("Dữ liệu API không đúng định dạng danh sách.");
}

async function request(path, options = {}) {
  const token = localStorage.getItem("accessToken") || "";
  const response = await fetch(`${apiBase}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    let message = `Yêu cầu thất bại (${response.status}).`;
    try {
      const payload = await response.json();
      if (payload.message) message = payload.message;
    } catch {
      // The HTTP status remains available when the server doesn't return JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return null;
  const responseText = await response.text();
  return responseText ? JSON.parse(responseText) : null;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0] || "").join("").toUpperCase();
}

function assignedConsultantId(lead) {
  return lead.consultantId || lead.consultant?.id || "";
}

function getConsultantName(lead) {
  if (lead.consultant?.name) return lead.consultant.name;
  return state.consultants.find((consultant) => String(consultant.id) === String(assignedConsultantId(lead)))?.name || "";
}

function visibleLeads() {
  const query = elements.search.value.trim().toLocaleLowerCase("vi-VN");
  const status = elements.filter.value;
  return state.leads.filter((lead) => {
    const assigned = Boolean(assignedConsultantId(lead));
    const matchesStatus = status === "all" || (status === "assigned" ? assigned : !assigned);
    const haystack = [lead.name, lead.email, lead.phone, lead.id].join(" ").toLocaleLowerCase("vi-VN");
    return matchesStatus && (!query || haystack.includes(query));
  });
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? escapeHtml(value) : new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function render() {
  const leads = visibleLeads();
  const visibleIds = leads.map((lead) => String(lead.id));
  const selectedVisible = visibleIds.filter((id) => state.selected.has(id)).length;

  elements.selectAll.checked = visibleIds.length > 0 && selectedVisible === visibleIds.length;
  elements.selectAll.indeterminate = selectedVisible > 0 && selectedVisible < visibleIds.length;
  elements.selectionBar.hidden = state.selected.size === 0;
  elements.selectedCount.textContent = `${state.selected.size} lead`;
  document.querySelector("#dialog-lead-count").textContent = `${state.selected.size} lead`;
  document.querySelector("#metric-total").textContent = state.leads.length;
  document.querySelector("#metric-unassigned").textContent = state.leads.filter((lead) => !assignedConsultantId(lead)).length;
  document.querySelector("#metric-assigned").textContent = state.leads.filter((lead) => Boolean(assignedConsultantId(lead))).length;
  document.querySelector("#result-count").textContent = leads.length;
  document.querySelector("#table-summary").textContent = `Hiển thị ${leads.length} / ${state.leads.length} lead`;
  document.querySelector("#last-updated").textContent = state.lastUpdated
    ? new Intl.DateTimeFormat("vi-VN", { hour: "2-digit", minute: "2-digit" }).format(state.lastUpdated)
    : "—";

  if (state.loading) {
    elements.rows.innerHTML = '<tr><td colspan="7"><div class="table-state"><span class="spinner" aria-hidden="true"></span>Đang tải danh sách lead...</div></td></tr>';
    return;
  }
  if (state.error) {
    elements.rows.innerHTML = `<tr><td colspan="7"><div class="table-state error-state">${escapeHtml(state.error)} <button class="retry-button" id="retry-load" type="button">Thử lại</button></div></td></tr>`;
    document.querySelector("#retry-load").addEventListener("click", loadData);
    return;
  }
  if (!leads.length) {
    elements.rows.innerHTML = `<tr><td colspan="7"><div class="table-state">${state.leads.length ? "Không tìm thấy lead phù hợp." : "Chưa có lead trong danh sách."}</div></td></tr>`;
    return;
  }

  const sourceClass = { Facebook: "source-facebook", "Giới thiệu": "source-referral", Website: "source-website" };
  elements.rows.innerHTML = leads.map((lead) => {
    const id = String(lead.id);
    const consultantName = getConsultantName(lead);
    const assigned = Boolean(assignedConsultantId(lead) || consultantName);
    return `<tr>
      <td><input type="checkbox" class="lead-checkbox" value="${escapeHtml(id)}" ${state.selected.has(id) ? "checked" : ""} aria-label="Chọn lead ${escapeHtml(lead.name)}" /></td>
      <td><div class="lead-person"><span class="avatar">${escapeHtml(initials(lead.name))}</span><span class="lead-copy"><strong>${escapeHtml(lead.name || "Chưa có tên")}</strong><small>${escapeHtml(id)}</small></span></div></td>
      <td><span class="contact-cell">${escapeHtml(lead.phone || "—")}<small>${escapeHtml(lead.email || "—")}</small></span></td>
      <td><span class="source-tag"><i class="source-dot ${sourceClass[lead.source] || ""}"></i>${escapeHtml(lead.source || "Khác")}</span></td>
      <td>${formatDate(lead.createdAt || lead.created_at)}</td>
      <td>${assigned ? escapeHtml(consultantName || "Đã phân công") : '<span class="unassigned-label">Chưa có</span>'}</td>
      <td><span class="status-pill ${assigned ? "status-assigned" : ""}">${assigned ? "Đã phân công" : "Chưa phân công"}</span></td>
    </tr>`;
  }).join("");
}

function setApiStatus(online, text) {
  const indicator = document.querySelector("#api-indicator");
  indicator.classList.toggle("offline", !online);
  indicator.lastChild.textContent = text;
}

function populateConsultants() {
  elements.consultant.innerHTML = '<option value="">Chọn tư vấn viên</option>' + state.consultants.map((consultant) =>
    `<option value="${escapeHtml(consultant.id)}">${escapeHtml(consultant.name)}${consultant.team ? ` · ${escapeHtml(consultant.team)}` : ""}</option>`).join("");
  elements.consultant.disabled = state.consultants.length === 0;
  elements.confirm.disabled = state.consultants.length === 0;
}

async function loadData() {
  if (state.loading || state.assigning) return;
  state.loading = true;
  state.error = "";
  document.querySelector("#reload-button").disabled = true;
  setApiStatus(false, "Đang tải dữ liệu");
  render();

  try {
    if (demoMode) {
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (!state.lastUpdated) {
        state.leads = demoLeads.map((lead) => ({ ...lead }));
        state.consultants = demoConsultants.map((consultant) => ({ ...consultant }));
      }
    } else {
      const [leadsPayload, consultantsPayload] = await Promise.all([
        request("/api/leads"),
        request("/api/consultants"),
      ]);
      state.leads = normalizeList(leadsPayload);
      state.consultants = normalizeList(consultantsPayload);
    }
    state.lastUpdated = new Date();
    state.selected = new Set([...state.selected].filter((id) => state.leads.some((lead) => String(lead.id) === id)));
    populateConsultants();
    setApiStatus(true, demoMode ? "Chế độ demo" : "Đã kết nối");
  } catch (error) {
    state.error = `Không thể tải dữ liệu: ${error.message || "Vui lòng thử lại."}`;
    setApiStatus(false, "Không thể kết nối API");
    showToast("error", "Không tải được dữ liệu", error.message || "Vui lòng thử lại.");
  } finally {
    state.loading = false;
    document.querySelector("#reload-button").disabled = false;
    render();
  }
}

function showToast(type, title, message) {
  const toast = document.createElement("div");
  toast.className = `toast ${type === "error" ? "error" : ""}`;
  toast.innerHTML = `<span class="toast-icon" aria-hidden="true">${type === "error" ? "!" : "✓"}</span><span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></span><button class="toast-close" type="button" aria-label="Đóng thông báo">×</button>`;
  elements.toastRegion.append(toast);
  const remove = () => toast.remove();
  toast.querySelector(".toast-close").addEventListener("click", remove);
  window.setTimeout(remove, 5000);
}

function openAssignment() {
  if (!state.selected.size || !state.consultants.length || state.assigning) return;
  elements.dialogError.hidden = true;
  elements.dialogError.textContent = "";
  elements.note.value = "";
  document.querySelector("#note-count").textContent = "0";
  elements.confirm.disabled = false;
  elements.dialog.showModal();
}

async function submitAssignment(event) {
  event.preventDefault();
  const consultantId = elements.consultant.value;
  const leadIds = [...state.selected];
  if (!leadIds.length || !consultantId || state.assigning) return;

  state.assigning = true;
  elements.confirm.disabled = true;
  document.querySelector("#close-dialog").disabled = true;
  document.querySelector("#cancel-dialog").disabled = true;
  elements.confirm.querySelector(".confirm-label").innerHTML = '<span class="spinner" aria-hidden="true"></span> Đang phân công...';
  elements.dialogError.hidden = true;

  try {
    if (demoMode) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      state.leads = state.leads.map((lead) => leadIds.includes(String(lead.id))
        ? { ...lead, consultantId, note: elements.note.value.trim() }
        : lead);
    } else {
      await request("/api/leads/assign-bulk", {
        method: "POST",
        body: JSON.stringify({ leadIds, consultantId, note: elements.note.value.trim() || null }),
      });
    }
    state.selected.clear();
    elements.dialog.close();
    showToast("success", "Phân công thành công", `Đã phân công ${leadIds.length} lead cho ${elements.consultant.selectedOptions[0].textContent}.`);
    state.assigning = false;
    await loadData();
  } catch (error) {
    const message = error.message || "Đã xảy ra lỗi khi phân công lead.";
    elements.dialogError.textContent = message;
    elements.dialogError.hidden = false;
    showToast("error", "Phân công chưa thành công", message);
  } finally {
    state.assigning = false;
    document.querySelector("#close-dialog").disabled = false;
    document.querySelector("#cancel-dialog").disabled = false;
    elements.confirm.disabled = state.consultants.length === 0;
    elements.confirm.querySelector(".confirm-label").textContent = "Xác nhận phân công";
  }
}

elements.rows.addEventListener("change", (event) => {
  if (!event.target.matches(".lead-checkbox")) return;
  const id = event.target.value;
  if (event.target.checked) state.selected.add(id);
  else state.selected.delete(id);
  render();
});
elements.selectAll.addEventListener("change", () => {
  const ids = visibleLeads().map((lead) => String(lead.id));
  if (elements.selectAll.checked) ids.forEach((id) => state.selected.add(id));
  else ids.forEach((id) => state.selected.delete(id));
  render();
});
elements.search.addEventListener("input", render);
elements.filter.addEventListener("change", render);
document.querySelector("#clear-selection").addEventListener("click", () => { state.selected.clear(); render(); });
document.querySelector("#open-assignment").addEventListener("click", openAssignment);
document.querySelector("#reload-button").addEventListener("click", loadData);
document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => elements.dialog.close());
elements.form.addEventListener("submit", submitAssignment);
elements.note.addEventListener("input", () => { document.querySelector("#note-count").textContent = elements.note.value.length; });
elements.dialog.addEventListener("click", (event) => { if (event.target === elements.dialog && !state.assigning) elements.dialog.close(); });
document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

loadData();
