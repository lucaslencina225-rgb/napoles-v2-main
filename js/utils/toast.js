// ─── Toast / Notification System ────────────────────────────────────────────
// Usage:
//   import toast from "../utils/toast.js";
//   toast.success("Venta procesada correctamente");
//   toast.error("Error al guardar");
//   toast.warning("Verifica los datos");
//   toast.info("Caja abierta");
//   const ok = await toast.confirm("¿Confirmar cierre de caja?", "Verificación");

const ICONS = {
  success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  error:   '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
  info:    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
};

const STYLES = {
  success: { bg: '#052e16', border: '#16a34a', iconBg: '#14532d', iconColor: '#86efac', text: '#dcfce7' },
  error:   { bg: '#450a0a', border: '#dc2626', iconBg: '#7f1d1d', iconColor: '#fca5a5', text: '#fee2e2' },
  warning: { bg: '#431407', border: '#ea580c', iconBg: '#431407', iconColor: '#fdba74', text: '#ffedd5' },
  info:    { bg: '#0c1a2e', border: '#3b82f6', iconBg: '#1e3a5f', iconColor: '#93c5fd', text: '#dbeafe' },
};

let container = null;

function _init() {
  if (container && document.contains(container)) return;
  container = document.createElement('div');
  container.id = 'toastContainer';
  container.style.cssText =
    'position:fixed;top:20px;right:20px;z-index:99999;' +
    'display:flex;flex-direction:column;gap:10px;' +
    'max-width:400px;width:calc(100% - 40px);pointer-events:none;';
  document.body.appendChild(container);
}

function show(message, type = 'info', duration = 4000) {
  _init();
  const c = STYLES[type] || STYLES.info;
  const el = document.createElement('div');
  el.style.cssText =
    `background:${c.bg};` +
    `border:1px solid ${c.border};` +
    `border-left:4px solid ${c.border};` +
    `border-radius:10px;` +
    `padding:12px 14px;` +
    `display:flex;align-items:flex-start;gap:12px;` +
    `box-shadow:0 8px 24px rgba(0,0,0,.45);` +
    `pointer-events:all;` +
    `opacity:0;transform:translateX(24px);` +
    `transition:opacity .22s ease,transform .22s ease;` +
    `cursor:default;`;

  el.innerHTML =
    `<div style="width:28px;height:28px;border-radius:50%;background:${c.iconBg};` +
      `display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${c.iconColor};">${ICONS[type]}</div>` +
    `<div style="flex:1;color:${c.text};font-size:13px;font-family:inherit;line-height:1.45;padding-top:4px;">${message}</div>` +
    `<button style="background:none;border:none;color:${c.iconColor};cursor:pointer;` +
      `padding:0;font-size:18px;line-height:1;opacity:.6;flex-shrink:0;margin-top:2px;" aria-label="Cerrar">&times;</button>`;

  el.querySelector('button').addEventListener('click', () => _dismiss(el, timer));
  container.appendChild(el);

  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = 'translateX(0)';
  });

  const timer = setTimeout(() => _dismiss(el, timer), duration);
  return el;
}

function _dismiss(el, timer) {
  clearTimeout(timer);
  el.style.opacity = '0';
  el.style.transform = 'translateX(24px)';
  setTimeout(() => el.remove(), 240);
}

// ─── In-app confirm dialog ───────────────────────────────────────────────────
function confirm(bodyHTML, title = 'Confirmar', confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:100000;' +
      'display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(3px);';

    const isDark = document.documentElement.classList.contains('dark');
    const cardBg   = isDark ? '#1e293b' : '#ffffff';
    const cardBdr  = isDark ? '#334155' : '#e5e7eb';
    const titleClr = isDark ? '#f1f5f9' : '#1e293b';
    const bodyClr  = isDark ? '#cbd5e1' : '#374151';
    const confirmBg = danger ? '#dc2626' : '#2563eb';
    const cancelBg  = isDark ? '#374151' : '#f3f4f6';
    const cancelClr = isDark ? '#e5e7eb' : '#374151';

    overlay.innerHTML =
      `<div style="background:${cardBg};border:1px solid ${cardBdr};border-radius:14px;` +
        `padding:24px;max-width:460px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.5);">` +
        `<h3 style="color:${titleClr};font-size:16px;font-weight:700;margin:0 0 14px;` +
          `padding-bottom:12px;border-bottom:1px solid ${cardBdr};">${title}</h3>` +
        `<div style="color:${bodyClr};font-size:13px;line-height:1.6;margin-bottom:20px;">${bodyHTML}</div>` +
        `<div style="display:flex;gap:10px;">` +
          `<button id="_toastConfirmYes" style="flex:1;padding:10px 16px;background:${confirmBg};` +
            `color:#fff;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;">${confirmLabel}</button>` +
          `<button id="_toastConfirmNo" style="flex:1;padding:10px 16px;background:${cancelBg};` +
            `color:${cancelClr};border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">${cancelLabel}</button>` +
        `</div>` +
      `</div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('#_toastConfirmYes').onclick = () => { overlay.remove(); resolve(true);  };
    overlay.querySelector('#_toastConfirmNo').onclick  = () => { overlay.remove(); resolve(false); };
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
  });
}

const toast = {
  show,
  success: (msg, d) => show(msg, 'success', d),
  error:   (msg, d) => show(msg, 'error',   d),
  warning: (msg, d) => show(msg, 'warning', d),
  info:    (msg, d) => show(msg, 'info',    d),
  confirm,
};

export default toast;
