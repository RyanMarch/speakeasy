/**
 * Toast notifications & HTML escaping utility
 */

import { elements } from '../state.js';

export function showToast(message, options = {}) {
  const container = elements.toastContainer || document.getElementById('toast-container');
  if (!container) return;

  const duration = typeof options === 'number' ? options : (options.duration || 2400);
  const className = typeof options === 'object' && options.className ? options.className : '';

  const toast = document.createElement('div');
  toast.className = `toast ${className}`.trim();

  if (typeof options === 'object' && options.icon) {
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.innerHTML = /*html*/ options.icon;
    toast.appendChild(iconSpan);
    const textSpan = document.createElement('span');
    textSpan.className = 'toast-text';
    textSpan.textContent = message;
    toast.appendChild(textSpan);
  } else {
    toast.textContent = message;
  }

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 200ms ease';
    setTimeout(() => toast.remove(), 220);
  }, duration);
}

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
