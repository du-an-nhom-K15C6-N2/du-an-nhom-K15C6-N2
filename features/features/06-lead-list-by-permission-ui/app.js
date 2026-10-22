(function () {
  "use strict";

  const config = window.LEAD_LIST_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  const demoMode = config.demo === true || params.get("demo") === "1";
  const pageSize = Math.max(1, Number(config.pageSize) || 10);
  const state = {
    user: null,
    role: "",
    page: 1,
    total: 0,
    search: "",
    status: "",
    consultantId: "",
    requestId: 0,
    requestController: null,
    debounceTimer: null,
    consultants: [],
    consultantsError: "",
  };

  const elements = {
    rows: document.getElementById("lead-rows"),
    table: document.getElementById("table-wrap"),
    search: document.getElementById("search-input"),
    status: document.getElementById("status-filter"),
    consultantFilter: document.getElementById("consultant-filter"),
    consultantFilterWrap: document.getElementById("consultant-filter-wrap"),
    assignmentHeading: document.getElementById("assignment-heading"),
    resultCount: document.getElementById("result-count"),
    tableSummary: document.getElementById("table-summary"),
    pageIndicator: document.getElementById("page-indicator"),
    previousPage: document.getElementById("previous-page"),
    nextPage: document.getElementById("next-page"),
    error: document.getElementById("error-banner"),
    reload: document.getElementById("reload-button"),
    scopeDescription: document.getElementById("scope-description"),
    listDescription: document.getElementById("list-description"),
    sessionStatus: document.getElementById("session-status"),
    sessionDetail: document.getElementById("session-detail"),
    profileName: document.getElementById("profile-name"),
    profileRole: document.getElementById("profile-role"),
    profileAvatar: document.getElementById("profile-avatar"),
  };

  const sampleLeads = [
    { id: "L-1001", name: "Nguyễn Minh Châu", email: "chau.nguyen@example.com", phone: "0901 234 567", status: "new", assignedConsultant: { id: "C-1", name: "Lê Thu Hà" }, createdAt: "2026-10-08T08:30:00+07:00" },
    { id: "L-1002", name: "Trần Quốc Bảo", email: "bao.tran@example.com", phone: "0912 345 678", status: "contacted", assignedConsultant: { id: "C-2", name: "Phạm Gia Linh" }, createdAt: "2026-10-07T11:15:00+07:00" },
    { id: "L-1003", name: "Phạm Ngọc Mai", email: "mai.pham@example.com", phone: "0983 456 789", status: "qualified", assignedConsultant: { id: "C-1", name: "Lê Thu Hà" }, createdAt: "2026-10-06T09:00:00+07:00" },
    { id: "L-1004", name: "Đỗ Hoàng Nam", email: "nam.do@example.com", phone: "0974 567 890", status: "converted", assignedConsultant: { id: "C-2", name: "Phạm Gia Linh" }, createdAt: "2026-10-05T14:20:00+07:00" },
    { id: "L-1005", name: "Vũ Thanh Tâm", email: "tam.vu@example.com", phone: "0965 678 901", status: "lost", assignedConsultant: { id: "C-1", name: "Lê Thu Hà" }, createdAt: "2026-10-04T10:40:00+07:00" },
    { id: "L-1006", name: "Bùi Anh Khoa", email: "khoa.bui@example.com", phone: "0936 789 012", status: "new", assignedConsultant: { id: "C-2", name: "Phạm Gia Linh" }, createdAt: "2026-10-03T16:10:00+07:00" },
    { id: "L-1007", name: "Hoàng Khánh Vy", email: "vy.hoang@example.com", phone: "0927 890 123", status: "contacted", assignedConsultant: { id: "C-1", name: "Lê Thu Hà" }, createdAt: "2026-10-02T13:00:00+07:00" },
    { id: "L-1008", name: "Lý Đức Thịnh", email: "thinh.ly@example.com", phone: "0908 901 234", status: "qualified", assignedConsultant: { id: "C-2", name: "Phạm Gia Linh" }, createdAt: "2026-10-01T08:15:00+07:00" },
    { id: "L-1009", name: "Ngô Bảo Trân", email: "tran.ngo@example.com", phone: "0919 012 345", status: "new", assignedConsultant: { id: "C-1", name: "Lê Thu Hà" }, createdAt: "2026-09-30T15:30:00+07:00" },
    { id: "L-1010", name: "Đặng Tuấn Kiệt", email: "kiet.dang@example.com", phone: "0980 123 456", status: "converted", assignedConsultant: { id: "C-2", name: "Phạm Gia Linh" }, createdAt: "2026-09-29T12:00:00+07:00" },
    { id: "L-1011", name: "Mai Phương Thảo", email: "thao.mai@example.com", phone: "0971 234 567", status: "contacted", assignedConsultant: { id: "C-1", name: "Lê Thu Hà" }, createdAt: "2026-09-28T09:45:00+07:00" },
    { id: "L-1012", name: "Phan Nhật Huy", email: "huy.phan@example.com", phone: "0962 345 678", status: "qualified", assignedConsultant: { id: "C-2", name: "Phạm Gia Linh" }, createdAt: "2026-09-27T17:25:00+07:00" },
  ];
  const sampleConsultants = [
    { id: "C-1", name: "Lê Thu Hà" },
    { id: "C-2", name: "Phạm Gia Linh" },
  ];
  const statusLabels = {
    new: "Mới",
    contacted: "Đã liên hệ",
    qualified: "Tiềm năng",
    converted: "Đã chuyển đổi",
    lost: "Không phù hợp",
    pending: "Chờ xử lý",
  };

  function readStoredUser() {
    if (config.currentUser && typeof config.currentUser === "object") return config.currentUser;
    try {
      const stored = window.localStorage.getItem(config.currentUserKey || "currentUser");
      if (stored) return JSON.parse(stored);
    } catch (error) {
      console.error("Không thể đọc thông tin người dùng trong phiên.", error);
    }
    return null;
  }

  function readToken() {
    if (typeof config.getToken === "function") return config.getToken();
    try {
      return window.localStorage.getItem(config.authTokenKey || "accessToken") || "";
    } catch (error) {
      console.error("Không thể đọc token đăng nhập.", error);
      return "";
    }
  }

  function decodeTokenUser(token) {
    try {
      const payload = token.split(".")[1];
      if (!payload) return null;
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = decodeURIComponent(
        atob(base64)
          .split("")
          .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`)
          .join(""),
      );
      return JSON.parse(decoded);
    } catch (error) {
      console.warn("Không thể đọc role từ JWT; backend vẫn là nguồn phân quyền.", error);
      return null;
    }
  }

  function roleOf(user) {
    const role = String(user?.role || user?.user?.role || "").toLowerCase();
    if (["manager", "sales_manager", "admin", "training_manager"].includes(role)) return "manager";
    if (["consultant", "academic_advisor", "advisor"].includes(role)) return "consultant";
    return "";
  }

  function displayName(user) {
    return user?.name || user?.fullName || user?.full_name || user?.user?.name || "Người dùng";
  }

  function initializeRole() {
    const tokenUser = decodeTokenUser(readToken());
    state.user = readStoredUser() || tokenUser || (demoMode ? { name: "Minh Anh", role: "manager" } : null);
    state.role = roleOf(state.user) || roleOf(tokenUser);
    const manager = state.role === "manager";
    const name = displayName(state.user);

    elements.profileName.textContent = name;
    elements.profileRole.textContent = manager ? "Quản lý" : state.role === "consultant" ? "Tư vấn viên" : "Chưa xác định vai trò";
    elements.profileAvatar.textContent = name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase() || "?";
    elements.sessionStatus.textContent = state.role ? "Phiên đăng nhập hợp lệ" : "Chưa xác định vai trò";
    elements.sessionDetail.textContent = demoMode ? "Đang dùng dữ liệu minh họa" : "Phạm vi do máy chủ kiểm soát";
    elements.scopeDescription.textContent = manager
      ? "Theo dõi toàn bộ lead và lọc theo tư vấn viên phụ trách."
      : state.role === "consultant"
        ? "Chỉ hiển thị lead được giao cho bạn. Thông tin phân công chỉ xem."
        : "Vui lòng đăng nhập bằng tài khoản được cấp quyền xem lead.";
    elements.listDescription.textContent = manager
      ? "Tìm kiếm, lọc trạng thái và tư vấn viên phụ trách."
      : "Tìm kiếm và lọc trong danh sách lead được giao cho bạn.";
    elements.consultantFilterWrap.hidden = !manager;
    elements.assignmentHeading.textContent = manager ? "TƯ VẤN VIÊN PHỤ TRÁCH" : "NGƯỜI PHỤ TRÁCH";
    elements.reload.disabled = !demoMode && !readToken();

    if (!state.role) {
      showError("Không xác định được vai trò người dùng. Hãy đăng nhập lại hoặc cấu hình currentUser/token trong config.js.");
      renderEmpty("Không có quyền truy cập danh sách lead.", true);
      return false;
    }
    if (!demoMode && !readToken()) {
      showError("Phiên đăng nhập không có token. Vui lòng đăng nhập lại.");
      renderEmpty("Cần đăng nhập để xem danh sách lead.", true);
      return false;
    }
    return true;
  }

  function apiUrl(endpoint, query) {
    const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
    const path = String(endpoint || "");
    const url = new URL(`${base}${path.startsWith("/") ? path : `/${path}`}`, window.location.href);
    Object.entries(query).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) url.searchParams.set(key, String(value));
    });
    return url;
  }

  async function apiGet(endpoint, query, signal) {
    const token = readToken();
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(apiUrl(endpoint, query), { method: "GET", headers, signal });
    if (!response.ok) {
      const message = await responseMessage(response);
      throw new Error(message || `Yêu cầu thất bại (HTTP ${response.status}).`);
    }
    return response.json();
  }

  async function responseMessage(response) {
    try {
      const payload = await response.json();
      return payload.message || payload.error || "";
    } catch {
      return "";
    }
  }

  function unwrapItems(payload) {
    let body = payload;
    if (body && !Array.isArray(body) && body.data !== undefined) body = body.data;
    if (Array.isArray(body)) return body;
    if (body && Array.isArray(body.items)) return body.items;
    if (body && Array.isArray(body.leads)) return body.leads;
    throw new Error("Phản hồi API không đúng định dạng danh sách.");
  }

  function unwrapPage(payload, requestedPage) {
    let body = payload;
    if (body && !Array.isArray(body) && body.data !== undefined) body = body.data;
    const items = unwrapItems(payload);
    const pagination = body?.pagination || {};
    const totalValue = body?.total ?? pagination.total ?? items.length;
    const total = Number(totalValue);
    const responsePage = Number(body?.page ?? pagination.page ?? requestedPage);
    return {
      items,
      total: Number.isFinite(total) && total >= 0 ? total : items.length,
      page: Number.isFinite(responsePage) && responsePage > 0 ? responsePage : requestedPage,
      serverPaginated: !Array.isArray(body) && (body?.total !== undefined || pagination.total !== undefined),
    };
  }

  async function loadConsultants() {
    if (state.role !== "manager") return;
    try {
      if (demoMode) {
        state.consultants = sampleConsultants;
      } else {
        const payload = await apiGet(config.consultantsEndpoint || "/api/consultants", {});
        state.consultants = unwrapItems(payload);
      }
      state.consultantsError = "";
      const select = elements.consultantFilter;
      select.replaceChildren(new Option("Tất cả tư vấn viên", ""));
      state.consultants.forEach((consultant) => {
        select.add(new Option(consultant.name || consultant.fullName || consultant.id, consultant.id));
      });
    } catch (error) {
      state.consultantsError = `Không thể tải bộ lọc tư vấn viên: ${error.message}`;
      throw error;
    }
  }

  function matchesSearch(lead, search) {
    const consultant = lead.assignedConsultant || lead.assigned_consultant || lead.consultant || {};
    const fields = [
      lead.name, lead.fullName, lead.full_name, lead.email, lead.phone,
      consultant.name, consultant.fullName,
    ];
    return fields.some((value) => String(value || "").toLocaleLowerCase("vi").includes(search));
  }

  function filterLocally(leads) {
    return leads.filter((lead) => {
      const consultant = lead.assignedConsultant || lead.assigned_consultant || lead.consultant || {};
      const consultantId = consultant.id || lead.assignedToId || lead.assigned_to_id || lead.assigned_to;
      const matchesConsultant = state.role !== "manager" || !state.consultantId || String(consultantId || "") === state.consultantId;
      const matchesStatus = !state.status || String(lead.status || "").toLowerCase() === state.status;
      return matchesConsultant && matchesStatus && matchesSearch(lead, state.search.toLocaleLowerCase("vi"));
    });
  }

  function filteredDemoLeads() {
    return sampleLeads.filter((lead) => {
      const assignedId = lead.assignedConsultant?.id;
      const visibleToRole = state.role !== "consultant" || assignedId === (state.user?.id || state.user?.userId);
      const matchesConsultant = !state.consultantId || lead.assignedConsultant.id === state.consultantId;
      const matchesStatus = !state.status || lead.status === state.status;
      return visibleToRole && matchesConsultant && matchesStatus && matchesSearch(lead, state.search.toLocaleLowerCase("vi"));
    });
  }

  async function loadLeads() {
    if (!state.role) return;
    if (state.requestController) state.requestController.abort();
    const controller = new AbortController();
    state.requestController = controller;
    const requestId = ++state.requestId;
    elements.table.setAttribute("aria-busy", "true");
    elements.error.hidden = !state.consultantsError;
    if (state.consultantsError) elements.error.textContent = state.consultantsError;
    renderLoading();

    try {
      let result;
      if (demoMode) {
        const all = filteredDemoLeads();
        const start = (state.page - 1) * pageSize;
        result = { items: all.slice(start, start + pageSize), total: all.length, page: state.page };
      } else {
        const query = {
          search: state.search.trim(),
          status: state.status,
          page: state.page,
          pageSize,
        };
        if (state.role === "manager") query.consultantId = state.consultantId;
        const payload = await apiGet(config.leadsEndpoint || "/api/leads", query, controller.signal);
        result = unwrapPage(payload, state.page);
        if (!result.serverPaginated) {
          const filtered = filterLocally(result.items);
          const start = (state.page - 1) * pageSize;
          result = {
            items: filtered.slice(start, start + pageSize),
            total: filtered.length,
            page: state.page,
          };
        }
      }
      if (requestId !== state.requestId) return;
      state.total = result.total;
      state.page = result.page;
      renderRows(result.items);
      updatePagination();
    } catch (error) {
      if (error.name === "AbortError" || requestId !== state.requestId) return;
      console.error("Không thể tải danh sách lead.", error);
      showError(error.message || "Không thể tải danh sách lead. Vui lòng thử lại.");
      renderEmpty("Không tải được dữ liệu. Hãy kiểm tra kết nối rồi thử lại.");
      state.total = 0;
      updatePagination();
    } finally {
      if (requestId === state.requestId) {
        elements.table.setAttribute("aria-busy", "false");
        state.requestController = null;
      }
    }
  }

  function addCell(row, content, className) {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    if (content instanceof Node) cell.append(content);
    else cell.textContent = content || "—";
    row.append(cell);
    return cell;
  }

  function renderRows(leads) {
    elements.rows.replaceChildren();
    if (!leads.length) {
      renderEmpty("Không tìm thấy lead phù hợp với điều kiện lọc.");
      return;
    }
    leads.forEach((lead) => {
      const row = document.createElement("tr");
      const name = lead.name || lead.fullName || lead.full_name || "Chưa có tên";
      const identity = document.createElement("div");
      identity.className = "lead-identity";
      const nameElement = document.createElement("strong");
      nameElement.textContent = name;
      const emailElement = document.createElement("small");
      emailElement.textContent = lead.email || "Không có email";
      identity.append(nameElement, emailElement);
      addCell(row, identity, "lead-cell");
      addCell(row, lead.phone || lead.phoneNumber || lead.phone_number, "phone-cell");

      const statusValue = String(lead.status || "pending").toLowerCase();
      const badge = document.createElement("span");
      badge.className = `status-badge status-${statusValue.replace(/[^a-z0-9_-]/g, "")}`;
      badge.textContent = lead.statusLabel || lead.status_label || statusLabels[statusValue] || lead.status || "Chờ xử lý";
      addCell(row, badge);

      const consultant = lead.assignedConsultant || lead.assigned_consultant || lead.consultant || {};
      const consultantName = consultant.name || consultant.fullName || lead.assignedConsultantName || lead.assigned_consultant_name;
      if (state.role === "manager") {
        const assignment = document.createElement("div");
        assignment.className = "consultant-cell";
        const avatar = document.createElement("span");
        avatar.className = "avatar avatar-small";
        avatar.textContent = consultantName ? consultantName.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(-2).join("").toUpperCase() : "—";
        const label = document.createElement("span");
        label.textContent = consultantName || "Chưa phân công";
        assignment.append(avatar, label);
        addCell(row, assignment);
      } else {
        addCell(row, consultantName || "Chưa phân công");
      }

      const createdAt = lead.createdAt || lead.created_at || lead.createdOn || lead.created_on;
      addCell(row, formatDate(createdAt), "date-cell");
      elements.rows.append(row);
    });
  }

  function renderLoading() {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    const stateBox = document.createElement("div");
    stateBox.className = "table-state";
    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");
    stateBox.append(spinner, document.createTextNode("Đang tải danh sách lead..."));
    cell.append(stateBox);
    row.append(cell);
    elements.rows.replaceChildren(row);
  }

  function renderEmpty(message, restricted) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    const stateBox = document.createElement("div");
    stateBox.className = `table-state${restricted ? " restricted-state" : ""}`;
    stateBox.textContent = message;
    cell.append(stateBox);
    row.append(cell);
    elements.rows.replaceChildren(row);
    elements.resultCount.textContent = "0";
    elements.tableSummary.textContent = "Không có dữ liệu";
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
  }

  function updatePagination() {
    const totalPages = Math.max(1, Math.ceil(state.total / pageSize));
    if (state.page > totalPages) {
      state.page = totalPages;
      loadLeads();
      return;
    }
    const first = state.total === 0 ? 0 : (state.page - 1) * pageSize + 1;
    const last = Math.min(state.page * pageSize, state.total);
    elements.resultCount.textContent = String(state.total);
    elements.tableSummary.textContent = state.total
      ? `Hiển thị ${first}–${last} trong ${state.total} lead`
      : "Không có lead phù hợp";
    elements.pageIndicator.textContent = `Trang ${state.page} / ${totalPages}`;
    elements.previousPage.disabled = state.page <= 1;
    elements.nextPage.disabled = state.page >= totalPages;
  }

  function showError(message) {
    elements.error.textContent = message;
    elements.error.hidden = false;
  }

  function setFiltersAndLoad() {
    state.page = 1;
    loadLeads();
  }

  function updateToday() {
    document.getElementById("today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric",
    }).format(new Date());
  }

  elements.search.addEventListener("input", () => {
    window.clearTimeout(state.debounceTimer);
    state.debounceTimer = window.setTimeout(() => {
      state.search = elements.search.value.trim();
      setFiltersAndLoad();
    }, 300);
  });
  elements.status.addEventListener("change", () => {
    state.status = elements.status.value;
    setFiltersAndLoad();
  });
  elements.consultantFilter.addEventListener("change", () => {
    state.consultantId = elements.consultantFilter.value;
    setFiltersAndLoad();
  });
  elements.previousPage.addEventListener("click", () => {
    if (state.page > 1) {
      state.page -= 1;
      loadLeads();
    }
  });
  elements.nextPage.addEventListener("click", () => {
    if (state.page < Math.ceil(state.total / pageSize)) {
      state.page += 1;
      loadLeads();
    }
  });
  elements.reload.addEventListener("click", async () => {
    if (state.role === "manager" && !demoMode) {
      try {
        await loadConsultants();
      } catch (error) {
        console.error("Không thể tải danh sách tư vấn viên.", error);
        showError(`Không thể tải bộ lọc tư vấn viên: ${error.message}`);
      }
    }
    loadLeads();
  });

  updateToday();
  if (initializeRole()) {
    (async function start() {
      if (state.role === "manager") {
        try {
          await loadConsultants();
        } catch (error) {
          console.error("Không thể tải danh sách tư vấn viên.", error);
          showError(`Không thể tải bộ lọc tư vấn viên: ${error.message}`);
        }
      }
      await loadLeads();
    })();
  }
})();
