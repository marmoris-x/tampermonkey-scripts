// src/marketplace-deal-finder/_ui.js — Local copy of createToast + createStatusBar

/* ─── Internal: Shadow DOM Container ─── */

function createShadowContainer(opts) {
  opts = opts || {};
  const host = document.createElement(opts.tag || 'div');
  if (opts.id) host.id = opts.id;
  if (opts.className) host.className = opts.className;
  const root = host.attachShadow({ mode: 'closed' });
  if (opts.styles) {
    const style = document.createElement('style');
    style.textContent = opts.styles;
    root.appendChild(style);
  }
  document.body.appendChild(host);
  return { host: host, root: root };
}

/* ─── Toast Notification ─── */

export function createToast(message, opts) {
  opts = opts || {};
  const duration = opts.duration || 3000;
  const type = opts.type || 'info';
  const colors = { info: '#2196F3', success: '#4CAF50', error: '#F44336', warn: '#FF9800' };
  const toast = document.createElement('div');
  const root = toast.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = [
    ':host { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); z-index:2147483647;',
    'background:' + (colors[type] || colors.info) + '; color:#fff; padding:10px 20px; border-radius:6px;',
    'font:13px/1.4 system-ui,sans-serif; box-shadow:0 4px 12px rgba(0,0,0,0.3);',
    'opacity:0; transition:opacity 0.3s ease; pointer-events:none; max-width:80vw; }',
    ':host(.show) { opacity:1; }'
  ].join('');
  const span = document.createElement('span');
  span.textContent = message;
  root.appendChild(style);
  root.appendChild(span);
  document.body.appendChild(toast);
  requestAnimationFrame(function () { toast.classList.add('show'); });
  setTimeout(function () {
    toast.classList.remove('show');
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
  }, duration);
  return toast;
}

/* ─── Status Bar ─── */

export function createStatusBar(opts) {
  opts = opts || {};
  const accent = opts.accentColor || '#2196F3';
  const container = createShadowContainer({
    styles: [
      ':host { position:fixed; bottom:0; right:0; z-index:2147483646;',
      'background:#1e1e1e; color:#e0e0e0; font:12px system-ui,sans-serif;',
      'padding:8px 14px; border-radius:8px 0 0 0; min-width:200px; max-width:360px;',
      'border-top:3px solid ' + accent + '; border-left:3px solid ' + accent + '; }',
      '.text { margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
      '.bar { height:4px; background:#333; border-radius:2px; overflow:hidden; }',
      '.fill { height:100%; width:0%; background:' + accent + '; transition:width 0.3s ease; }'
    ].join('')
  });
  const textEl = document.createElement('div');
  textEl.className = 'text';
  const fillEl = document.createElement('div');
  fillEl.className = 'fill';
  const barEl = document.createElement('div');
  barEl.className = 'bar';
  barEl.appendChild(fillEl);
  container.root.appendChild(textEl);
  container.root.appendChild(barEl);
  return {
    host: container.host,
    root: container.root,
    setText: function (msg) { textEl.textContent = msg; },
    setProgress: function (pct) { fillEl.style.width = Math.min(100, Math.max(0, pct)) + '%'; },
    remove: function () { if (container.host.parentNode) container.host.parentNode.removeChild(container.host); }
  };
}
