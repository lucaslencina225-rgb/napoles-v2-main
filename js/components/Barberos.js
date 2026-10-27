import { sortableTables, refreshWithFocus, searchText } from '../utils/table-utils.js';
import { api } from '../api-client.js';
import { fmtMoney } from '../utils/print-utils.js';
import toast from '../utils/toast.js';

export default {
  state: {
    barberos: [],
    busqueda: '',
    barbero_editando: null,
    detalle: null,
    filtro_fecha_inicio: '',
    filtro_fecha_fin: ''
  },

  async render(container) {
    this.container = container;
    await this.cargarBarberos();
    this.renderUI();
    this.attachEvents();
  },

  esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  parseUTCDateTime(value) {
    if (!value) return null;
    const normalized = String(value).trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(normalized)) {
      return new Date(normalized + 'Z');
    }
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      return new Date();
    }
    return parsed;
  },

  formatFechaHora(value) {
    const fecha = this.parseUTCDateTime(value);
    if (!fecha) return '';
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(fecha);
  },

  formatFecha(value) {
    const fecha = this.parseUTCDateTime(value);
    if (!fecha) return '';
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(fecha);
  },

  fmtMoney(value) {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(value || 0);
  },

  async cargarBarberos() {
    try {
      this.state.barberos = await api.getAll('/barberos');
    } catch (e) {
      console.error('Error cargando barberos', e);
      this.state.barberos = [];
    }
  },

  renderUI() {
    const rows = this.state.barberos
      .filter(row => searchText(`${row.nombre} ${row.apellido || ''} ${row.telefono || ''} ${row.email || ''} ${row.codigo_barbero || row.id}`).includes(searchText(this.state.busqueda)))
      .map(b => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 font-mono text-gray-900 dark:text-gray-100">${this.esc(b.codigo_barbero)}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 font-semibold text-gray-900 dark:text-gray-100">${this.esc(b.nombre)} ${this.esc(b.apellido)}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">${this.esc(b.telefono||'')}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">${this.esc(b.email||'')}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700" data-sort-value="${this.esc(b.creado_en || '')}">${this.formatFechaHora(b.creado_en)}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-right">
            <button class="btn-ver text-xs px-2 py-1 bg-blue-500 text-white rounded" data-id="${b.id}">Ver</button>
            <button class="btn-editar text-xs px-2 py-1 bg-indigo-500 text-white rounded ml-2" data-id="${b.id}">Editar</button>
            <button class="btn-eliminar text-xs px-2 py-1 bg-red-500 text-white rounded ml-2" data-id="${b.id}">Eliminar</button>
          </td>
        </tr>
      `).join('');

    this.container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Barberos</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Gestión de barberos y su historial de ventas</p>
          </div>
          <div class="flex flex-col lg:flex-row lg:items-end gap-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input id="barberosBuscar" placeholder="Buscar por nombre, teléfono o código" class="px-3 py-2 rounded border" value="${this.esc(this.state.busqueda)}" />
              <div class="flex gap-2">
                <input id="fechaInicio" type="date" class="w-full px-3 py-2 rounded border" value="${this.esc(this.state.filtro_fecha_inicio)}" />
                <input id="fechaFin" type="date" class="w-full px-3 py-2 rounded border" value="${this.esc(this.state.filtro_fecha_fin)}" />
              </div>
            </div>
            <div class="flex gap-2">
              <button id="btnFiltrarFechas" class="px-3 py-2 bg-blue-600 text-white rounded">Filtrar fechas</button>
              <button id="btnNuevoBarbero" class="px-3 py-2 bg-green-600 text-white rounded">Nuevo barbero</button>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left bg-gray-50 dark:bg-gray-700">
                <th class="p-2 text-gray-700 dark:text-gray-200">Código</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Nombre</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Teléfono</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Email</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Agregado</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td class="p-4 text-gray-500 dark:text-gray-400" colspan="6">No hay barberos</td></tr>'}
            </tbody>
          </table>
        </div>

        <div id="modalBarbero" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4" style="backdrop-filter: blur(2px);">
          <div class="bg-white dark:bg-gray-900 rounded-lg w-full max-w-sm max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 z-10">
              <h2 id="modalBarberoTitle" class="text-lg font-bold text-gray-900 dark:text-white">Nuevo barbero</h2>
            </div>
            
            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto px-4 py-3">
              <div class="space-y-2">
                <!-- Campos Requeridos -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Nombre *</label>
                    <input id="barNombre" placeholder="Nombre" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Apellido *</label>
                    <input id="barApellido" placeholder="Apellido" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Teléfono *</label>
                  <input id="barTelefono" placeholder="Teléfono" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                <hr class="my-2 border-gray-200 dark:border-gray-700" />

                <!-- Campos Opcionales -->
                <div>
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Email</label>
                  <input id="barEmail" type="email" placeholder="Email" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Tipo Doc.</label>
                    <select id="barDocumentoTipo" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <option value="DNI">DNI</option>
                      <option value="CUIT">CUIT</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Nº Documento</label>
                    <input id="barDocumentoNumero" placeholder="Número" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>

                <div id="codigoInfo" class="p-3 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                  <p class="text-xs text-blue-700 dark:text-blue-300 mb-1"><strong>Código de barbero (Auto):</strong></p>
                  <p id="barCodigoDisplay" class="text-sm font-mono font-bold text-blue-900 dark:text-blue-100">Se genera automáticamente al crear</p>
                </div>
              </div>
            </div>

            <!-- Footer con Botones Sticky -->
            <div class="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 flex gap-2">
              <button id="btnGuardarBarbero" class="flex-1 px-3 py-2 text-sm font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition">Guardar</button>
              <button id="btnCerrarModalBarbero" class="flex-1 px-3 py-2 text-sm font-semibold bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-700 transition">Cancelar</button>
            </div>
          </div>
        </div>

        <div id="modalDetalleBarbero" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-900 rounded-lg w-full max-w-4xl p-6 overflow-y-auto max-h-[85vh]">
            <button id="btnCerrarDetalle" class="float-right text-gray-600 dark:text-gray-400">Cerrar</button>
            <h2 class="text-2xl font-bold dark:text-white" id="detalleNombre">Detalle barbero</h2>
            <div id="detalleBody" class="mt-4"></div>
          </div>
        </div>
      </div>
    `;
  },

  setupModalClose(modalId, closeButtonId = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    // Cerrar al presionar ESC
    const handleEsc = (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    };

    // Cerrar al click fuera del modal
    const handleClickOutside = (e) => {
      if (e.target === modal && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    };

    this._modalEscHandlers ??= {};
    document.removeEventListener('keydown', this._modalEscHandlers[modalId]);
    this._modalEscHandlers[modalId] = handleEsc;
    document.addEventListener('keydown', handleEsc);
    modal.removeEventListener('click', handleClickOutside);
    modal.addEventListener('click', handleClickOutside);

    if (closeButtonId) {
      document.getElementById(closeButtonId)?.addEventListener('click', () => modal.classList.add('hidden'));
    }
  },

  attachEvents() {
    sortableTables(this);
    document.getElementById('barberosBuscar')?.addEventListener('input', (e) => {
      this.state.busqueda = e.target.value;
      if (!e.isComposing) refreshWithFocus(this);
    });

    document.getElementById('btnNuevoBarbero')?.addEventListener('click', () => this.abrirModalNuevo());
    document.getElementById('btnFiltrarFechas')?.addEventListener('click', () => this.aplicarFiltroFechas());

    document.querySelectorAll('.btn-editar').forEach(btn => btn.addEventListener('click', (e) => this.editarBarbero(e.currentTarget.dataset.id)));
    document.querySelectorAll('.btn-ver').forEach(btn => btn.addEventListener('click', (e) => this.verDetalle(e.currentTarget.dataset.id)));
    document.querySelectorAll('.btn-eliminar').forEach(btn => btn.addEventListener('click', (e) => this.eliminarBarbero(e.currentTarget.dataset.id)));

    document.getElementById('btnCerrarModalBarbero')?.addEventListener('click', () => this.cerrarModalNuevo());
    document.getElementById('btnGuardarBarbero')?.addEventListener('click', () => this.guardarBarbero());
    document.getElementById('btnCerrarDetalle')?.addEventListener('click', () => document.getElementById('modalDetalleBarbero')?.classList.add('hidden'));

    // Configurar cierre de modales con ESC y click fuera
    this.setupModalClose('modalBarbero', 'btnCerrarModalBarbero');
    this.setupModalClose('modalDetalleBarbero', 'btnCerrarDetalle');
  },

  abrirModalNuevo() {
    this.state.barbero_editando = null;
    document.getElementById('modalBarbero')?.classList.remove('hidden');
    document.getElementById('modalBarberoTitle').textContent = 'Nuevo barbero';
    document.getElementById('barNombre').value = '';
    document.getElementById('barApellido').value = '';
    document.getElementById('barTelefono').value = '';
    document.getElementById('barEmail').value = '';
    document.getElementById('barDocumentoTipo').value = 'DNI';
    document.getElementById('barDocumentoNumero').value = '';
    document.getElementById('barCodigoDisplay').textContent = 'Se genera automáticamente al crear';
  },

  cerrarModalNuevo() {
    document.getElementById('modalBarbero')?.classList.add('hidden');
  },

  async editarBarbero(id) {
    const bar = this.state.barberos.find(b => String(b.id) === String(id));
    if (!bar) return;
    this.state.barbero_editando = bar;
    document.getElementById('modalBarbero')?.classList.remove('hidden');
    document.getElementById('modalBarberoTitle').textContent = 'Editar barbero';
    document.getElementById('barNombre').value = bar.nombre || '';
    document.getElementById('barApellido').value = bar.apellido || '';
    document.getElementById('barTelefono').value = bar.telefono || '';
    document.getElementById('barEmail').value = bar.email || '';
    document.getElementById('barDocumentoTipo').value = bar.documento_tipo || 'DNI';
    document.getElementById('barDocumentoNumero').value = bar.documento_numero || '';
    document.getElementById('barCodigoDisplay').textContent = bar.codigo_barbero || '';
  },

  async eliminarBarbero(id) {
    if (!confirm('¿Eliminar este barbero? Esta acción marcará el barbero como inactivo.')) return;
    try {
      const res = await fetch(`/api/barberos/${id}`, {
        method: 'DELETE',
        headers: api.getHeaders()
      });
      
      if (!res.ok) {
        let errorMsg = `Error HTTP ${res.status}`;
        try {
          const text = await res.text();
          const cleanedText = text.replace(/^\uFEFF/, '');
          const err = JSON.parse(cleanedText);
          errorMsg = err.error || errorMsg;
        } catch (e) {
          errorMsg = res.statusText || errorMsg;
        }
        throw new Error(errorMsg);
      }
      
      await this.cargarBarberos();
      this.renderUI();
      this.attachEvents();
      toast.success('Barbero eliminado correctamente');
    } catch (e) {
      toast.error('Error al eliminar barbero: ' + e.message);
      console.error('Error detalles:', e);
    }
  },

  async guardarBarbero() {
    const nombre = document.getElementById('barNombre').value.trim();
    const apellido = document.getElementById('barApellido').value.trim();
    const telefono = document.getElementById('barTelefono').value.trim();
    const email = document.getElementById('barEmail').value.trim();
    const documento_tipo = document.getElementById('barDocumentoTipo').value;
    const documento_numero = document.getElementById('barDocumentoNumero').value.trim();

    if (!nombre || !apellido || !telefono) {
      toast.warning('Nombre, apellido y teléfono son requeridos');
      return;
    }

    const body = {
      nombre,
      apellido,
      telefono,
      email,
      documento_tipo,
      documento_numero
    };

    try {
      let res;
      if (this.state.barbero_editando) {
        res = await fetch(`/api/barberos/${this.state.barbero_editando.id}`, {
          method: 'PUT',
          headers: api.getHeaders(),
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/barberos', {
          method: 'POST',
          headers: api.getHeaders(),
          body: JSON.stringify(body)
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error guardando barbero');
      }

      await this.cargarBarberos();
      this.cerrarModalNuevo();
      this.renderUI();
      this.attachEvents();
      toast.success('Barbero guardado correctamente');
    } catch (e) {
      toast.error('Error al guardar: ' + e.message);
    }
  },

  async verDetalle(id) {
    try {
      const params = [];
      if (this.state.filtro_fecha_inicio) params.push(`fecha_inicio=${encodeURIComponent(this.state.filtro_fecha_inicio)}`);
      if (this.state.filtro_fecha_fin) params.push(`fecha_fin=${encodeURIComponent(this.state.filtro_fecha_fin)}`);
      const query = params.length ? `?${params.join('&')}` : '';
      const res = await fetch(`/api/barberos/${id}${query}`, { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Barbero no encontrado');
      
      let data;
      try {
        const text = await res.text();
        const cleanedText = text.replace(/^\uFEFF/, '');
        data = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Error al parsear JSON:', parseError);
        toast.error('Error al procesar datos del barbero. Intenta nuevamente.');
        return;
      }
      
      this.state.detalle = data;

      const barbero = data.barbero;
      const ventas = data.ventas || [];
      const stats = data.stats || {};
      const statsGenerales = data.statsGenerales || {};

      // Totales para el rango de fechas seleccionado
      const totalVentasRango = stats.total_ventas || 0;
      const totalMontoRango = stats.total_acumulado || 0;
      // Totales acumulados de todos los tiempos
      const totalAcumulado = statsGenerales.total_acumulado_gral || 0;

      const body = document.getElementById('detalleBody');
      if (!body) return;

      const isDark = document.documentElement.classList.contains('dark');
      const s = {
        card: isDark
          ? 'background:#1e293b; border-radius:8px; padding:12px;'
          : 'background:#f8fafc; border-radius:8px; padding:12px;',
        cardBlue: isDark
          ? 'background:#1e3a5f; border:1px solid #2563eb; border-radius:8px; padding:12px;'
          : 'background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px;',
        cardGreen: isDark
          ? 'background:#14532d; border:1px solid #16a34a; border-radius:8px; padding:12px;'
          : 'background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:12px;',
        cardAmber: isDark
          ? 'background:#451a03; border:1px solid #d97706; border-radius:8px; padding:12px;'
          : 'background:#fffbeb; border:1px solid #fde68a; border-radius:8px; padding:12px;',
        labelBlue: isDark ? 'color:#93c5fd; font-size:11px; font-weight:600;' : 'color:#1d4ed8; font-size:11px; font-weight:600;',
        valueBlue: isDark ? 'color:#bfdbfe; font-size:22px; font-weight:700;' : 'color:#2563eb; font-size:22px; font-weight:700;',
        labelGreen: isDark ? 'color:#86efac; font-size:11px; font-weight:600;' : 'color:#15803d; font-size:11px; font-weight:600;',
        valueGreen: isDark ? 'color:#bbf7d0; font-size:18px; font-weight:700;' : 'color:#16a34a; font-size:18px; font-weight:700;',
        labelAmber: isDark ? 'color:#fcd34d; font-size:11px; font-weight:600;' : 'color:#92400e; font-size:11px; font-weight:600;',
        valueAmber: isDark ? 'color:#fde68a; font-size:18px; font-weight:700;' : 'color:#d97706; font-size:18px; font-weight:700;',
        text: isDark ? 'color:#f1f5f9;' : 'color:#1e293b;',
        textMuted: isDark ? 'color:#94a3b8; font-size:12px;' : 'color:#6b7280; font-size:12px;',
        infoPanel: isDark
          ? 'background:#1e293b; border:1px solid #334155; border-radius:8px; padding:16px;'
          : 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px;',
        thStyle: isDark
          ? 'padding:8px 10px; background:#374151; color:#e5e7eb; font-weight:600; text-align:left;'
          : 'padding:8px 10px; background:#f3f4f6; color:#374151; font-weight:600; text-align:left;',
        tdStyle: isDark
          ? 'padding:7px 10px; border-top:1px solid #374151; color:#f1f5f9;'
          : 'padding:7px 10px; border-top:1px solid #e5e7eb; color:#1e293b;',
        tdRight: isDark
          ? 'padding:7px 10px; border-top:1px solid #374151; color:#f1f5f9; text-align:right; font-weight:600;'
          : 'padding:7px 10px; border-top:1px solid #e5e7eb; color:#1e293b; text-align:right; font-weight:600;',
        tableWrapper: isDark
          ? 'border:1px solid #374151; border-radius:8px; overflow:hidden;'
          : 'border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;',
        label: isDark ? 'color:#94a3b8; font-size:12px; margin-top:10px;' : 'color:#6b7280; font-size:12px; margin-top:10px;',
        value: isDark ? 'color:#f1f5f9; font-weight:600;' : 'color:#1e293b; font-weight:600;',
        input: isDark
          ? 'width:100%; padding:6px 10px; border-radius:6px; border:1px solid #4b5563; background:#374151; color:#f1f5f9; font-size:13px;'
          : 'width:100%; padding:6px 10px; border-radius:6px; border:1px solid #d1d5db; background:#fff; color:#111827; font-size:13px;',
        btnApply: 'padding:8px 14px; background:#2563eb; color:#fff; border-radius:6px; font-size:13px; cursor:pointer; white-space:nowrap;',
        btnPDF: 'padding:8px 14px; background:#7c3aed; color:#fff; border-radius:6px; font-size:13px; cursor:pointer; display:flex; align-items:center; gap:6px;',
      };

      const ventasHtml = ventas.map(v => {
        const items = v.items || [];
        const itemsRows = items.map(it => `
          <tr>
            <td style="${s.tdStyle}">${this.esc(it.producto_nombre)}</td>
            <td style="${s.tdStyle} font-family:monospace; font-size:12px;">${this.esc(it.sku)}</td>
            <td style="${s.tdStyle} text-align:right;">${it.cantidad}</td>
            <td style="${s.tdRight}">${this.fmtMoney(it.precio_unitario)}</td>
          </tr>
        `).join('');

        const clienteNombre = v.cliente_nombre ? `${v.cliente_nombre} ${v.cliente_apellido}` : 'Sin cliente';

        return `
          <tr>
            <td style="${s.tdStyle}">${this.esc(v.numero_ticket)}</td>
            <td style="${s.tdStyle}">${this.formatFechaHora(v.fecha_venta)}</td>
            <td style="${s.tdStyle}">${this.esc(clienteNombre)}</td>
            <td style="${s.tdStyle}">${this.esc(v.sucursal)}</td>
            <td style="${s.tdRight}">${this.fmtMoney(v.total)}</td>
          </tr>
          <tr>
            <td colspan="5" style="padding:0; border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'};">
              <div style="padding:10px 12px; background:${isDark ? '#111827' : '#f9fafb'};">
                <div style="${s.textMuted} font-weight:600; margin-bottom:6px;">Items de la venta:</div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead><tr>
                      <th style="${s.thStyle} font-size:12px;">Producto</th>
                      <th style="${s.thStyle} font-size:12px;">SKU</th>
                      <th style="${s.thStyle} text-align:right; font-size:12px;">Cantidad</th>
                      <th style="${s.thStyle} text-align:right; font-size:12px;">Precio</th>
                    </tr></thead>
                    <tbody>
                      ${itemsRows || `<tr><td style="${s.tdStyle}" colspan="4">Sin items registrados</td></tr>`}
                    </tbody>
                  </table>
                </div>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      body.innerHTML = `
        <div style="display:flex; justify-content:flex-end; margin-bottom:12px;">
          <button id="btnExportarPDFBarbero" style="${s.btnPDF}">
            <i class="fas fa-file-pdf"></i> Exportar PDF
          </button>
        </div>

        <div style="display:grid; grid-template-columns:1fr 2fr; gap:16px;">
          <!-- Info del barbero -->
          <div style="${s.infoPanel}">
            <div style="${s.label}">Nombre</div>
            <div style="${s.value}">${this.esc(barbero.nombre)} ${this.esc(barbero.apellido)}</div>
            <div style="${s.label}">Código</div>
            <div style="${s.value}; font-family:monospace;">${this.esc(barbero.codigo_barbero)}</div>
            <div style="${s.label}">Teléfono</div>
            <div style="${s.text}">${this.esc(barbero.telefono||'—')}</div>
            <div style="${s.label}">Email</div>
            <div style="${s.text}">${this.esc(barbero.email||'—')}</div>
            <div style="${s.label}">Documento</div>
            <div style="${s.text}">${this.esc(barbero.documento_tipo||'')} ${this.esc(barbero.documento_numero||'—')}</div>
          </div>

          <!-- Estadísticas + historial -->
          <div style="display:flex; flex-direction:column; gap:14px;">
            <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:10px;">
              <div style="${s.cardBlue}">
                <div style="${s.labelBlue}">Ventas del período</div>
                <div style="${s.valueBlue}">${totalVentasRango}</div>
              </div>
              <div style="${s.cardGreen}">
                <div style="${s.labelGreen}">Monto período</div>
                <div style="${s.valueGreen}">${this.fmtMoney(totalMontoRango)}</div>
              </div>
              <div style="${s.cardAmber}">
                <div style="${s.labelAmber}">Total acumulado</div>
                <div style="${s.valueAmber}">${this.fmtMoney(totalAcumulado)}</div>
              </div>
            </div>

            <div>
              <div style="display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:10px; margin-bottom:10px;">
                <div>
                  <div style="${s.text}; font-weight:600;">Historial de ventas</div>
                  <div style="${s.textMuted}">Filtra las ventas por rango de fechas.</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
                  <div>
                    <div style="${s.textMuted}; margin-bottom:3px;">Desde</div>
                    <input id="detalleFechaInicio" type="date" style="${s.input}" value="${this.esc(this.state.filtro_fecha_inicio || data.fecha_inicio || '')}" />
                  </div>
                  <div>
                    <div style="${s.textMuted}; margin-bottom:3px;">Hasta</div>
                    <input id="detalleFechaFin" type="date" style="${s.input}" value="${this.esc(this.state.filtro_fecha_fin || data.fecha_fin || '')}" />
                  </div>
                  <button id="btnAplicarFiltroDetalle" style="${s.btnApply}">Aplicar</button>
                </div>
              </div>
              <div style="overflow-x:auto; ${s.tableWrapper}">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead><tr>
                    <th style="${s.thStyle}">Ticket</th>
                    <th style="${s.thStyle}">Fecha</th>
                    <th style="${s.thStyle}">Cliente</th>
                    <th style="${s.thStyle}">Sucursal</th>
                    <th style="${s.thStyle} text-align:right;">Total</th>
                  </tr></thead>
                  <tbody>
                    ${ventasHtml || `<tr><td style="${s.tdStyle}" colspan="5">Sin ventas registradas</td></tr>`}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('detalleNombre').textContent = `${barbero.nombre} ${barbero.apellido} (${barbero.codigo_barbero})`;
      document.getElementById('modalDetalleBarbero')?.classList.remove('hidden');
      document.getElementById('btnAplicarFiltroDetalle')?.addEventListener('click', () => this.aplicarFiltroDetalle());
      document.getElementById('btnExportarPDFBarbero')?.addEventListener('click', () => this.exportarPDFBarbero(data));
    } catch (e) {
      toast.error('Error al cargar detalle: ' + e.message);
    }
  },

  exportarPDFBarbero(data) {
    const barbero = data.barbero;
    const ventas = data.ventas || [];
    const stats = data.stats || {};
    const statsGenerales = data.statsGenerales || {};
    const fechaInicio = document.getElementById('detalleFechaInicio')?.value || '';
    const fechaFin = document.getElementById('detalleFechaFin')?.value || '';

    const fmtFecha = (v) => this.formatFecha(v);
    const fmtMon = (v) => this.fmtMoney(v);

    const TH  = 'padding:8px 10px;text-align:left;background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;letter-spacing:0.4px;';
    const THR = 'padding:8px 10px;text-align:right;background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;letter-spacing:0.4px;';
    const td  = 'padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;';
    const tdR = 'padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;text-align:right;';

    const ventasRows = ventas.map((v, i) => {
      const items = v.items || [];
      const itemsStr = items.map(it => `${this.esc(it.producto_nombre)} x${it.cantidad} (${fmtMon(it.precio_unitario)})`).join(', ');
      const cliente = v.cliente_nombre ? `${v.cliente_nombre} ${v.cliente_apellido||''}`.trim() : 'Sin cliente';
      const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
      return `
        <tr style="background:${bg};">
          <td style="${td}font-family:monospace;font-size:10px;color:#64748b;">${this.esc(v.numero_ticket)}</td>
          <td style="${td}">${this.formatFechaHora(v.fecha_venta)}</td>
          <td style="${td}">${this.esc(cliente)}</td>
          <td style="${td}font-size:11px;color:#64748b;">${itemsStr || '—'}</td>
          <td style="${tdR}font-weight:700;color:#059669;">${fmtMon(v.total)}</td>
        </tr>`;
    }).join('');

    const fechaIniStr = fechaInicio ? fmtFecha(fechaInicio) : '—';
    const fechaFinStr = fechaFin ? fmtFecha(fechaFin) : '—';
    const totalPeriodo = ventas.reduce((s, v) => s + (v.total || 0), 0);

    const el = document.createElement('div');
    el.style.fontFamily = 'Arial, sans-serif';
    el.style.color = '#1e293b';
    el.style.background = '#fff';
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 100%);padding:22px 24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div style="font-size:9px;letter-spacing:3px;color:#a5b4fc;font-weight:700;text-transform:uppercase;margin-bottom:4px;">POS Barbershop</div>
            <h1 style="margin:0;font-size:24px;font-weight:900;color:#ffffff;">INFORME DE BARBERO</h1>
            <p style="margin:6px 0 0;color:#c7d2fe;font-size:12px;">Per&iacute;odo: ${fechaIniStr} al ${fechaFinStr}</p>
          </div>
          <div style="text-align:right;">
            <div style="font-size:10px;color:#a5b4fc;font-weight:600;letter-spacing:0.5px;">C&Oacute;DIGO</div>
            <div style="font-size:16px;font-weight:800;color:#ffffff;font-family:monospace;">${this.esc(barbero.codigo_barbero)}</div>
          </div>
        </div>
      </div>

      <div style="background:#0f172a;padding:14px 24px;">
        <div style="display:flex;gap:0;">
          <div style="flex:2;padding:8px 12px 8px 0;border-right:1px solid #334155;">
            <div style="font-size:9px;letter-spacing:1px;color:#60a5fa;font-weight:700;text-transform:uppercase;">Barbero</div>
            <div style="font-size:18px;font-weight:800;color:#f1f5f9;margin-top:2px;">${this.esc(barbero.nombre)} ${this.esc(barbero.apellido)}</div>
            ${barbero.telefono ? `<div style="font-size:11px;color:#94a3b8;margin-top:2px;">Tel: ${this.esc(barbero.telefono)}</div>` : ''}
          </div>
          <div style="flex:1;text-align:center;padding:8px 6px;border-right:1px solid #334155;">
            <div style="font-size:9px;letter-spacing:1px;color:#34d399;font-weight:700;text-transform:uppercase;">Ventas Per&iacute;odo</div>
            <div style="font-size:22px;font-weight:800;color:#6ee7b7;margin-top:3px;">${ventas.length}</div>
          </div>
          <div style="flex:1;text-align:center;padding:8px 6px;border-right:1px solid #334155;">
            <div style="font-size:9px;letter-spacing:1px;color:#fbbf24;font-weight:700;text-transform:uppercase;">Total Per&iacute;odo</div>
            <div style="font-size:18px;font-weight:800;color:#fcd34d;margin-top:3px;">${fmtMon(totalPeriodo)}</div>
          </div>
          <div style="flex:1;text-align:center;padding:8px 6px;">
            <div style="font-size:9px;letter-spacing:1px;color:#a78bfa;font-weight:700;text-transform:uppercase;">Total Acumulado</div>
            <div style="font-size:18px;font-weight:800;color:#c4b5fd;margin-top:3px;">${fmtMon(statsGenerales.total_acumulado_gral || 0)}</div>
          </div>
        </div>
      </div>

      <div style="padding:16px 20px 20px;">
        <div style="margin-bottom:20px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #3730a3;">
            <span style="font-size:13px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">Detalle de Ventas del Per&iacute;odo</span>
            <span style="background:#3730a3;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;">${ventas.length}</span>
          </div>
          ${ventas.length ? `
            <table style="width:100%;border-collapse:collapse;">
              <thead>
                <tr>
                  <th style="${TH}">N&deg; Ticket</th>
                  <th style="${TH}">Fecha</th>
                  <th style="${TH}">Cliente</th>
                  <th style="${TH}">Servicios / Productos</th>
                  <th style="${THR}">Total</th>
                </tr>
              </thead>
              <tbody>${ventasRows}</tbody>
              <tfoot>
                <tr style="background:#f0fdf4;">
                  <td colspan="4" style="padding:9px 10px;text-align:right;font-weight:800;font-size:12px;color:#1e293b;border-top:2px solid #bbf7d0;">TOTAL DEL PER&Iacute;ODO</td>
                  <td style="padding:9px 10px;text-align:right;font-weight:800;font-size:14px;color:#059669;border-top:2px solid #bbf7d0;">${fmtMon(totalPeriodo)}</td>
                </tr>
              </tfoot>
            </table>
          ` : '<p style="color:#94a3b8;font-style:italic;font-size:13px;padding:16px 0;">Sin ventas en el per&iacute;odo seleccionado.</p>'}
        </div>

        <div style="margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;">
          Documento generado el ${new Date().toLocaleString('es-AR')} &mdash; POS Barbershop
        </div>
      </div>
    `;

    const filename = `barbero_${barbero.codigo_barbero}_${fechaInicio}_${fechaFin}.pdf`.replace(/\s/g, '_');
    const config = {
      margin: [0, 0, 5, 0],
      filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: '#fff', useCORS: true },
      jsPDF: { orientation: 'landscape', unit: 'mm', format: 'a4' }
    };
    html2pdf().set(config).from(el).save();
  },

  aplicarFiltroFechas() {
    this.state.filtro_fecha_inicio = document.getElementById('fechaInicio')?.value || '';
    this.state.filtro_fecha_fin = document.getElementById('fechaFin')?.value || '';
    this.renderUI();
    this.attachEvents();
    if (this.state.detalle?.barbero?.id) {
      this.verDetalle(this.state.detalle.barbero.id);
    }
  },

  aplicarFiltroDetalle() {
    if (this.state.detalle?.barbero?.id) {
      this.state.filtro_fecha_inicio = document.getElementById('detalleFechaInicio')?.value || '';
      this.state.filtro_fecha_fin = document.getElementById('detalleFechaFin')?.value || '';
      this.verDetalle(this.state.detalle.barbero.id);
    }
  }
};

