/**
 * 轻量 UI 工具：原生 dialog 弹窗、提示条、复制、确认。
 * 不引入任何第三方组件库。
 */

import { icon } from './icons.js';

let currentDialog = null;
let lastFocused = null;

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function openModal({
  title = '',
  subtitle = '',
  content = '',
  className = '',
  actions = [],
  onMount = null,
  closeOnBackdrop = true,
} = {}) {
  closeModal();
  lastFocused = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = `modal ${className}`.trim();
  dialog.setAttribute('aria-label', title || '对话框');
  const actionsHtml = actions.length
    ? `<footer class="modal-actions">${actions
        .map(
          (action, index) =>
            `<button type="button" class="btn ${action.className || 'btn-ghost'}" data-action-index="${index}"${
              action.id ? ` id="${action.id}"` : ''
            }>${action.label}</button>`,
        )
        .join('')}</footer>`
    : '';
  dialog.innerHTML = `<div class="modal-panel">
    <header class="modal-head">
      <div>
        ${title ? `<h2>${escapeHtml(title)}</h2>` : ''}
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <button type="button" class="modal-close" aria-label="关闭">${icon('close')}</button>
    </header>
    <div class="modal-body">${content}</div>
    ${actionsHtml}
  </div>`;

  const close = () => {
    if (!dialog.open) return;
    dialog.close();
  };

  dialog.addEventListener('close', () => {
    dialog.remove();
    document.body.classList.remove('has-modal');
    if (currentDialog === dialog) currentDialog = null;
    if (lastFocused && typeof lastFocused.focus === 'function') {
      try {
        lastFocused.focus({ preventScroll: true });
      } catch {
        /* noop */
      }
    }
  });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.addEventListener('click', (event) => {
    if (!closeOnBackdrop) return;
    const rect = dialog.getBoundingClientRect();
    const outside =
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom;
    if (event.target === dialog && outside) close();
  });
  dialog.querySelector('.modal-close')?.addEventListener('click', close);

  actions.forEach((action, index) => {
    dialog.querySelector(`[data-action-index="${index}"]`)?.addEventListener('click', (event) => {
      if (action.close !== false) close();
      action.onClick?.(event, { close, dialog });
    });
  });

  document.getElementById('modal-root')?.appendChild(dialog);
  document.body.classList.add('has-modal');
  dialog.showModal();
  currentDialog = dialog;
  onMount?.({
    dialog,
    close,
    body: dialog.querySelector('.modal-body'),
    panel: dialog.querySelector('.modal-panel'),
  });
  return { dialog, close };
}

export function closeModal() {
  if (!currentDialog) return;
  try {
    currentDialog.close();
  } catch {
    /* noop */
  }
  currentDialog = null;
}

export function confirmDialog({
  title = '请确认',
  message = '',
  confirmText = '确定',
  cancelText = '再想想',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const modal = openModal({
      title,
      className: 'narrow',
      content: `<p class="modal-copy">${escapeHtml(message)}</p>`,
      actions: [
        {
          label: cancelText,
          className: 'btn-ghost',
          onClick: () => finish(false),
        },
        {
          label: confirmText,
          className: danger ? 'btn-primary' : 'btn-primary',
          onClick: () => finish(true),
        },
      ],
    });
    modal.dialog.addEventListener('close', () => finish(false), { once: true });
  });
}

export function toast(message, { tone = 'info', duration = 3400, iconName = null } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  while (root.children.length >= 3) root.firstElementChild?.remove();
  const el = document.createElement('div');
  el.className = `toast tone-${tone}`;
  el.setAttribute('role', 'status');
  const iconNameFinal = iconName || (tone === 'error' ? 'info' : tone === 'success' ? 'check' : 'spark');
  el.innerHTML = `${icon(iconNameFinal)}<span></span>`;
  el.querySelector('span').textContent = message;
  root.appendChild(el);
  const remove = () => {
    if (!el.isConnected) return;
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 300);
  };
  const timer = setTimeout(remove, Math.max(1400, duration));
  el.addEventListener('click', () => {
    clearTimeout(timer);
    remove();
  });
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce(fn, wait = 200) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

export function formatTime(date = new Date()) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function dicePips(value) {
  const map = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };
  const active = new Set(map[value] || []);
  return Array.from({ length: 9 }, (_, i) => `<span class="pip-cell"><span class="pip${active.has(i) ? ' is-on' : ''}"></span></span>`).join('');
}

export function setButtonBusy(button, busy, textWhenBusy = '请稍候…') {
  if (!button) return;
  if (busy) {
    if (!button.dataset.originalHtml) button.dataset.originalHtml = button.innerHTML;
    button.disabled = true;
    button.textContent = textWhenBusy;
  } else {
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }
}
