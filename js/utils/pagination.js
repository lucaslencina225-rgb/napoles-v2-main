/**
 * Utilidad de paginación reutilizable para tablas y módulos.
 * Incluye estilos inline a prueba de fallos (sin depender de Tailwind externo ni sufrir problemas de caché)
 * y soporte completo de tema claro / oscuro.
 */

/**
 * Pagina un array y devuelve los items de la página actual + metadata.
 * @param {Array} allItems 
 * @param {number} pagina 
 * @param {number} porPagina 
 */
export function paginate(allItems, pagina = 1, porPagina = 10) {
  const total = Array.isArray(allItems) ? allItems.length : 0;
  const numPorPagina = Math.max(1, parseInt(porPagina, 10) || 10);
  const totalPaginas = Math.max(1, Math.ceil(total / numPorPagina));
  const pag = Math.min(Math.max(1, parseInt(pagina, 10) || 1), totalPaginas);
  const inicio = (pag - 1) * numPorPagina;
  const items = Array.isArray(allItems) ? allItems.slice(inicio, inicio + numPorPagina) : [];
  return {
    items,
    info: {
      pagina: pag,
      porPagina: numPorPagina,
      total,
      totalPaginas,
      inicio,
      fin: Math.min(inicio + numPorPagina, total)
    }
  };
}

/**
 * Genera el HTML del footer de paginación con selector de registros por página (10, 20, 50).
 */
export function paginationHTML(info) {
  if (!info) return '';
  const { pagina: pg, porPagina, total, totalPaginas, inicio, fin } = info;
  if (!total || total <= 0) return '';

  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  // Paleta de estilos directa para garantizar 0 superposición
  const bgBar = isDark ? '#1e293b' : '#f8fafc';
  const borderColor = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#cbd5e1' : '#475569';
  const strongColor = isDark ? '#f8fafc' : '#0f172a';
  const btnBg = isDark ? '#334155' : '#ffffff';
  const btnBorder = isDark ? '#475569' : '#d1d5db';
  const btnText = isDark ? '#f1f5f9' : '#1e293b';
  const selectBg = isDark ? '#334155' : '#ffffff';
  const selectBorder = isDark ? '#475569' : '#d1d5db';
  const selectText = isDark ? '#f8fafc' : '#0f172a';

  // Rango de páginas (máximo 5 páginas visibles)
  let desde = Math.max(1, pg - 2);
  let hasta = Math.min(totalPaginas, pg + 2);
  if (pg <= 3) hasta = Math.min(totalPaginas, 5);
  if (pg >= totalPaginas - 2) desde = Math.max(1, totalPaginas - 4);
  desde = Math.max(1, desde);

  const pages = [];
  if (totalPaginas > 1) {
    for (let i = desde; i <= hasta; i++) {
      const isActive = i === pg;
      const bg = isActive ? '#2563eb' : btnBg;
      const border = isActive ? '#1d4ed8' : btnBorder;
      const color = isActive ? '#ffffff' : btnText;
      const shadow = isActive ? 'box-shadow: 0 1px 2px rgba(0,0,0,0.15); font-weight: 700;' : 'font-weight: 600;';
      pages.push(`
        <button type="button" data-pag="${i}" class="pag-btn" style="display:inline-flex; align-items:center; justify-content:center; min-width:32px; height:32px; padding:0 8px; border-radius:6px; font-size:12px; border:1px solid ${border}; background:${bg}; color:${color}; cursor:pointer; user-select:none; ${shadow}">
          ${i}
        </button>
      `);
    }
  }

  const opt = (v) => `<option value="${v}" ${Number(porPagina) === v ? 'selected' : ''}>${v}</option>`;
  
  const navBtn = (p, icon, disabled, title) => {
    const opacity = disabled ? 'opacity: 0.35; cursor: not-allowed; pointer-events: none;' : 'cursor: pointer;';
    const disAttr = disabled ? 'disabled="disabled"' : '';
    return `
      <button type="button" data-pag="${p}" title="${title}" ${disAttr} class="pag-btn" style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; border-radius:6px; font-size:12px; border:1px solid ${btnBorder}; background:${btnBg}; color:${btnText}; user-select:none; ${opacity}">
        <i class="fas ${icon}" style="pointer-events: none;"></i>
      </button>
    `;
  };

  const inicioTexto = total > 0 ? inicio + 1 : 0;

  return `
    <div data-pagination-bar="true" style="display:flex; flex-direction:row; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; background:${bgBar}; border-top:1px solid ${borderColor}; box-sizing:border-box; width:100%;">
      <!-- Lado izquierdo: información y selector -->
      <div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; font-size:12px; color:${textColor};">
        <span>Mostrando <strong style="color:${strongColor};">${inicioTexto}–${fin}</strong> de <strong style="color:${strongColor};">${total}</strong></span>
        <span style="color:${borderColor}; margin:0 2px;">|</span>
        <label style="display:inline-flex; align-items:center; gap:6px; font-size:12px; color:${textColor}; cursor:pointer;">
          <span>Mostrar:</span>
          <select data-pagination-select class="pag-select" style="padding:4px 8px; font-size:12px; font-weight:700; border-radius:6px; border:1px solid ${selectBorder}; background:${selectBg}; color:${selectText}; cursor:pointer; outline:none;">
            ${opt(10)}${opt(20)}${opt(50)}
          </select>
          <span>por pág.</span>
        </label>
      </div>

      <!-- Lado derecho: botones de navegación -->
      ${totalPaginas > 1 ? `
        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px;">
          ${navBtn(1, 'fa-angles-left', pg === 1, 'Primera página')}
          ${navBtn(pg - 1, 'fa-angle-left', pg === 1, 'Página anterior')}
          ${pages.join('')}
          ${navBtn(pg + 1, 'fa-angle-right', pg === totalPaginas, 'Página siguiente')}
          ${navBtn(totalPaginas, 'fa-angles-right', pg === totalPaginas, 'Última página')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Attacha los eventos de paginación dentro del container dado.
 * @param {HTMLElement} container 
 * @param {Object} state - objeto que contiene las propiedades de paginación
 * @param {Function} rerender - callback para refrescar la UI
 * @param {string} pageKey - nombre de la propiedad de página en state (por defecto 'pagina')
 */
export function attachPaginationEvents(container, state, rerender, pageKey = 'pagina') {
  if (!container) return;
  
  // Buscar botones de paginación
  container.querySelectorAll('.pag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.disabled || btn.hasAttribute('disabled')) return;
      const p = parseInt(btn.dataset.pag, 10);
      if (!isNaN(p) && p >= 1 && p !== state[pageKey]) {
        state[pageKey] = p;
        rerender();
      }
    });
  });

  // Selector de cantidad por página
  container.querySelectorAll('[data-pagination-select]').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const nuevoPorPagina = parseInt(e.target.value, 10);
      if (!isNaN(nuevoPorPagina) && nuevoPorPagina > 0) {
        state.por_pagina = nuevoPorPagina;
        state[pageKey] = 1;
        rerender();
      }
    });
  });
}
