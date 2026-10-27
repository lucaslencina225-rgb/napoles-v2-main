// Keep keyboard focus and caret when a component refreshes its search results.
export function refreshWithFocus(component) {
  const active = document.activeElement;
  const id = active?.id;
  const value = active?.value;
  const start = active?.selectionStart;
  const end = active?.selectionEnd;
  component.renderUI();
  component.attachEvents();
  const replacement = id && component.container.querySelector(`#${id}`);
  if (replacement) {
    if (value !== undefined) replacement.value = value;
    replacement.focus({ preventScroll: true });
    if (start != null) replacement.setSelectionRange(start, end);
  }
}

export function searchText(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

function cellValue(cell) {
  if (!cell) return '';
  if (cell.dataset.sortValue !== undefined) return cell.dataset.sortValue;
  const text = cell.textContent.trim();
  // Currency and numeric columns use Argentine decimal/group separators.
  if (/^\$?\s*-?[\d.,]+(?:\s*%)?$/.test(text)) {
    return Number(text.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.'));
  }
  return text;
}

export function sortableTables(component, scope = '') {
  component._tableSort ??= {};
  component.container.querySelectorAll('table').forEach((table, index) => {
    const key = `${scope}:${index}`;
    const headers = [...(table.tHead?.rows[0]?.cells || [])];
    const apply = (column, direction) => {
      const body = table.tBodies[0];
      if (!body || [...body.rows].some(row => row.cells.length !== headers.length)) return;
      [...body.rows].map((row, order) => ({ row, order, value: cellValue(row.cells[column]) }))
        .sort((a, b) => {
          const cmp = typeof a.value === 'number' && typeof b.value === 'number'
            ? a.value - b.value
            : String(a.value).localeCompare(String(b.value), 'es', { numeric: true, sensitivity: 'base' });
          return cmp * direction || a.order - b.order;
        }).forEach(({ row }) => body.appendChild(row));
      headers.forEach((header, i) => {
        header.setAttribute('aria-sort', i === column ? (direction === 1 ? 'ascending' : 'descending') : 'none');
        const icon = header.querySelector('[data-sort-icon]');
        if (icon) icon.textContent = i === column ? (direction === 1 ? ' ↑' : ' ↓') : ' ↕';
      });
    };
    headers.forEach((header, column) => {
      if (header.dataset.sortBound || /acciones|^pdf$/i.test(header.textContent)) return;
      header.dataset.sortBound = 'true';
      const label = header.textContent.trim();
      const button = document.createElement('button');
      button.type = 'button';
      button.style.cssText = 'color:inherit;font:inherit;cursor:pointer;background:transparent;border:0;padding:0;white-space:nowrap;';
      button.textContent = label;
      const icon = document.createElement('span');
      icon.dataset.sortIcon = '';
      icon.textContent = ' ↕';
      icon.setAttribute('aria-hidden', 'true');
      button.appendChild(icon);
      button.setAttribute('aria-label', `Ordenar por ${label}`);
      header.replaceChildren(button);
      button.addEventListener('click', () => {
        const previous = component._tableSort[key];
        const direction = previous?.column === column ? -previous.direction : 1;
        component._tableSort[key] = { column, direction };
        if (component.sortTable) component.sortTable(index, column, direction);
        else apply(column, direction);
      });
    });
    const sort = component._tableSort[key];
    if (sort) apply(sort.column, sort.direction);
  });
}
