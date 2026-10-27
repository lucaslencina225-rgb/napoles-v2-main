import { sortableTables, refreshWithFocus, searchText } from '../utils/table-utils.js';
import { api } from '../api-client.js';
import toast from '../utils/toast.js';

export default {
  state: {
    clientes: [],
    busqueda: '',
    cliente_editando: null,
    detalle: null,
    filtro_fecha_inicio: '',
    filtro_fecha_fin: ''
  },

  async render(container) {
    this.container = container;
    await this.cargarClientes();
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

  async cargarClientes() {
    try {
      this.state.clientes = await api.getAll('/clientes');
    } catch (e) {
      console.error('Error cargando clientes', e);
      this.state.clientes = [];
    }
  },

  renderUI() {
    const rows = this.state.clientes
      .filter(row => searchText(`${row.nombre} ${row.apellido || ''} ${row.telefono || ''} ${row.email || ''} ${row.codigo_barbero || row.id}`).includes(searchText(this.state.busqueda)))
      .map(c => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">${this.esc(c.id)}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100">${this.esc(c.nombre)} ${this.esc(c.apellido)}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">${this.esc(c.telefono||'')}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300">${this.esc(c.email||'')}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700" data-sort-value="${this.esc(c.creado_en || '')}">${this.formatFechaHora(c.creado_en)}</td>
          <td class="p-2 border-t border-gray-200 dark:border-gray-700 text-right">
            <button class="btn-ver text-xs px-2 py-1 bg-blue-500 text-white rounded" data-id="${c.id}">Ver</button>
            <button class="btn-editar text-xs px-2 py-1 bg-indigo-500 text-white rounded ml-2" data-id="${c.id}">Editar</button>
            <button class="btn-eliminar text-xs px-2 py-1 bg-red-500 text-white rounded ml-2" data-id="${c.id}">Eliminar</button>
          </td>
        </tr>
      `).join('');

    this.container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Clientes</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400">Gestión de clientes y su historial de consumos</p>
          </div>
          <div class="flex flex-col lg:flex-row lg:items-end gap-2">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input id="clientesBuscar" placeholder="Buscar por nombre o teléfono" class="px-3 py-2 rounded border" value="${this.esc(this.state.busqueda)}" />
              <div class="flex gap-2">
                <input id="fechaInicio" type="date" class="w-full px-3 py-2 rounded border" value="${this.esc(this.state.filtro_fecha_inicio)}" />
                <input id="fechaFin" type="date" class="w-full px-3 py-2 rounded border" value="${this.esc(this.state.filtro_fecha_fin)}" />
              </div>
            </div>
            <div class="flex gap-2">
              <button id="btnFiltrarFechas" class="px-3 py-2 bg-blue-600 text-white rounded">Filtrar fechas</button>
              <button id="btnNuevoCliente" class="px-3 py-2 bg-green-600 text-white rounded">Nuevo cliente</button>
            </div>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left bg-gray-50 dark:bg-gray-700">
                <th class="p-2 text-gray-700 dark:text-gray-200">ID</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Nombre</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Teléfono</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Email</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Agregado</th>
                <th class="p-2 text-gray-700 dark:text-gray-200">Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td class="p-4 text-gray-500 dark:text-gray-400" colspan="6">No hay clientes</td></tr>'}
            </tbody>
          </table>
        </div>

        <div id="modalCliente" class="hidden fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-2 sm:p-4" style="backdrop-filter: blur(2px);">
          <div class="bg-white dark:bg-gray-900 rounded-lg w-full max-w-sm max-h-[95vh] sm:max-h-[90vh] flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700">
            <!-- Header -->
            <div class="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 z-10">
              <h2 id="modalClienteTitle" class="text-lg font-bold text-gray-900 dark:text-white">Nuevo cliente</h2>
            </div>
            
            <!-- Scrollable Content -->
            <div class="flex-1 overflow-y-auto px-4 py-3">
              <div class="space-y-2">
                <!-- Campos Requeridos -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Nombre *</label>
                    <input id="cliNombre" placeholder="Nombre" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Apellido *</label>
                    <input id="cliApellido" placeholder="Apellido" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Teléfono *</label>
                  <input id="cliTelefono" placeholder="Teléfono" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                <hr class="my-2 border-gray-200 dark:border-gray-700" />

                <!-- Campos Opcionales -->
                <div>
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Email</label>
                  <input id="cliEmail" type="email" placeholder="Email" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Tipo Doc.</label>
                    <select id="cliDocumentoTipo" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                      <option value="DNI">DNI</option>
                      <option value="CUIT">CUIT</option>
                      <option value="Pasaporte">Pasaporte</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Nº Documento</label>
                    <input id="cliDocumentoNumero" placeholder="Número" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Dirección</label>
                  <input id="cliDireccion" placeholder="Dirección" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Ciudad</label>
                    <input id="cliCiudad" placeholder="Ciudad" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Provincia</label>
                    <input id="cliProvincia" placeholder="Provincia" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Código Postal</label>
                    <input id="cliCodigoPostal" placeholder="CP" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">Razón Social</label>
                    <input id="cliRazonSocial" placeholder="Razón Social" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-700 dark:text-gray-200 mb-0.5">CUIT</label>
                  <input id="cliCuit" placeholder="CUIT" class="w-full px-2 py-1.5 text-sm border rounded border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white" />
                </div>
              </div>
            </div>

            <!-- Footer con Botones Sticky -->
            <div class="sticky bottom-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 flex gap-2">
              <button id="btnGuardarCliente" class="flex-1 px-3 py-2 text-sm font-semibold bg-green-600 text-white rounded hover:bg-green-700 transition">Guardar</button>
              <button id="btnCerrarModalCliente" class="flex-1 px-3 py-2 text-sm font-semibold bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white rounded hover:bg-gray-400 dark:hover:bg-gray-700 transition">Cancelar</button>
            </div>
          </div>
        </div>

        <div id="modalDetalleCliente" class="hidden fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" style="backdrop-filter:blur(2px)">
          <div class="bg-white dark:bg-gray-800 rounded-xl w-full max-w-5xl flex flex-col shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[92vh]">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 rounded-t-xl z-10">
              <h2 class="text-2xl font-bold text-gray-900 dark:text-white" id="detalleNombre">Detalle cliente</h2>
              <button id="btnCerrarDetalle" class="px-4 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium transition">Cerrar</button>
            </div>
            <div id="detalleBody" class="overflow-y-auto flex-1 p-6"></div>
          </div>
        </div>

        <div id="modalConsumoPuntos" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white rounded-lg w-full max-w-sm p-6">
            <h2 class="text-xl font-bold mb-4">Consumir Puntos</h2>
            <div class="mb-4">
              <p class="text-sm text-gray-600 mb-2">Puntos disponibles: <span id="puntosDisponibles" class="font-bold">0</span></p>
            </div>
            <div class="mb-4">
              <label class="block text-sm font-semibold mb-2">Cantidad de puntos a consumir</label>
              <input id="inputPuntosConsumidor" type="number" min="0" placeholder="0" class="w-full px-3 py-2 rounded border" />
            </div>
            <div class="mb-4">
              <label class="block text-sm font-semibold mb-2">Descripción (opcional)</label>
              <textarea id="inputDescripcionConsumo" placeholder="Ej: Descuento para corte" class="w-full px-3 py-2 rounded border" rows="3"></textarea>
            </div>
            <div class="flex gap-2 justify-end">
              <button id="btnCancelarConsumo" class="px-4 py-2 rounded border text-gray-700 hover:bg-gray-100">Cancelar</button>
              <button id="btnConfirmarConsumo" class="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700">Consumir</button>
            </div>
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
    // Configurar cierre de modales con ESC y click fuera
    this.setupModalClose('modalCliente', 'btnCerrarModalCliente');
    this.setupModalClose('modalDetalleCliente', 'btnCerrarDetalle');
    this.setupModalClose('modalConsumoPuntos');

    document.getElementById('clientesBuscar')?.addEventListener('input', (e) => {
      this.state.busqueda = e.target.value;
      if (!e.isComposing) refreshWithFocus(this);
    });

    document.getElementById('btnNuevoCliente')?.addEventListener('click', () => this.abrirModalNuevo());
    document.getElementById('btnFiltrarFechas')?.addEventListener('click', () => this.aplicarFiltroFechas());

    document.querySelectorAll('.btn-editar').forEach(btn => btn.addEventListener('click', (e) => this.editarCliente(e.currentTarget.dataset.id)));
    document.querySelectorAll('.btn-ver').forEach(btn => btn.addEventListener('click', (e) => this.verDetalle(e.currentTarget.dataset.id)));
    document.querySelectorAll('.btn-eliminar').forEach(btn => btn.addEventListener('click', (e) => this.eliminarCliente(e.currentTarget.dataset.id)));

    document.getElementById('btnCerrarModalCliente')?.addEventListener('click', () => this.cerrarModalNuevo());
    document.getElementById('btnGuardarCliente')?.addEventListener('click', () => this.guardarCliente());
    document.getElementById('btnCerrarDetalle')?.addEventListener('click', () => document.getElementById('modalDetalleCliente')?.classList.add('hidden'));
  },

  abrirModalNuevo() {
    this.state.cliente_editando = null;
    document.getElementById('modalCliente')?.classList.remove('hidden');
    document.getElementById('modalClienteTitle').textContent = 'Nuevo cliente';
    document.getElementById('cliNombre').value = '';
    document.getElementById('cliApellido').value = '';
    document.getElementById('cliTelefono').value = '';
    document.getElementById('cliEmail').value = '';
    document.getElementById('cliDocumentoTipo').value = 'DNI';
    document.getElementById('cliDocumentoNumero').value = '';
    document.getElementById('cliDireccion').value = '';
    document.getElementById('cliCiudad').value = '';
    document.getElementById('cliProvincia').value = '';
    document.getElementById('cliCodigoPostal').value = '';
    document.getElementById('cliRazonSocial').value = '';
    document.getElementById('cliCuit').value = '';
  },

  cerrarModalNuevo() {
    document.getElementById('modalCliente')?.classList.add('hidden');
  },

  async editarCliente(id) {
    const cli = this.state.clientes.find(c => String(c.id) === String(id));
    if (!cli) return;
    this.state.cliente_editando = cli;
    document.getElementById('modalCliente')?.classList.remove('hidden');
    document.getElementById('modalClienteTitle').textContent = 'Editar cliente';
    document.getElementById('cliNombre').value = cli.nombre || '';
    document.getElementById('cliApellido').value = cli.apellido || '';
    document.getElementById('cliTelefono').value = cli.telefono || '';
    document.getElementById('cliEmail').value = cli.email || '';
    document.getElementById('cliDocumentoTipo').value = cli.documento_tipo || 'DNI';
    document.getElementById('cliDocumentoNumero').value = cli.documento_numero || '';
    document.getElementById('cliDireccion').value = cli.direccion || '';
    document.getElementById('cliCiudad').value = cli.ciudad || '';
    document.getElementById('cliProvincia').value = cli.provincia || '';
    document.getElementById('cliCodigoPostal').value = cli.codigo_postal || '';
    document.getElementById('cliRazonSocial').value = cli.razon_social || '';
    document.getElementById('cliCuit').value = cli.cuit || '';
  },

  async eliminarCliente(id) {
    if (!confirm('¿Eliminar este cliente? Esta acción marcará el cliente como inactivo.')) return;
    try {
      const res = await fetch(`/api/clientes/${id}`, {
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
      
      // Si la respuesta es 200+, aun si no tiene contenido JSON, es exitosa
      await this.cargarClientes();
      this.renderUI();
      this.attachEvents();
      toast.success('Cliente eliminado correctamente');
    } catch (e) {
      toast.error('Error al eliminar cliente: ' + e.message);
      console.error('Error detalles:', e);
    }
  },

  async guardarCliente() {
    const nombre = document.getElementById('cliNombre').value.trim();
    const apellido = document.getElementById('cliApellido').value.trim();
    const telefono = document.getElementById('cliTelefono').value.trim();
    const email = document.getElementById('cliEmail').value.trim();
    const documento_tipo = document.getElementById('cliDocumentoTipo').value;
    const documento_numero = document.getElementById('cliDocumentoNumero').value.trim();
    const direccion = document.getElementById('cliDireccion').value.trim();
    const ciudad = document.getElementById('cliCiudad').value.trim();
    const provincia = document.getElementById('cliProvincia').value.trim();
    const codigo_postal = document.getElementById('cliCodigoPostal').value.trim();
    const razon_social = document.getElementById('cliRazonSocial').value.trim();
    const cuit = document.getElementById('cliCuit').value.trim();

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
      documento_numero,
      direccion,
      ciudad,
      provincia,
      codigo_postal,
      razon_social,
      cuit
    };

    try {
      let res;
      if (this.state.cliente_editando) {
        res = await fetch(`/api/clientes/${this.state.cliente_editando.id}`, {
          method: 'PUT',
          headers: api.getHeaders(),
          body: JSON.stringify(body)
        });
      } else {
        res = await fetch('/api/clientes', {
          method: 'POST',
          headers: api.getHeaders(),
          body: JSON.stringify(body)
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error guardando cliente');
      }

      await this.cargarClientes();
      this.cerrarModalNuevo();
      this.renderUI();
      this.attachEvents();
      toast.success('Cliente guardado correctamente');
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
      const res = await fetch(`/api/clientes/${id}${query}`, { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Cliente no encontrado');
      
      let data;
      try {
        // Primero obtener como texto para limpiar BOM u otros caracteres especiales
        const text = await res.text();
        const cleanedText = text.replace(/^\uFEFF/, ''); // Remover BOM
        data = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error('Error al parsear JSON:', parseError);
        toast.error('Error al procesar datos del cliente. Intenta nuevamente.');
        return;
      }
      
      this.state.detalle = data;

      const cliente = data.cliente;
      const ventas = data.ventas || [];
      const productos = data.productos || [];

      // Cargar historial de puntos
      let movimientosPuntos = [];
      try {
        const puntosRes = await fetch(`/api/clientes/${id}/historial-puntos`, { headers: api.getHeaders() });
        if (puntosRes.ok) {
          movimientosPuntos = await puntosRes.json();
        }
      } catch (e) {
        console.error('Error al cargar historial de puntos:', e);
      }

      const isDark = document.documentElement.classList.contains('dark');
      const s = {
        infoPanel: isDark
          ? 'background:#1e293b; border:1px solid #334155; border-radius:10px; padding:16px;'
          : 'background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:16px;',
        panel: isDark
          ? 'background:#1e293b; border:1px solid #334155; border-radius:10px; padding:16px;'
          : 'background:#ffffff; border:1px solid #e5e7eb; border-radius:10px; padding:16px;',
        panelBlue: isDark
          ? 'background:#1e3a5f; border:1px solid #2563eb; border-radius:10px; padding:14px;'
          : 'background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px;',
        label: isDark
          ? 'color:#94a3b8; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-top:10px; display:block;'
          : 'color:#6b7280; font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.05em; margin-top:10px; display:block;',
        value: isDark ? 'color:#f1f5f9; font-weight:600;' : 'color:#1e293b; font-weight:600;',
        text:  isDark ? 'color:#f1f5f9;' : 'color:#1e293b;',
        textMuted: isDark ? 'color:#94a3b8; font-size:12px;' : 'color:#6b7280; font-size:12px;',
        labelBlue: isDark ? 'color:#93c5fd; font-size:11px; font-weight:600;' : 'color:#1d4ed8; font-size:11px; font-weight:600;',
        valueBlue: isDark ? 'color:#bfdbfe; font-size:26px; font-weight:700;' : 'color:#2563eb; font-size:26px; font-weight:700;',
        heading: isDark ? 'color:#f1f5f9; font-weight:600; margin-bottom:8px; font-size:14px;' : 'color:#1e293b; font-weight:600; margin-bottom:8px; font-size:14px;',
        divider: isDark ? 'border:none; border-top:1px solid #334155; margin:12px 0;' : 'border:none; border-top:1px solid #e2e8f0; margin:12px 0;',
        thStyle: isDark
          ? 'padding:8px 10px; background:#374151; color:#e5e7eb; font-weight:600; text-align:left; font-size:12px;'
          : 'padding:8px 10px; background:#f3f4f6; color:#374151; font-weight:600; text-align:left; font-size:12px;',
        tdStyle: isDark
          ? 'padding:7px 10px; border-top:1px solid #374151; color:#f1f5f9; font-size:13px;'
          : 'padding:7px 10px; border-top:1px solid #e5e7eb; color:#1e293b; font-size:13px;',
        tdRight: isDark
          ? 'padding:7px 10px; border-top:1px solid #374151; color:#f1f5f9; text-align:right; font-weight:600; font-size:13px;'
          : 'padding:7px 10px; border-top:1px solid #e5e7eb; color:#1e293b; text-align:right; font-weight:600; font-size:13px;',
        tableWrapper: isDark
          ? 'border:1px solid #374151; border-radius:8px; overflow:hidden;'
          : 'border:1px solid #e5e7eb; border-radius:8px; overflow:hidden;',
        subRow: isDark ? 'background:#111827;' : 'background:#f9fafb;',
        input: isDark
          ? 'padding:6px 10px; border-radius:6px; border:1px solid #4b5563; background:#374151; color:#f1f5f9; font-size:13px; width:100%;'
          : 'padding:6px 10px; border-radius:6px; border:1px solid #d1d5db; background:#fff; color:#111827; font-size:13px; width:100%;',
        btnApply: 'padding:8px 14px; background:#2563eb; color:#fff; border-radius:6px; font-size:13px; cursor:pointer; white-space:nowrap; border:none;',
        badgeGreen: 'padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:#166534; color:#bbf7d0;',
        badgeRed:   'padding:2px 8px; border-radius:999px; font-size:11px; font-weight:700; background:#7f1d1d; color:#fecaca;',
        btnConsumir: 'margin-top:10px; width:100%; padding:8px; background:#2563eb; color:#fff; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer;',
      };

      const movimientosHtml = movimientosPuntos.map(m => `
        <tr>
          <td style="${s.tdStyle}">${this.formatFechaHora(m.fecha_movimiento)}</td>
          <td style="${s.tdStyle}">
            <span style="${m.tipo === 'suma' ? s.badgeGreen : s.badgeRed}">
              ${m.tipo === 'suma' ? '+' : '-'}${m.puntos_cantidad}
            </span>
          </td>
          <td style="${s.tdStyle}">${m.puntos_nuevos}</td>
          <td style="${s.tdStyle}">${this.esc(m.descripcion || '')}</td>
        </tr>
      `).join('');

      const productosHtml = productos.map(p => `
        <tr>
          <td style="${s.tdStyle}; font-family:monospace; font-size:12px;">${this.esc(p.sku)}</td>
          <td style="${s.tdStyle}">${this.esc(p.nombre)}</td>
          <td style="${s.tdRight}">${p.cantidad_vendida || 0}</td>
          <td style="${s.tdRight}">$${Number(p.total_gastado||0).toFixed(2)}</td>
        </tr>
      `).join('');

      const ventasHtml = ventas.map(v => {
        const items = v.items || [];
        const itemsRows = items.map(it => `
          <tr>
            <td style="${s.tdStyle}">${this.esc(it.producto_nombre)}</td>
            <td style="${s.tdStyle}; font-family:monospace; font-size:12px;">${this.esc(it.sku)}</td>
            <td style="${s.tdRight}">${it.cantidad}</td>
            <td style="${s.tdRight}">$${Number(it.precio_unitario||0).toFixed(2)}</td>
          </tr>
        `).join('');
        return `
          <tr>
            <td style="${s.tdStyle}; font-family:monospace; font-size:12px;">${this.esc(v.numero_ticket)}</td>
            <td style="${s.tdStyle}">${this.formatFechaHora(v.fecha_venta)}</td>
            <td style="${s.tdStyle}">${this.esc(v.sucursal)}</td>
            <td style="${s.tdRight}">$${Number(v.total||0).toFixed(2)}</td>
          </tr>
          <tr>
            <td colspan="4" style="padding:0; border-top:1px solid ${isDark ? '#374151' : '#e5e7eb'};">
              <div style="padding:10px 14px; ${s.subRow}">
                <div style="${s.textMuted} font-weight:600; margin-bottom:6px;">Items de la venta:</div>
                <div style="overflow-x:auto;">
                  <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead><tr>
                      <th style="${s.thStyle}">Producto</th>
                      <th style="${s.thStyle}">SKU</th>
                      <th style="${s.thStyle} text-align:right;">Cantidad</th>
                      <th style="${s.thStyle} text-align:right;">Precio</th>
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

      const body = document.getElementById('detalleBody');
      if (!body) return;
      body.innerHTML = `
        <div style="display:grid; grid-template-columns:1fr 2fr; gap:16px;">
          <!-- Panel izquierdo: info del cliente -->
          <div style="${s.infoPanel}">
            <span style="${s.label}">Nombre</span>
            <div style="${s.value}">${this.esc(cliente.nombre)} ${this.esc(cliente.apellido)}</div>
            <span style="${s.label}">Teléfono</span>
            <div style="${s.text}">${this.esc(cliente.telefono||'—')}</div>
            <span style="${s.label}">Email</span>
            <div style="${s.text}">${this.esc(cliente.email||'—')}</div>
            <span style="${s.label}">Documento</span>
            <div style="${s.text}">${this.esc(cliente.documento_tipo||'')} ${this.esc(cliente.documento_numero||'—')}</div>
            <span style="${s.label}">Dirección</span>
            <div style="${s.text}">${this.esc(cliente.direccion||'—')}</div>
            <span style="${s.label}">Ciudad / Provincia</span>
            <div style="${s.text}">${this.esc(cliente.ciudad||'—')} / ${this.esc(cliente.provincia||'—')}</div>
            <span style="${s.label}">Código postal</span>
            <div style="${s.text}">${this.esc(cliente.codigo_postal||'—')}</div>
            <span style="${s.label}">Razón social / CUIT</span>
            <div style="${s.text}">${this.esc(cliente.razon_social||'—')} ${this.esc(cliente.cuit||'')}</div>
            <span style="${s.label}">Visitas</span>
            <div style="${s.value}">${cliente.visitas || 0}</div>
            <hr style="${s.divider}" />
            <div style="${s.panelBlue}">
              <div style="${s.labelBlue}">Puntos acumulados</div>
              <div style="${s.valueBlue}">${cliente.puntos_acumulados || 0}</div>
              <button class="btnConsumirPuntos" style="${s.btnConsumir}" data-id="${cliente.id}">CONSUMIR</button>
            </div>
          </div>

          <!-- Panel derecho: historial -->
          <div style="display:flex; flex-direction:column; gap:14px;">
            ${movimientosPuntos.length > 0 ? `
            <div style="${s.panel}">
              <div style="${s.heading}">Historial de puntos</div>
              <div style="overflow-x:auto; ${s.tableWrapper}">
                <table style="width:100%; border-collapse:collapse;">
                  <thead><tr>
                    <th style="${s.thStyle}">Fecha</th>
                    <th style="${s.thStyle}">Movimiento</th>
                    <th style="${s.thStyle}">Saldo</th>
                    <th style="${s.thStyle}">Descripción</th>
                  </tr></thead>
                  <tbody>${movimientosHtml}</tbody>
                </table>
              </div>
            </div>` : ''}

            <div style="${s.panel}">
              <div style="${s.heading}">Productos consumidos</div>
              <div style="overflow-x:auto; ${s.tableWrapper}">
                <table style="width:100%; border-collapse:collapse;">
                  <thead><tr>
                    <th style="${s.thStyle}">SKU</th>
                    <th style="${s.thStyle}">Producto</th>
                    <th style="${s.thStyle} text-align:right;">Cantidad</th>
                    <th style="${s.thStyle} text-align:right;">Total</th>
                  </tr></thead>
                  <tbody>${productosHtml || `<tr><td style="${s.tdStyle}" colspan="4">Sin productos registrados</td></tr>`}</tbody>
                </table>
              </div>
            </div>

            <div style="${s.panel}">
              <div style="display:flex; flex-wrap:wrap; align-items:flex-end; justify-content:space-between; gap:10px; margin-bottom:12px;">
                <div>
                  <div style="${s.heading} margin-bottom:2px;">Ventas recientes</div>
                  <div style="${s.textMuted}">Filtra las compras por rango de fechas.</div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end;">
                  <div>
                    <div style="${s.textMuted} margin-bottom:3px;">Desde</div>
                    <input id="detalleFechaInicio" type="date" style="${s.input}" value="${this.esc(this.state.filtro_fecha_inicio)}" />
                  </div>
                  <div>
                    <div style="${s.textMuted} margin-bottom:3px;">Hasta</div>
                    <input id="detalleFechaFin" type="date" style="${s.input}" value="${this.esc(this.state.filtro_fecha_fin)}" />
                  </div>
                  <button id="btnAplicarFiltroDetalle" style="${s.btnApply}">Aplicar</button>
                </div>
              </div>
              <div style="overflow-x:auto; ${s.tableWrapper}">
                <table style="width:100%; border-collapse:collapse; font-size:13px;">
                  <thead><tr>
                    <th style="${s.thStyle}">Ticket</th>
                    <th style="${s.thStyle}">Fecha</th>
                    <th style="${s.thStyle}">Sucursal</th>
                    <th style="${s.thStyle} text-align:right;">Total</th>
                  </tr></thead>
                  <tbody>${ventasHtml || `<tr><td style="${s.tdStyle}" colspan="4">Sin ventas en el período</td></tr>`}</tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('detalleNombre').textContent = `${cliente.nombre} ${cliente.apellido}`;
      document.getElementById('modalDetalleCliente')?.classList.remove('hidden');
      document.getElementById('btnAplicarFiltroDetalle')?.addEventListener('click', () => this.aplicarFiltroDetalle());
      document.querySelectorAll('.btnConsumirPuntos').forEach(btn => btn.addEventListener('click', (e) => this.abrirConsumoPuntos(parseInt(e.currentTarget.dataset.id, 10))));
    } catch (e) {
      toast.error('Error al cargar detalle: ' + e.message);
    }
  },

  aplicarFiltroFechas() {
    this.state.filtro_fecha_inicio = document.getElementById('fechaInicio')?.value || '';
    this.state.filtro_fecha_fin = document.getElementById('fechaFin')?.value || '';
    this.renderUI();
    this.attachEvents();
    if (this.state.detalle?.cliente?.id) {
      this.verDetalle(this.state.detalle.cliente.id);
    } else {
      toast.warning('Selecciona un cliente y luego aplica el filtro de fechas en su detalle.');
    }
  },

  aplicarFiltroDetalle() {
    if (!this.state.detalle?.cliente?.id) {
      toast.warning('No hay cliente cargado para aplicar el filtro.');
      return;
    }
    this.state.filtro_fecha_inicio = document.getElementById('detalleFechaInicio')?.value || this.state.filtro_fecha_inicio;
    this.state.filtro_fecha_fin = document.getElementById('detalleFechaFin')?.value || this.state.filtro_fecha_fin;
    this.verDetalle(this.state.detalle.cliente.id);
  },

  abrirConsumoPuntos(clienteId) {
    if (!this.state.detalle?.cliente?.id || this.state.detalle.cliente.id !== clienteId) {
      toast.warning('No hay cliente cargado');
      return;
    }
    const puntosDisponibles = this.state.detalle.cliente.puntos_acumulados || 0;
    document.getElementById('puntosDisponibles').textContent = puntosDisponibles;
    document.getElementById('inputPuntosConsumidor').value = '';
    document.getElementById('inputDescripcionConsumo').value = '';
    document.getElementById('modalConsumoPuntos').classList.remove('hidden');
    document.getElementById('btnConfirmarConsumo').onclick = () => this.consumirPuntos(clienteId, puntosDisponibles);
    document.getElementById('btnCancelarConsumo').onclick = () => document.getElementById('modalConsumoPuntos').classList.add('hidden');
  },

  async consumirPuntos(clienteId, puntosDisponibles) {
    const cantidadStr = document.getElementById('inputPuntosConsumidor').value.trim();
    if (!cantidadStr) {
      toast.warning('Ingresa la cantidad de puntos');
      return;
    }
    const cantidad = parseInt(cantidadStr, 10);
    if (isNaN(cantidad) || cantidad <= 0) {
      toast.warning('Ingresa una cantidad válida');
      return;
    }
    if (cantidad > puntosDisponibles) {
      toast.warning(`No hay suficientes puntos. Disponibles: ${puntosDisponibles}`);
      return;
    }
    const descripcion = document.getElementById('inputDescripcionConsumo').value.trim();
    try {
      const res = await fetch(`/api/clientes/${clienteId}/consumir-puntos`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ puntos: cantidad, descripcion })
      });
      if (!res.ok) throw new Error('Error al consumir puntos');
      toast.success(`${cantidad} puntos consumidos correctamente`);
      document.getElementById('modalConsumoPuntos').classList.add('hidden');
      this.verDetalle(clienteId);
    } catch (e) {
      toast.error('Error: ' + e.message);
    }
  }
};

