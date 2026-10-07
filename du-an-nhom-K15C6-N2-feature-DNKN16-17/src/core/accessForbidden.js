import { renderAppErrorScreen } from '../components/AppErrorScreen.js';
import { getSafeAppPath, ROLE_NAVIGATION_MAP } from './navigation.js';

export function registerAccessForbiddenHandler(container, getState) {
  const handleAccessForbidden = (event) => {
    const state = getState();
    const role = (event.detail?.role || state.role || '').toUpperCase();
    const navigationTarget = state.navigationTarget || ROLE_NAVIGATION_MAP[role];
    renderAppErrorScreen(container, {
      type: 'forbidden',
      safePath: getSafeAppPath(
        state.isAuthenticated || Boolean(ROLE_NAVIGATION_MAP[role]),
        navigationTarget
      ),
      featureName: event.detail?.featureName || null,
      role: role || null
    });
  };

  window.addEventListener('app:access-forbidden', handleAccessForbidden);
  return () => window.removeEventListener('app:access-forbidden', handleAccessForbidden);
}
