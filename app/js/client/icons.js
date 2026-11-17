/**
 * 线性图标。全部为原创路径，无第三方图标库依赖。
 */

const PATHS = {
  play: '<path d="M8 5.5v13l10-6.5z"/>',
  users: '<path d="M16 19v-1.6c0-2-1.6-3.4-3.6-3.4H7.6C5.6 14 4 15.4 4 17.4V19"/><circle cx="10" cy="8" r="3"/><path d="M17 11a3 3 0 1 0-1.2-5.7M20 19v-1.6c0-1.7-1.1-3-2.7-3.3"/>',
  cloud: '<path d="M6.5 18h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.8-1.2A4 4 0 0 0 6.5 18Z"/><path d="M9 21h6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1L10.8 5"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.2-1.2"/>',
  copy: '<rect x="8" y="8" width="11" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2"/>',
  check: '<path d="m5 12 4 4 10-10"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  sound: '<path d="M5 10v4h3l4 3V7L8 10H5Z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M5 10v4h3l4 3V7L8 10H5Z"/><path d="m16 10 4 4m0-4-4 4"/>',
  rules: '<path d="M5 4h11a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2V4Z"/><path d="M5 17h13M8 8h6M8 11h4"/>',
  exit: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4M18 12H9"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1"/><circle cx="15.5" cy="8.5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8.5" cy="15.5" r="1"/><circle cx="15.5" cy="15.5" r="1"/>',
  clock: '<circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/>',
  wifi: '<path d="M4 9a12 12 0 0 1 16 0M7 12a7.5 7.5 0 0 1 10 0M10 15a3 3 0 0 1 4 0"/><circle cx="12" cy="18.5" r=".9" fill="currentColor" stroke="none"/>',
  crown: '<path d="m4 8 4 3 4-6 4 6 4-3-2 10H6L4 8Z"/><path d="M6 21h12"/>',
  share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="m8.5 10.8 7-3.6M8.5 13.2l7 3.6"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 4 4M8 10.5h5M10.5 8v5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 7.8v.2"/>',
  shield: '<path d="M12 3 5 6v5.5c0 4.2 2.6 7.8 7 9.5 4.4-1.7 7-5.3 7-9.5V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>',
  heart: '<path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 4.6-7 9-7 9Z"/>',
  leaf: '<path d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14Z"/><path d="M5 19c2-6 6-9 10-11"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  trash: '<path d="M5 7h14M9 7V5h6v2M7 7l1 13h8l1-13M10 11v5M14 11v5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  refresh: '<path d="M4 10a8 8 0 0 1 13.4-4.4L20 8M20 4v4h-4M20 14a8 8 0 0 1-13.4 4.4L4 16M4 20v-4h4"/>',
  home: '<path d="m4 11 8-7 8 7v9h-6v-5h-4v5H4v-9Z"/>',
  send: '<path d="m3 11 18-7-7 18-3-7-8-4Z"/><path d="m11 13 5-5"/>',
  flag: '<path d="M6 21V4M6 4h11l-2 4 2 4H6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4M12 13v5M8 21h8M10 18h4"/>',
  scroll: '<path d="M6 4h12v16H6z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  palette: '<path d="M12 3a9 9 0 1 0 0 18h1.5a2 2 0 0 0 0-4H12a2 2 0 0 1 0-4h5a3 3 0 0 0 3-3 7 7 0 0 0-8-7Z"/><circle cx="8" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="11" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="8" r="1" fill="currentColor" stroke="none"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/>',
  message: '<path d="M4 5h16v12H8l-4 4V5Z"/><path d="M8 9h8M8 12h5"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16h6M2 12v3M22 12v3"/>',
  door: '<path d="M5 21V4h10v17M15 12h4v9M8 12h2M3 21h18"/>',
  mountain: '<path d="m3 19 6-11 4 6 2-3 6 8H3Z"/><path d="M8 12h.01"/>',
  feather: '<path d="M20 4c-8 0-13 5-13 12v3M7 19c5-2 10-8 11-13"/><path d="M7 16c3 0 6-1 8-4"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1"/><rect x="13" y="4" width="7" height="7" rx="1"/><rect x="4" y="13" width="7" height="7" rx="1"/><rect x="13" y="13" width="7" height="7" rx="1"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M10 10h.01M13 10h.01M16 10h.01M8 14h8"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.8.6-1.7 1.2-1.7 2.2M12 16.5v.1"/>',
};

export function icon(name, className = '') {
  const path = PATHS[name] || PATHS.spark;
  return `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${path}</svg>`;
}

export function kiteIcon(className = '') {
  return `<svg class="${className}" viewBox="0 0 24 28" fill="none" aria-hidden="true">
    <path d="M12 2 22 12 12 26 2 12 12 2Z" fill="currentColor" opacity=".9"/>
    <path d="M12 3v21M3 12h18" stroke="rgba(255,250,240,.5)" stroke-width=".8"/>
  </svg>`;
}
