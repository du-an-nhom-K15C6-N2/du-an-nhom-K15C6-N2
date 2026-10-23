(() => {
  "use strict";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[character]);
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

  function formatDateTimeLocalInput(dateObj) {
    const pad = n => String(n).padStart(2, "0");
    const yyyy = dateObj.getFullYear();
    const mm = pad(dateObj.getMonth() + 1);
    const dd = pad(dateObj.getDate());
    const hh = pad(dateObj.getHours());
    const min = pad(dateObj.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  function initials(name) {
    return String(name || "?").trim().split(/\s+/).slice(-2).map(part => part[0] || "").join("").toUpperCase();
  }

  let activeCareLead = null;

  function getElements() {
    return {
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
  }

  function clearCareValidation(form) {
    form.querySelectorAll(".field-error").forEach(err => err.textContent = "");
    form.querySelectorAll(".form-field").forEach(f => f.classList.remove("has-error"));
  }

  function showCareFieldError(form, name, message) {
    const input = form.elements[name];
    const error = form.querySelector(`[data-error-for="${name}"]`);
    if (!input || !error) return;
    error.textContent = message;
    input.closest(".form-field").classList.add("has-error");
    input.focus();
  }

  function showCareApiError(el, msg) {
    el.textContent = msg;
    el.hidden = false;
  }

  function hideCareApiError(el) {
    el.hidden = true;
    el.textContent = "";
  }

  function switchCareTab(tabName) {
    document.querySelectorAll(".care-tab").forEach(tab => {
      tab.classList.toggle("active", tab.dataset.tab === tabName);
    });
    const tabForm = document.querySelector("#care-tab-form");
    const tabHistory = document.querySelector("#care-tab-history");
    if (tabForm) tabForm.classList.toggle("active", tabName === "log-form");
    if (tabHistory) tabHistory.classList.toggle("active", tabName === "log-history");
  }

  function renderCareLeadReminderBox(lead, onComplete, onDelete) {
    const elements = getElements();
    const reminder = lead.callbackReminder;
    if (!reminder || !reminder.reminderAt) {
      elements.careLeadReminderBox.innerHTML = `<span class="reminder-pill reminder-none">Chưa có lịch hẹn</span>`;
      return;
    }
    const formatted = formatDateTime(reminder.reminderAt);
    let html = "";
    if (lead.isOverdue) {
      html = `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="reminder-pill reminder-overdue">⚠️ Quá hạn gọi: ${escapeHtml(formatted)}</span>
        <div style="display:flex;gap:4px">
          <button type="button" class="text-button" id="btn-complete-reminder" style="color:#16a34a;font-size:10px">✓ Đã gọi</button>
          <button type="button" class="text-button" id="btn-delete-reminder" style="color:#dc2626;font-size:10px">✕ Hủy nhắc</button>
        </div>
      </div>`;
    } else if (reminder.isCompleted) {
      html = `<span class="reminder-pill reminder-completed">✓ Đã gọi lại lúc ${escapeHtml(formatted)}</span>`;
    } else {
      html = `<div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
        <span class="reminder-pill reminder-pending">⏰ Hẹn gọi lại: ${escapeHtml(formatted)}</span>
        <div style="display:flex;gap:4px">
          <button type="button" class="text-button" id="btn-complete-reminder" style="color:#16a34a;font-size:10px">✓ Đã gọi</button>
          <button type="button" class="text-button" id="btn-delete-reminder" style="color:#dc2626;font-size:10px">✕ Hủy nhắc</button>
        </div>
      </div>`;
    }
    elements.careLeadReminderBox.innerHTML = html;

    const btnComplete = elements.careLeadReminderBox.querySelector("#btn-complete-reminder");
    if (btnComplete && onComplete) {
      btnComplete.addEventListener("click", () => onComplete(lead.id));
    }
    const btnDelete = elements.careLeadReminderBox.querySelector("#btn-delete-reminder");
    if (btnDelete && onDelete) {
      btnDelete.addEventListener("click", () => onDelete(lead.id));
    }
  }

  async function loadAndRenderCareLogs(leadId, apiRequestFn, fallbackLead) {
    const elements = getElements();
    let logs = [];
    try {
      if (apiRequestFn) {
        const res = await apiRequestFn(`/api/leads/${encodeURIComponent(leadId)}/care-logs`);
        logs = res && res.data ? res.data : [];
      } else {
        logs = (fallbackLead && fallbackLead.careLogs) || [];
      }
    } catch (err) {
      logs = (fallbackLead && fallbackLead.careLogs) || [];
    }

    if (elements.careHistoryCount) elements.careHistoryCount.textContent = logs.length;
    if (!elements.careHistoryList) return;

    if (logs.length === 0) {
      elements.careHistoryList.innerHTML = `<div class="care-empty-history">Chưa có nhật ký chăm sóc nào được ghi nhận cho khách hàng này.</div>`;
      return;
    }

    const typeIcons = {
      "Gọi điện": { icon: "📞", class: "type-tag-call" },
      "Nhắn tin": { icon: "💬", class: "type-tag-message" },
      "Gặp mặt": { icon: "👥", class: "type-tag-meeting" }
    };

    elements.careHistoryList.innerHTML = logs.map(item => {
      const typeConfig = typeIcons[item.type] || { icon: "📝", class: "type-tag-call" };
      return `<div class="care-history-item">
        <div class="care-history-head">
          <span class="care-type-tag ${typeConfig.class}">${typeConfig.icon} ${escapeHtml(item.type)}</span>
          <span class="care-time-tag">${escapeHtml(formatDateTime(item.timestamp || item.createdAt))}</span>
        </div>
        <div class="care-content-box">${escapeHtml(item.content)}</div>
      </div>`;
    }).join("");
  }

  function openCareModal(lead, callbacks = {}) {
    const elements = getElements();
    activeCareLead = lead;
    elements.careForm.reset();
    clearCareValidation(elements.careForm);
    hideCareApiError(elements.careFormApiError);

    elements.careLeadName.textContent = lead.name;
    elements.careLeadContact.textContent = `${lead.phone} • ${lead.email || "Chưa có email"} • ${lead.programOfInterest || ""}`;
    elements.careLeadAvatar.textContent = initials(lead.name);
    elements.careLeadSubinfo.textContent = `Nguồn: ${lead.source} • Trạng thái: ${lead.status}`;

    const now = new Date();
    elements.careForm.elements.timestamp.value = formatDateTimeLocalInput(now);

    const defaultReminder = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    defaultReminder.setHours(9, 0, 0, 0);
    elements.careReminderAt.value = formatDateTimeLocalInput(defaultReminder);
    elements.enableCallbackReminder.checked = false;
    elements.reminderFieldsGroup.hidden = true;

    renderCareLeadReminderBox(lead, callbacks.onComplete, callbacks.onDelete);
    switchCareTab("log-form");
    loadAndRenderCareLogs(lead.id, callbacks.apiRequest, lead);

    elements.careModal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeCareModal() {
    const elements = getElements();
    if (elements.careModal) elements.careModal.hidden = true;
    document.body.style.overflow = "";
    activeCareLead = null;
  }

  window.LeadCareLogsModule = {
    openCareModal,
    closeCareModal,
    switchCareTab,
    renderCareLeadReminderBox,
    loadAndRenderCareLogs,
    clearCareValidation,
    showCareFieldError,
    showCareApiError,
    hideCareApiError,
    formatDateTime,
    formatDateTimeLocalInput,
    getActiveCareLead: () => activeCareLead,
    setActiveCareLead: l => { activeCareLead = l; }
  };
})();
