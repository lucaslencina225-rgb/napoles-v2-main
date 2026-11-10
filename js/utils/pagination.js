/**
 * Utilidad de paginación reutilizable para todas las pestañas.
 * 
 * Uso:
 *   import { paginate, paginationHTML, attachPaginationEvents } from '../utils/pagination.js';
 *   
 *   // En state: { pagina: 1, por_pagina: 20 }
 *   // En renderUI:
 *   const { items, info } = paginate(allRows, state.pagina, state.por_pagina);
 *   // Renderizar solo `items`, luego agregar paginationHTML(info)
 *   // En attachEvents: attachPaginationEvents(container, this, callback)
 */

/**
 * Pagina un array y devuelve los items de la página actual + metadata.
 */
export function paginate(allItems, pagina, porPagina) {
  const total = allItems.length;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));
  const pag = Math.min(Math.max(1, pagina), totalPaginas);
  const inicio = (pag - 1) * porPagina;
  const items = allItems.slice(inicio, inicio + porPagina);
  return {
    items,
    info: { pagina: pag, porPagina, total, totalPaginas, inicio, fin: Math.min(inicio + porPagina, total) }
  };
}

/**
 * Genera el HTML del footer de paginación con selector de registros por página.
 */
export function paginationHTML(info) {
  const { pagina: pg, porPagina, total, totalPaginas, inicio, fin } = info;
  if (totalPaginas <= 1 && total <= 10) return '';

  // Rango de botones de página
  let desde = Math.max(1, pg - 2);
  let hasta = Math.min(totalPaginas, pg + 2);
  if (pg <= 3) hasta = Math.min(totalPaginas, 5);
  if (pg >= totalPaginas - 2) desde = Math.max(1, totalPaginas - 4);

  const pages = [];
  for (let i = desde; i <= hasta; i++) {
    pages.push(`<button data-pag="${i}" class="pag-btn px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
      i === pg
        ? 'bg-blue-600 text-white shadow-sm'
        : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-gray-700'
    }">${i}</button>`);
  }

  const opt = (v) => `<option value="${v}" ${porPagina === v ? 'selected' : ''}>${v}</option>`;
  const navBtn = (p, icon, disabled) => `<button data-pag="${p}" class="pag-btn px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition ${disabled ? 'opacity-40 pointer-events-none' : ''}"><i class="fas ${icon}"></i></button>`;

  return `
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/40 border-t border-gray-200 dark:border-gray-700">
      <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <span><strong class="text-gray-900 dark:text-white">${inicio + 1}–${fin}</strong> de <strong class="text-gray-900 dark:text-white">${total}</strong></span>
        <span class="text-gray-300 dark:text-gray-600">|</span>
        <span>Por página:</span>
        <select data-pagination-select class="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-semibold">
          ${opt(10)}${opt(20)}${opt(50)}
        </select>
      </div>
      <div class="flex items-center gap-1">
        ${navBtn(1, 'fa-angles-left', pg === 1)}
        ${navBtn(pg - 1, 'fa-angle-left', pg === 1)}
        ${pages.join('')}
        ${navBtn(pg + 1, 'fa-angle-right', pg === totalPaginas)}
        ${navBtn(totalPaginas, 'fa-angles-right', pg === totalPaginas)}
      </div>
    </div>`;
}

/**
 * Attacha los eventos de paginación dentro del container dado.
 * @param {HTMLElement} container 
 * @param {Object} state - objeto con .pagina y .por_pagina
 * @param {Function} rerender - función a llamar al cambiar de página
 */
export function attachPaginationEvents(container, state, rerender) {
  container.querySelectorAll('.pag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.pag, 10);
      if (!isNaN(p) && p >= 1) {
        state.pagina = p;
        rerender();
      }
    });
  });
  const sel = container.querySelector('[data-pagination-select]');
  if (sel) {
    sel.addEventListener('change', () => {
      state.por_pagina = parseInt(sel.value, 10);
      state.pagina = 1;
      rerender();
    });
  }
}

