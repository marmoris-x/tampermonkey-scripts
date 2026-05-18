const PREFIX = '[RedditUnlocker]';
let enabled = false;

export function enable() { enabled = true; }
export function disable() { enabled = false; }

export function log(...args) {
  if (enabled) console.log(PREFIX, ...args);
}

/**
 * Logs a phase result with colored output.
 * @param {string} phase - Phase name/description
 * @param {string} action - What happened (e.g. 'removed', 'found', 'skipped')
 * @param {string|number} [detail] - Additional info (count, selector, etc.)
 */
export function logPhase(phase, action, detail) {
  if (!enabled) return;
  const color = (detail && detail !== '0' && detail !== '') ? '#22c55e' : '#9ca3af';
  console.log(
    `${PREFIX} %c[${phase}]`,
    `color:${color};font-weight:bold`,
    action,
    detail || ''
  );
}

/**
 * Logs all elements found AFTER unblurCallback has completed.
 */
export function scanRemaining() {
  if (!enabled) return;

  const suspects = [];

  document.querySelectorAll('*').forEach((el) => {
    if (el.nodeType !== 1) return;
    const tag = el.tagName?.toLowerCase();
    if (['script', 'style', 'slot', 'template'].includes(tag)) return;

    const ariaModal = el.getAttribute('aria-modal');
    const role = el.getAttribute('role');
    const partStr = el.getAttribute('part') || '';
    const cls = typeof el.className === 'string' ? el.className : '';
    const isFixed = el.style?.position === 'fixed';
    const isBlocking = el.hasAttribute?.('blocking');
    const isOpen = el.hasAttribute?.('open');
    const hasOverlay = cls.includes('overlay') || partStr.includes('overlay') || tag.includes('overlay');
    const hasDialog = cls.includes('dialog') || partStr.includes('dialog') || role === 'dialog' || tag.includes('dialog');
    const isVisible = el.offsetParent !== null;

    if ((ariaModal === 'true' || role === 'dialog' || isBlocking || isOpen || isFixed) &&
        (isVisible || hasOverlay || hasDialog)) {
      const sr = el.shadowRoot;
      let shadowChildren = [];
      if (sr) {
        sr.querySelectorAll('*').forEach((c) => {
          const ct = c.tagName?.toLowerCase();
          if (ct && ct.includes('-') && !shadowChildren.includes(ct)) shadowChildren.push(ct);
        });
      }

      suspects.push({
        tag,
        id: el.id || '',
        class: cls.substring(0, 300),
        'aria-modal': ariaModal,
        role,
        part: partStr,
        blocking: isBlocking,
        open: isOpen,
        visible: isVisible,
        fixed: isFixed,
        hasShadow: !!sr,
        shadowChildren,
        text: (el.textContent || '').substring(0, 300).replace(/\s+/g, ' ').trim(),
        parentTag: el.parentElement?.tagName?.toLowerCase() || ''
      });
    }
  });

  if (suspects.length > 0) {
    console.log(
      `${PREFIX} %c[REMAINING] %c${suspects.length} potenziell blockierend:`,
      'color:#f87171;font-weight:bold',
      'color:#f87171'
    );
    suspects.forEach((s, i) => {
      console.log(
        `${PREFIX}   #${i+1}`,
        JSON.stringify(s, ['tag','id','class','aria-modal','role','part','blocking','visible','fixed','open','parentTag','shadowChildren','text'], 2)
      );
    });
  } else {
    console.log(
      `${PREFIX} %c[REMAINING] %ckeine blockierenden Elemente gefunden`,
      'color:#22c55e;font-weight:bold',
      'color:#22c55e'
    );
  }

  return suspects;
}
