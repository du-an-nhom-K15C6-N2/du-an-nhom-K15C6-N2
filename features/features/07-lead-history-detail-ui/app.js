(function () {
  "use strict";

  const config = window.LEAD_HISTORY_CONFIG || {};
  const params = new URLSearchParams(window.location.search);
  const demoMode = config.demo === true || params.get("demo") === "1" || params.get("demo") === "empty";
  const demoEmpty = params.get("demo") === "empty";
  const leadId = params.get("leadId") || config.leadId || "LD-24018";
  const apiBaseUrl = String(config.apiBaseUrl || "").replace(/\/$/, "");
  const state = { loading: false, history: [], requestId: 0, controller: null };

  const elements = {
    leadId: document.querySelector("#lead-id"),
    historyContent: document.querySelector("#history-content"),
    loading: document.querySelector("#loading-state"),
    empty: document.querySelector("#empty-state"),
    error: document.querySelector("#error-state"),
    errorMessage: document.querySelector("#error-message"),
    timeline: document.querySelector("#timeline"),
    footer: document.querySelector("#history-footer"),
    historyCount: document.querySelector("#history-count"),
    historyCountBadge: document.querySelector("#history-count-badge"),
    reload: document.querySelector("#reload-button"),
    retry: document.querySelector("#retry-button"),
  };

  const demoHistory = [
    {
      id: "TH-1051",
      transferredAt: "2026-10-08T14:32:00+07:00",
      performedBy: { name: "Nguyễn Minh Anh" },
      fromConsultant: { name: "Trần Hoàng Nam" },
      toConsultant: { name: "Lê Phương Thảo" },
      note: "Điều chỉnh phân bổ theo khu vực phụ trách.",
    },
    {
      id: "TH-0984",
      transferredAt: "2026-10-02T09:15:00+07:00",
      performedBy: { name: "Nguyễn Minh Anh" },
      fromConsultant: null,
      toConsultant: { name: "Trần Hoàng Nam" },
      note: "Phân công tư vấn viên phụ trách lần đầu.",
    },
  ];

  function readToken() {
    try {
      return window.localStorage.getItem(config.authTokenKey || "accessToken") || "";
    } catch (error) {
      console.error("Không thể đọc token đăng nhập.", error);
      return "";
    }
  }

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.history)) return payload.history;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.data?.items)) return payload.data.items;
    if (Array.isArray(payload?.data?.history)) return payload.data.history;
    throw new Error("Dữ liệu lịch sử từ API không đúng định dạng.");
  }

  async function requestHistory(signal) {
    if (demoMode) {
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      return demoEmpty ? [] : demoHistory;
    }

    const endpoint = String(config.historyEndpoint || "/api/leads/{leadId}/transfer-history")
      .replace("{leadId}", encodeURIComponent(leadId));
    const token = readToken();
    const response = await fetch(`${apiBaseUrl}${endpoint}`, {
      method: "GET",
      signal,
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    if (!response.ok) {
      let message = `Yêu cầu thất bại (${response.status}).`;
      try {
        const payload = await response.json();
        if (typeof payload?.message === "string" && payload.message.trim()) message = payload.message;
      } catch {
        // Keep the HTTP status message when the server response isn't JSON.
      }
      throw new Error(message);
    }

    if (response.status === 204) return [];
    const responseText = await response.text();
    if (!responseText) return [];
    try {
      return normalizeList(JSON.parse(responseText));
    } catch (error) {
      if (error instanceof SyntaxError) throw new Error("Máy chủ trả về dữ liệu JSON không hợp lệ.");
      throw error;
    }
  }

  function firstValue(record, keys) {
    for (const key of keys) {
      if (record?.[key] !== undefined && record[key] !== null) return record[key];
    }
    return null;
  }

  function personName(person) {
    if (typeof person === "string") return person;
    if (!person || typeof person !== "object") return "";
    return person.name || person.fullName || person.full_name || person.displayName || person.display_name || "";
  }

  function eventDetails(event) {
    const from = firstValue(event, ["fromConsultant", "from_consultant", "previousConsultant", "previous_consultant", "oldConsultant", "old_consultant"]);
    const to = firstValue(event, ["toConsultant", "to_consultant", "newConsultant", "new_consultant", "assignedConsultant", "assigned_consultant", "targetConsultant", "target_consultant"]);
    return {
      id: firstValue(event, ["id", "transferId", "transfer_id"]),
      timestamp: firstValue(event, ["transferredAt", "transferred_at", "occurredAt", "occurred_at", "createdAt", "created_at", "timestamp"]),
      actor: personName(firstValue(event, ["performedBy", "performed_by", "transferredBy", "transferred_by", "actor", "createdBy", "created_by"])),
      from: personName(from) || firstValue(event, ["fromConsultantName", "from_consultant_name", "previousConsultantName", "previous_consultant_name", "oldConsultantName", "old_consultant_name"]),
      to: personName(to) || firstValue(event, ["toConsultantName", "to_consultant_name", "newConsultantName", "new_consultant_name", "assignedConsultantName", "assigned_consultant_name"]),
      note: firstValue(event, ["note", "reason", "description"]),
    };
  }

  function formatTimestamp(value) {
    if (!value) return "Không có thời gian";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date);
  }

  function createElement(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) node.className = className;
    if (text !== undefined && text !== null && text !== "") node.textContent = String(text);
    return node;
  }

  function consultantBlock(name, label, isNew) {
    const block = createElement("div", `consultant ${isNew ? "consultant-new" : "consultant-old"}`);
    block.append(createElement("span", "consultant-avatar", name ? name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase() : "?"));
    const copy = createElement("span", "consultant-copy");
    copy.append(createElement("small", "", label), createElement("strong", "", name || "Chưa phân công"));
    block.append(copy);
    return block;
  }

  function renderTimeline() {
    elements.timeline.replaceChildren();
    const sortedHistory = state.history.slice().sort((left, right) => {
      const leftTime = new Date(eventDetails(left).timestamp || 0).getTime();
      const rightTime = new Date(eventDetails(right).timestamp || 0).getTime();
      return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
    });

    sortedHistory.forEach((event, index) => {
      const details = eventDetails(event);
      const item = createElement("li", "timeline-item");
      const marker = createElement("span", `timeline-marker${index === 0 ? " latest-marker" : ""}`);
      marker.setAttribute("aria-hidden", "true");
      const body = createElement("article", "event-card");
      const top = createElement("div", "event-topline");
      const date = createElement("time", "event-time", formatTimestamp(details.timestamp));
      if (details.timestamp && !Number.isNaN(new Date(details.timestamp).getTime())) date.dateTime = new Date(details.timestamp).toISOString();
      top.append(date);
      if (index === 0) top.append(createElement("span", "latest-badge", "Gần nhất"));
      body.append(top);

      const actor = createElement("p", "event-actor");
      actor.append(createElement("span", "actor-icon", "↗"), document.createTextNode("Thực hiện bởi "));
      actor.append(createElement("strong", "", details.actor || "Không rõ người thực hiện"));
      body.append(actor);

      const transfer = createElement("div", "transfer-flow");
      transfer.append(
        consultantBlock(details.from, "TƯ VẤN VIÊN CŨ", false),
        createElement("span", "transfer-arrow", "→"),
        consultantBlock(details.to, "TƯ VẤN VIÊN MỚI", true),
      );
      body.append(transfer);

      const note = createElement("div", "event-note");
      note.append(createElement("span", "note-label", "GHI CHÚ"));
      note.append(createElement("p", "", details.note || "Không có ghi chú."));
      body.append(note);
      item.append(marker, body);
      elements.timeline.append(item);
    });
  }

  function render() {
    elements.historyContent.setAttribute("aria-busy", String(state.loading));
    elements.loading.hidden = !state.loading;
    elements.empty.hidden = state.loading || Boolean(state.error) || state.history.length > 0;
    elements.error.hidden = state.loading || !state.error;
    elements.timeline.hidden = state.loading || Boolean(state.error) || state.history.length === 0;
    elements.footer.hidden = state.loading || Boolean(state.error) || state.history.length === 0;
    elements.reload.disabled = state.loading;
    elements.reload.querySelector("span").classList.toggle("spin-icon", state.loading);

    if (state.error) elements.errorMessage.textContent = state.error;
    if (!state.loading && !state.error && state.history.length) {
      renderTimeline();
      elements.historyCount.textContent = `${state.history.length} lần chuyển giao`;
      elements.historyCountBadge.textContent = state.history.length;
      elements.historyCountBadge.hidden = false;
    } else {
      elements.historyCountBadge.hidden = true;
      elements.historyCountBadge.textContent = "";
    }
  }

  async function loadHistory() {
    const requestId = ++state.requestId;
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    state.loading = true;
    state.error = "";
    state.history = [];
    render();

    try {
      const history = await requestHistory(state.controller.signal);
      if (requestId !== state.requestId) return;
      if (!history.every((entry) => entry && typeof entry === "object" && !Array.isArray(entry))) {
        throw new Error("Một hoặc nhiều bản ghi lịch sử không đúng định dạng.");
      }
      state.history = history;
    } catch (error) {
      if (error.name === "AbortError" || requestId !== state.requestId) return;
      state.error = error.message || "Đã xảy ra lỗi khi tải lịch sử.";
      console.error("Không thể tải lịch sử chuyển giao lead.", error);
    } finally {
      if (requestId === state.requestId) {
        state.loading = false;
        state.controller = null;
        render();
      }
    }
  }

  elements.leadId.textContent = leadId;
  document.querySelector("#today-label").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  elements.reload.addEventListener("click", loadHistory);
  elements.retry.addEventListener("click", loadHistory);
  loadHistory();
})();
