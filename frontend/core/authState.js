/**
 * AuthState helper cho Standalone Preview Module DNKN-86
 */

import { getAuthSession } from './storage.js';

class SimpleAuthState {
  constructor() {
    const session = getAuthSession();
    this.state = {
      isLoading: false,
      isAuthenticated: session.isAuthenticated,
      user: session.user,
      token: session.token,
      role: session.role
    };
    this.listeners = new Set();
  }

  getState() {
    return { ...this.state };
  }

  setState(partial) {
    this.state = {
      ...this.state,
      ...partial,
      isAuthenticated: Boolean(partial.token ?? this.state.token)
    };
    this.listeners.forEach((listener) => {
      try {
        listener(this.state);
      } catch (err) {
        console.error('Lỗi listener authState:', err);
      }
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

export const authState = new SimpleAuthState();
