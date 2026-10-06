const DRAFTS_STORAGE_KEY = 'dnkn_form_drafts';
const SENSITIVE_FIELD_PATTERN = /password|token|secret|authorization/i;

function getFormKey(form, index) {
  return form.dataset.draftKey || form.id || form.name || `form-${index}`;
}

function getFormFields(form) {
  return Array.from(form.elements).filter((field) => {
    if (!field.name || SENSITIVE_FIELD_PATTERN.test(field.name)) return false;
    if (field.matches(':disabled, [type="password"], [type="hidden"], [type="file"], [type="button"], [type="submit"], [type="reset"]')) {
      return false;
    }
    return true;
  });
}

function readDrafts() {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFTS_STORAGE_KEY) || '{}');
  } catch (error) {
    console.warn('Không thể đọc bản nháp biểu mẫu trong sessionStorage:', error);
    return {};
  }
}

function writeDrafts(drafts) {
  try {
    sessionStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify(drafts));
  } catch (error) {
    console.warn('Không thể lưu bản nháp biểu mẫu trong sessionStorage:', error);
  }
}

function snapshotForm(form) {
  const values = {};
  for (const field of getFormFields(form)) {
    if (field.type === 'radio') {
      if (field.checked) values[field.name] = field.value;
    } else if (field.type === 'checkbox') {
      values[field.name] = field.checked;
    } else if (field instanceof HTMLSelectElement && field.multiple) {
      values[field.name] = Array.from(field.selectedOptions, (option) => option.value);
    } else {
      values[field.name] = field.value;
    }
  }
  return values;
}

export function saveFormDraft(form) {
  if (!(form instanceof HTMLFormElement) || form.id === 'dnkn-login-form') return;
  const drafts = readDrafts();
  const formKey = getFormKey(form, Array.from(document.forms).indexOf(form));
  const routeDrafts = drafts[window.location.pathname] || {};
  routeDrafts[formKey] = snapshotForm(form);
  drafts[window.location.pathname] = routeDrafts;
  writeDrafts(drafts);
}

export function clearFormDraft(form) {
  if (!(form instanceof HTMLFormElement)) return;
  const drafts = readDrafts();
  const routeKey = window.location.pathname;
  const routeDrafts = drafts[routeKey];
  if (!routeDrafts) return;

  delete routeDrafts[getFormKey(form, Array.from(document.forms).indexOf(form))];
  if (Object.keys(routeDrafts).length === 0) delete drafts[routeKey];
  writeDrafts(drafts);
}

export function restoreFormDrafts(container) {
  const drafts = readDrafts();
  const routeDrafts = drafts[window.location.pathname] || {};
  let restoredCount = 0;

  Array.from(container.querySelectorAll('form')).forEach((form, index) => {
    const formKey = getFormKey(form, index);
    const values = routeDrafts[formKey];
    if (!values) return;

    for (const field of getFormFields(form)) {
      if (!Object.prototype.hasOwnProperty.call(values, field.name)) continue;
      const value = values[field.name];
      if (field.type === 'radio') {
        field.checked = field.value === value;
      } else if (field.type === 'checkbox') {
        field.checked = value === true;
      } else if (field instanceof HTMLSelectElement && field.multiple && Array.isArray(value)) {
        Array.from(field.options).forEach((option) => {
          option.selected = value.includes(option.value);
        });
      } else {
        field.value = typeof value === 'string' ? value : '';
      }
      field.dispatchEvent(new Event('input', { bubbles: true }));
      field.dispatchEvent(new Event('change', { bubbles: true }));
    }
    restoredCount += 1;
  });

  return restoredCount;
}

export function clearFormDrafts() {
  sessionStorage.removeItem(DRAFTS_STORAGE_KEY);
}
