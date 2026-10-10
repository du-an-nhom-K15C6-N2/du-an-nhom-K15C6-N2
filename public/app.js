(() => {
  "use strict";

  const tokenKey = "accessToken";
  const userKey = "currentUser";
  const state = { user: null, role: "", page: 1, pageSize: 10, total: 0, search: "", status: "", consultantId: "", busy: false, phoneAvailable: false, phoneTimer: 0 };
  const byId = (id) => document.getElementById(id);
  const form = byId("lead-form");
  const token = () => localStorage.getItem(tokenKey) || "";
  const isManager = (role) => ["admin", "sales_manager", "manager", "training_manager"].includes(String(role).toLowerCase());
  const roleName = (role) => isManager(role) ? "manager" : ["consultant", "academic_advisor", "advisor"].includes(String(role).toLowerCase()) ? "consultant" : "";

  function showBanner(message, error = false) {
    const banner = byId("banner");
    banner.textContent = message;
    banner.classList.toggle("error", error);
    banner.hidden = !message;
  }

  async function request(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token() ? { Authorization: `Bearer ${token()}` } : {}),
        ...options.headers,
      },
    });
    if (!response.ok) {
      let message = `Yêu cầu thất bại (${response.status}).`;
      try {
        const body = await response.json();
        if (typeof body.message === "string") message = body.message;
      } catch {
        // Keep the HTTP status message if the API response isn't JSON.
      }
      if (response.status === 401) logout();
      throw new Error(message);
    }
    if (response.status === 204) return null;
    return response.json();
  }

  function manager() {
    return isManager(state.user?.role);
  }

  function setAuthenticated(user) {
    state.user = user;
    state.role = roleName(user?.role);
    byId("login-panel").hidden = Boolean(state.role);
    byId("workspace").hidden = !state.role;
    byId("logout-button").hidden = !state.role;
    byId("session-label").textContent = state.role ? `${user.name || user.email} · ${manager() ? "Quản lý" : "Tư vấn viên"}` : "Chưa đăng nhập";
    byId("create-button").hidden = !state.role;
    byId("consultant-filter-wrap").hidden = !manager();
    byId("scope-copy").textContent = manager() ? "Quản lý có thể xem và quản lý toàn bộ lead." : "Bạn chỉ xem và cập nhật lead được giao cho mình.";
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    setAuthenticated(null);
    byId("lead-rows").innerHTML = '<tr><td colspan="6">Đăng nhập để tải dữ liệu.</td></tr>';
  }

  function showError(error) {
    showBanner(error.message || "Đã xảy ra lỗi.", true);
  }

  async function loadConsultants() {
    if (!manager()) return;
    const payload = await request("/api/consultants");
    const items = payload.items || [];
    const filter = byId("consultant-filter");
    const assignment = form.elements.assignedTo;
    filter.replaceChildren(new Option("Tất cả tư vấn viên", ""));
    assignment.replaceChildren(new Option("Chưa phân công", ""));
    for (const consultant of items) {
      filter.add(new Option(consultant.name, consultant.id));
      assignment.add(new Option(consultant.name, consultant.id));
    }
  }

  function escape(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
  }

  function dateText(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
  }

  async function loadLeads() {
    if (!state.role || state.busy) return;
    state.busy = true;
    byId("reload-button").disabled = true;
    showBanner("");
    byId("lead-rows").innerHTML = '<tr><td colspan="6">Đang tải danh sách...</td></tr>';
    const query = new URLSearchParams({ page: String(state.page), pageSize: String(state.pageSize) });
    if (state.search) query.set("search", state.search);
    if (state.status) query.set("status", state.status);
    if (state.consultantId && manager()) query.set("consultantId", state.consultantId);
    try {
      const result = await request(`/api/leads?${query}`);
      state.total = result.total;
      renderRows(result.items);
      updatePagination();
    } catch (error) {
      showError(error);
      byId("lead-rows").innerHTML = `<tr><td colspan="6">${escape(error.message)}</td></tr>`;
    } finally {
      state.busy = false;
      byId("reload-button").disabled = false;
    }
  }

  function renderRows(leads) {
    const rows = byId("lead-rows");
    if (!leads.length) {
      rows.innerHTML = '<tr><td colspan="6">Không tìm thấy lead phù hợp.</td></tr>';
      return;
    }
    rows.innerHTML = leads.map((lead) => {
      const owner = lead.assignedConsultant?.name || lead.assigned_name || "Chưa phân công";
      const detailLink = `/features/07-lead-history-detail-ui/?leadId=${encodeURIComponent(lead.id)}`;
      const actions = [
        `<button class="text-button" data-action="edit" data-id="${escape(lead.id)}" type="button">Sửa</button>`,
        `<a class="text-button" href="${detailLink}">Lịch sử</a>`,
      ];
      if (manager()) actions.push(`<button class="text-button danger" data-action="delete" data-id="${escape(lead.id)}" type="button">Xóa</button>`);
      return `<tr>
        <td><span class="lead-name">${escape(lead.name)}</span><span class="lead-email">${escape(lead.email || "Chưa có email")}</span></td>
        <td>${escape(lead.phone)}</td>
        <td><span class="status">${escape(lead.status)}</span></td>
        <td>${escape(owner)}</td>
        <td>${escape(dateText(lead.createdAt || lead.created_at))}</td>
        <td><div class="actions">${actions.join("")}</div></td>
      </tr>`;
    }).join("");
  }

  function updatePagination() {
    const pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    byId("table-summary").textContent = state.total ? `${(state.page - 1) * state.pageSize + 1}–${Math.min(state.page * state.pageSize, state.total)} trong ${state.total} lead` : "Không có lead";
    byId("page-indicator").textContent = `Trang ${state.page} / ${pages}`;
    byId("previous-page").disabled = state.page <= 1;
    byId("next-page").disabled = state.page >= pages;
  }

  function openForm(lead) {
    form.reset();
    form.elements.id.value = lead?.id || "";
    form.elements.name.value = lead?.name || "";
    form.elements.phone.value = lead?.phone || "";
    form.elements.email.value = lead?.email || "";
    form.elements.source.value = lead?.source || "";
    form.elements.status.value = lead?.status || "new";
    form.elements.assignedTo.value = lead?.assigned_to || lead?.assignedToId || "";
    byId("dialog-title").textContent = lead ? "Cập nhật lead" : "Tạo lead";
    byId("assigned-wrap").hidden = !manager();
    byId("form-error").hidden = true;
    byId("phone-feedback").textContent = "";
    state.phoneAvailable = false;
    byId("lead-dialog").showModal();
  }

  async function checkPhone() {
    const phone = form.elements.phone.value.trim();
    const feedback = byId("phone-feedback");
    if (!phone) {
      state.phoneAvailable = false;
      feedback.textContent = "";
      return;
    }
    try {
      const params = new URLSearchParams({ phone });
      if (form.elements.id.value) params.set("excludeId", form.elements.id.value);
      const result = await request(`/api/leads/phone-check?${params}`);
      state.phoneAvailable = !result.duplicate;
      feedback.textContent = result.duplicate ? "Số điện thoại đã thuộc một lead khác." : "Số điện thoại có thể sử dụng.";
      feedback.className = `field-feedback ${result.duplicate ? "error" : "success"}`;
    } catch (error) {
      state.phoneAvailable = false;
      feedback.textContent = error.message;
      feedback.className = "field-feedback error";
    }
  }

  async function saveLead(event) {
    event.preventDefault();
    const id = form.elements.id.value;
    const body = {
      name: form.elements.name.value,
      phone: form.elements.phone.value,
      email: form.elements.email.value,
      source: form.elements.source.value,
      status: form.elements.status.value,
    };
    if (!id && manager()) body.assignedTo = form.elements.assignedTo.value || null;
    const saveButton = byId("save-button");
    saveButton.disabled = true;
    try {
      await checkPhone();
      if (!state.phoneAvailable) throw new Error(byId("phone-feedback").textContent || "Số điện thoại chưa hợp lệ.");
      await request(id ? `/api/leads/${encodeURIComponent(id)}` : "/api/leads", {
        method: id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      byId("lead-dialog").close();
      await loadLeads();
    } catch (error) {
      byId("form-error").textContent = error.message;
      byId("form-error").hidden = false;
    } finally {
      saveButton.disabled = false;
    }
  }

  async function handleRowAction(event) {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const id = button.dataset.id;
    if (button.dataset.action === "delete") {
      if (!window.confirm("Xóa lead này? Thao tác này không thể hoàn tác.")) return;
      try {
        await request(`/api/leads/${encodeURIComponent(id)}`, { method: "DELETE" });
        await loadLeads();
      } catch (error) {
        showError(error);
      }
      return;
    }
    try {
      const result = await request(`/api/leads/${encodeURIComponent(id)}`);
      openForm(result.data || result);
    } catch (error) {
      if (error.message.includes("404")) {
        showError(new Error("API không cung cấp chi tiết lead; hãy tải lại danh sách."));
        return;
      }
      showError(error);
    }
  }

  byId("login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    byId("login-error").hidden = true;
    const data = new FormData(event.currentTarget);
    try {
      const result = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      localStorage.setItem(tokenKey, result.accessToken);
      localStorage.setItem(userKey, JSON.stringify(result.user));
      setAuthenticated(result.user);
      if (!state.role) throw new Error("Vai trò tài khoản không được hỗ trợ.");
      await loadConsultants();
      await loadLeads();
    } catch (error) {
      byId("login-error").textContent = error.message;
      byId("login-error").hidden = false;
    }
  });
  byId("logout-button").addEventListener("click", logout);
  byId("create-button").addEventListener("click", () => openForm(null));
  byId("reload-button").addEventListener("click", loadLeads);
  byId("lead-rows").addEventListener("click", handleRowAction);
  byId("lead-form").addEventListener("submit", saveLead);
  byId("close-dialog").addEventListener("click", () => byId("lead-dialog").close());
  byId("cancel-dialog").addEventListener("click", () => byId("lead-dialog").close());
  form.elements.phone.addEventListener("input", () => {
    window.clearTimeout(state.phoneTimer);
    state.phoneAvailable = false;
    state.phoneTimer = window.setTimeout(checkPhone, 350);
  });
  byId("search-input").addEventListener("input", () => {
    window.clearTimeout(state.searchTimer);
    state.searchTimer = window.setTimeout(() => {
      state.search = byId("search-input").value.trim();
      state.page = 1;
      loadLeads();
    }, 300);
  });
  byId("status-filter").addEventListener("change", () => {
    state.status = byId("status-filter").value;
    state.page = 1;
    loadLeads();
  });
  byId("consultant-filter").addEventListener("change", () => {
    state.consultantId = byId("consultant-filter").value;
    state.page = 1;
    loadLeads();
  });
  byId("previous-page").addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadLeads(); } });
  byId("next-page").addEventListener("click", () => { if (state.page < Math.ceil(state.total / state.pageSize)) { state.page += 1; loadLeads(); } });

  try {
    const user = JSON.parse(localStorage.getItem(userKey) || "null");
    if (token() && user && roleName(user.role)) {
      setAuthenticated(user);
      loadConsultants().then(loadLeads).catch(showError);
    }
  } catch (error) {
    console.error("Không thể khôi phục phiên người dùng.", error);
    logout();
  }
})();
