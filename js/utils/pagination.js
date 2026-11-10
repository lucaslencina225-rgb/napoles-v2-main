/**
 * Utilidad de paginación reutilizable para tablas y módulos.
 */

/**
 * Pagina un array y devuelve los items de la página actual + metadata.
 */
export function paginate(allItems, pagina = 1, porPagina = 20) {
  const total = Array.isArray(allItems) ? allItems.length : 0;
  const numPorPagina = Math.max(1, parseInt(porPagina, 10) || 20);
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

  // Rango de botones de página (máximo 5 botones numéricos)
  let desde = Math.max(1, pg - 2);
  let hasta = Math.min(totalPaginas, pg + 2);
  if (pg <= 3) hasta = Math.min(totalPaginas, 5);
  if (pg >= totalPaginas - 2) desde = Math.max(1, totalPaginas - 4);
  desde = Math.max(1, desde);

  const pages = [];
  for (let i = desde; i <= hasta; i++) {
    const isActive = i === pg;
    pages.push(`
      <button type="button" data-pag="${i}" class="pag-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
        isActive
          ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700'
      }">${i}</button>
    `);
  }

  const opt = (v) => `<option value="${v}" ${Number(porPagina) === v ? 'selected' : ''}>${v}</option>`;
  const navBtn = (p, icon, disabled, title) => `
    <button type="button" data-pag="${p}" title="${title}" class="pag-btn px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition ${
      disabled ? 'opacity-35 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
    }"><i class="fas ${icon}"></i></button>
  `;

  const inicioTexto = total > 0 ? inicio + 1 : 0;

  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-800/90 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
        <span>Mostrando <strong class="text-gray-900 dark:text-white font-bold">${inicioTexto}–${fin}</strong> de <strong class="text-gray-900 dark:text-white font-bold">${total}</strong></span>
        <span class="text-gray-300 dark:text-gray-600">|</span>
        <label class="flex items-center gap-1.5 font-medium">
          <span>Mostrar:</span>
          <select data-pagination-select class="text-xs px-2.5 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer">
            ${opt(10)}${opt(20)}${opt(50)}
          </select>
          <span>por pág.</span>
        </label>
      </div>
      <div class="flex items-center gap-1">
        ${navBtn(1, 'fa-angles-left', pg === 1, 'Primera página')}
        ${navBtn(pg - 1, 'fa-angle-left', pg === 1, 'Página anterior')}
        ${pages.join('')}
        ${navBtn(pg + 1, 'fa-angle-right', pg === totalPaginas, 'Página siguiente')}
        ${navBtn(totalPaginas, 'fa-angles-right', pg === totalPaginas, 'Última página')}
      </div>
    </div>`;
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
  container.querySelectorAll('.pag-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const p = parseInt(btn.dataset.pag, 10);
      if (!isNaN(p) && p >= 1) {
        state[pageKey] = p;
        rerender();
      }
    });
  });
  const sel = container.querySelector('[data-pagination-select]');
  if (sel) {
    sel.addEventListener('change', () => {
      state.por_pagina = parseInt(sel.value, 10);
      state[pageKey] = 1;
      rerender();
    });
  }
}
