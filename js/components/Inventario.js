import { sortableTables, refreshWithFocus } from '../utils/table-utils.js';
import { api } from '../api-client.js';

export default {
  state: {
    productos: [],
    categorias: [],
    marcas: [],
    proveedores: [],
    sucursales: [],
    busqueda: '',
    filtro_categoria: '',
    filtro_marca: '',
    filtro_proveedor: '',
    producto_editando: null,
    offset: 0,
    limite: 50,
    vistaGrid: false,
    datosExcel: null
  },

  _confirmCallback: null,
  _toastTimer: null,

  async render(container) {
    this.container = container;
    try {
      await Promise.all([
        this.cargarProductos(),
        this.cargarCategorias(),
        this.cargarMarcas(),
        this.cargarProveedores(),
        this.cargarSucursales()
      ]);
    } catch (error) {
      console.error('Error cargando datos:', error);
    }
    this.renderUI();
    this.attachEvents();
  },

  async cargarProductos() {
    const requestId = this._productsRequest = (this._productsRequest || 0) + 1;
    try {
      const params = new URLSearchParams({
        offset: String(this.state.offset),
        limite: String(this.state.limite),
        ordenar: this.state.ordenar || 'id',
        direccion: this.state.direccion || 'asc',
        buscar: this.state.busqueda || '',
        categoria_id: this.state.filtro_categoria || '',
        marca_id: this.state.filtro_marca || '',
        proveedor_id: this.state.filtro_proveedor || ''
      });
      const res = await fetch(`/api/productos?${params.toString()}`, {
        headers: api.getHeaders()
      });
      if (!res.ok) throw new Error('Error al cargar productos');
      const data = await res.json();
      if (requestId !== this._productsRequest) return;
      this.state.productos = Array.isArray(data) ? data : (data.productos || []);
    } catch (error) {
      console.error(error);
      if (requestId === this._productsRequest) this.state.productos = [];
    }
  },

  async cargarCategorias() {
    try {
      const res = await fetch('/api/categorias', { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Error al cargar categorías');
      const data = await res.json();
      this.state.categorias = Array.isArray(data) ? data : (data.categorias || []);
    } catch (error) {
      console.error(error);
      this.state.categorias = [];
    }
  },

  async cargarMarcas() {
    try {
      const res = await fetch('/api/marcas', { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Error al cargar marcas');
      const data = await res.json();
      this.state.marcas = Array.isArray(data) ? data : (data.marcas || []);
    } catch (error) {
      console.error(error);
      this.state.marcas = [];
    }
  },

  async cargarProveedores() {
    try {
      const res = await fetch('/api/proveedores', { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Error al cargar proveedores');
      const data = await res.json();
      this.state.proveedores = Array.isArray(data) ? data : (data.proveedores || []);
    } catch (error) {
      console.error(error);
      this.state.proveedores = [];
    }
  },

  async cargarSucursales() {
    try {
      const res = await fetch('/api/sucursales', { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Error al cargar sucursales');
      const data = await res.json();
      this.state.sucursales = Array.isArray(data) ? data : (data.sucursales || []);
    } catch (error) {
      console.error(error);
      this.state.sucursales = [];
    }
  },

  esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  showToast(message, type = 'success') {
    const toast = this.container?.querySelector('#invToast');
    if (!toast) return;
    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.className = `fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-[60] flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this.esc(message)}</span>`;
    toast.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
  },

  openConfirm(message, onConfirm, title = 'Confirmar acción') {
    this._confirmCallback = onConfirm;
    const msg = this.container?.querySelector('#invConfirmMessage');
    const ttl = this.container?.querySelector('#invConfirmTitle');
    if (msg) msg.textContent = message;
    if (ttl) ttl.textContent = title;
    this.container?.querySelector('#invModalConfirm')?.classList.remove('hidden');
  },

  openResultadoImport(result) {
    const body = this.container?.querySelector('#importResultBody');
    if (!body) return;
    const errores = result.errores || [];
    body.innerHTML = `
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center border border-green-200 dark:border-green-800">
          <p class="text-2xl font-bold text-green-700 dark:text-green-300">${result.importados || 0}</p>
          <p class="text-xs text-green-600 dark:text-green-400">Importados</p>
        </div>
        <div class="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-center border border-red-200 dark:border-red-800">
          <p class="text-2xl font-bold text-red-700 dark:text-red-300">${errores.length}</p>
          <p class="text-xs text-red-600 dark:text-red-400">Errores</p>
        </div>
      </div>
      ${errores.length ? `<div class="max-h-40 overflow-y-auto text-xs space-y-1 text-red-600 dark:text-red-400">${errores.slice(0, 10).map(e => `<p>• ${this.esc(e)}</p>`).join('')}${errores.length > 10 ? `<p class="text-gray-500">...y ${errores.length - 10} más</p>` : ''}</div>` : '<p class="text-sm text-gray-600 dark:text-gray-400">Todos los registros se procesaron correctamente.</p>'}
    `;
    this.container?.querySelector('#modalImportResult')?.classList.remove('hidden');
  },

  redondearPrecio(val) {
    const n = parseFloat(String(val ?? '').replace(',', '.'));
    if (Number.isNaN(n)) return 0;
    return Math.round(n);
  },

  generarSku(nombre) {
    const nombre_limpio = String(nombre)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '')
      .toLowerCase();
    
    const letras = nombre_limpio.slice(0, 2).padEnd(2, 'x');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `${letras}-${randomSuffix}`;
  },

  normalizarDatosExcel(rows) {
    if (!Array.isArray(rows)) return [];
    const pick = (row, ...keys) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') return row[k];
      }
      const entries = Object.entries(row);
      for (const k of keys) {
        const found = entries.find(([rk]) => rk.toLowerCase().trim() === k.toLowerCase());
        if (found && found[1] != null && String(found[1]).trim() !== '') return found[1];
      }
      return '';
    };

    return rows.map((row, idx) => {
      const nombre = String(pick(row, 'Nombre', 'nombre', 'NOMBRE', 'Producto', 'producto')).trim();
      if (!nombre) return null;

      const skuRaw = pick(row, 'SKU', 'sku', 'Código', 'codigo', 'Codigo', 'CODIGO');
      const precioVentaRaw = pick(row, 'Precio Venta', 'precio_venta', 'Precio', 'precio', 'PVP');
      const precioCostoRaw = pick(row, 'Precio Costo', 'precio_costo', 'Costo', 'costo', 'Precio Compra');

      return {
        SKU: String(skuRaw || this.generarSku(nombre, idx)).trim(),
        Nombre: nombre,
        Categoria: pick(row, 'Categoría', 'Categoria', 'categoria', 'Tipo', 'tipo'),
        Proveedor: pick(row, 'Proveedor', 'proveedor', 'PROVEEDOR'),
        Marca: pick(row, 'Marca', 'marca', 'MARCA'),
        'Precio Venta': precioVentaRaw !== '' ? this.redondearPrecio(precioVentaRaw) : 0,
        'Precio Costo': precioCostoRaw !== '' ? this.redondearPrecio(precioCostoRaw) : 0
      };
    }).filter(Boolean);
  },

  mostrarPreviewImport(normalizados) {
    const info = document.getElementById('importFileInfo');
    const preview = document.getElementById('previewExcel');
    const btn = document.getElementById('btnConfirmarImport');

    if (info) {
      info.textContent = `${normalizados.length} producto(s) listos · precios redondeados`;
      info.classList.remove('hidden');
    }

    const cols = ['Nombre', 'Categoria', 'Proveedor', 'Marca', 'Precio Venta', 'SKU'];
    if (preview) {
      preview.innerHTML = `
        <table class="w-full text-xs">
          <thead><tr class="bg-gray-100 dark:bg-gray-700">${cols.map(c => `<th class="p-2 text-left whitespace-nowrap">${c}</th>`).join('')}</tr></thead>
          <tbody>${normalizados.slice(0, 8).map(row => `
            <tr class="border-t border-gray-200 dark:border-gray-600">
              ${cols.map(c => `<td class="p-2 whitespace-nowrap">${this.esc(row[c] ?? row['Categoría'] ?? '')}</td>`).join('')}
            </tr>
          `).join('')}</tbody>
        </table>
        ${normalizados.length > 8 ? `<p class="p-2 text-xs text-gray-500">Mostrando 8 de ${normalizados.length}</p>` : ''}
      `;
      preview.classList.remove('hidden');
    }
    if (btn) btn.disabled = false;
  },

  async cargarPlantillaInventario() {
    try {
      const res = await fetch('./assets/docs/Inventario.xlsx');
      if (!res.ok) {
        this.showToast('Colocá Inventario.xlsx en frontend/assets/docs/', 'error');
        return;
      }
      const buf = await res.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
      const normalizados = this.normalizarDatosExcel(jsonData);

      if (!normalizados.length) {
        this.showToast('No hay filas válidas. El Excel debe tener columna Nombre.', 'error');
        return;
      }

      this.state.datosExcel = normalizados;
      document.getElementById('modalImportarExcel')?.classList.remove('hidden');
      this.mostrarPreviewImport(normalizados);
      this.showToast(`Inventario.xlsx cargado: ${normalizados.length} productos`, 'info');
    } catch (error) {
      this.showToast('Error al leer Inventario.xlsx: ' + error.message, 'error');
    }
  },

  exportarExcel() {
    if (!this.state.productos || this.state.productos.length === 0) {
      this.showToast('No hay productos para exportar', 'error');
      return;
    }

    try {
      const datos = this.state.productos.map(p => {
        const esServicio = p.es_servicio === 1 || p.es_servicio === true || p.minimo_stock === null || p.minimo_stock === undefined || p.minimo_stock < 0;
        return {
          'SKU': p.sku || '',
          'Nombre': p.nombre || '',
          'Categoría': p.categoria || '',
          'Marca': p.marca || '',
          'Proveedor': p.proveedor || '',
          'Precio Costo': p.precio_costo || '',
          'Precio Venta': p.precio_venta || '',
          'Mínimo Stock': esServicio ? 'No aplica' : (p.minimo_stock ?? ''),
          'Tipo': esServicio ? 'Servicio' : 'Producto',
          'Estado': p.activo ? 'Activo' : 'Inactivo'
        };
      });

      const ws = XLSX.utils.json_to_sheet(datos);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventario');

      const colWidths = [15, 25, 15, 15, 20, 12, 12, 14, 12, 10];
      ws['!cols'] = colWidths.map(w => ({ wch: w }));

      const fecha = new Date().toISOString().split('T')[0];
      const nombreArchivo = `Inventario_${fecha}.xlsx`;

      XLSX.writeFile(wb, nombreArchivo);
      this.showToast(`✅ Exportado: ${nombreArchivo} (${datos.length} productos)`, 'success');
    } catch (error) {
      this.showToast('Error al exportar: ' + error.message, 'error');
    }
  },

  async crearCategoria() {
    const nombre = document.getElementById('inputCategoriaNombre')?.value.trim();
    if (!nombre) {
      this.showToast('Ingresa el nombre de la categoría', 'error');
      return;
    }
    try {
      const response = await fetch('/api/categorias', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ nombre })
      });
      if (!response.ok) throw new Error('Error al crear categoría');
      const data = await response.json();
      this.state.categorias.push({ id: data.id, nombre });
      document.getElementById('editCategoria').innerHTML = `<option value="">Sin categoría</option>${this.state.categorias.map(c => `<option value="${c.id}" ${c.id === data.id ? 'selected' : ''}>${this.esc(c.nombre)}</option>`).join('')}`;
      document.getElementById('inputCategoriaNombre').value = '';
      document.getElementById('modalCrearCategoria')?.classList.add('hidden');
      this.showToast(`✅ Categoría "${nombre}" creada`, 'success');
    } catch (error) {
      this.showToast('Error: ' + error.message, 'error');
    }
  },

  async crearMarca() {
    const nombre = document.getElementById('inputMarcaNombre')?.value.trim();
    if (!nombre) {
      this.showToast('Ingresa el nombre de la marca', 'error');
      return;
    }
    try {
      const response = await fetch('/api/marcas', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ nombre })
      });
      if (!response.ok) throw new Error('Error al crear marca');
      const data = await response.json();
      this.state.marcas.push({ id: data.id, nombre });
      document.getElementById('editMarca').innerHTML = `<option value="">Sin marca</option>${this.state.marcas.map(m => `<option value="${m.id}" ${m.id === data.id ? 'selected' : ''}>${this.esc(m.nombre)}</option>`).join('')}`;
      document.getElementById('inputMarcaNombre').value = '';
      document.getElementById('modalCrearMarca')?.classList.add('hidden');
      this.showToast(`✅ Marca "${nombre}" creada`, 'success');
    } catch (error) {
      this.showToast('Error: ' + error.message, 'error');
    }
  },

  async crearProveedor() {
    const nombre = document.getElementById('inputProveedorNombre')?.value.trim();
    const contacto = document.getElementById('inputProveedorContacto')?.value.trim();
    if (!nombre) {
      this.showToast('Ingresa el nombre del proveedor', 'error');
      return;
    }
    try {
      const response = await fetch('/api/proveedores', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ nombre, contacto: contacto || '' })
      });
      if (!response.ok) throw new Error('Error al crear proveedor');
      const data = await response.json();
      this.state.proveedores.push({ id: data.id, nombre });
      document.getElementById('editProveedor').innerHTML = `<option value="">Sin proveedor</option>${this.state.proveedores.map(p => `<option value="${p.id}" ${p.id === data.id ? 'selected' : ''}>${this.esc(p.nombre)}</option>`).join('')}`;
      document.getElementById('inputProveedorNombre').value = '';
      document.getElementById('inputProveedorContacto').value = '';
      document.getElementById('modalCrearProveedor')?.classList.add('hidden');
      this.showToast(`✅ Proveedor "${nombre}" creado`, 'success');
    } catch (error) {
      this.showToast('Error: ' + error.message, 'error');
    }
  },

  renderAccionesProducto(p, compact = false) {
    return `
      <div class="flex ${compact ? 'gap-2' : 'gap-1'} justify-center">
        <button class="btn-editar px-2.5 py-1.5 rounded text-xs bg-blue-500 text-white hover:bg-blue-600 transition" data-id="${p.id}" title="Editar">
          <i class="fas fa-edit"></i>
        </button>
        <button class="btn-stock px-2.5 py-1.5 rounded text-xs bg-purple-500 text-white hover:bg-purple-600 transition" data-id="${p.id}" title="Stock">
          <i class="fas fa-warehouse"></i>
        </button>
        <button class="btn-eliminar px-2.5 py-1.5 rounded text-xs bg-red-500 text-white hover:bg-red-600 transition" data-id="${p.id}" title="Eliminar">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    `;
  },

  renderVistaTabla() {
    if (this.state.productos.length === 0) {
      return `
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500 dark:text-gray-400">
          <i class="fas fa-inbox text-3xl mb-2 block"></i>
          <p>No hay productos</p>
        </div>
      `;
    }

    return `
      <div class="hidden md:block overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <table class="w-full text-sm min-w-[640px]">
          <thead class="bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
            <tr>
              <th class="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">SKU</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100">Nombre</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">Marca</th>
              <th class="px-4 py-3 text-left font-semibold text-gray-900 dark:text-gray-100 hidden lg:table-cell">Categoría</th>
              <th class="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">Precio</th>
              <th class="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">Puntos</th>
              <th class="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">Acciones</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            ${this.state.productos.map(p => {
              const esServicio = p.es_servicio === 1 || p.es_servicio === true || p.minimo_stock === null || p.minimo_stock === undefined || p.minimo_stock < 0;
              return `
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                <td class="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">${this.esc(p.sku)}</td>
                <td class="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium max-w-[240px]">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="truncate">${this.esc(p.nombre)}</span>
                    ${esServicio ? `
                      <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white shadow-sm ring-1 ring-purple-400/30">
                        <i class="fas fa-cut text-[10px]"></i> Servicio
                      </span>
                    ` : ''}
                  </div>
                </td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs hidden lg:table-cell">${this.esc(p.marca || '—')}</td>
                <td class="px-4 py-3 text-gray-700 dark:text-gray-300 text-xs hidden lg:table-cell">${this.esc(p.categoria || '—')}</td>
                <td class="px-4 py-3 text-right font-semibold text-green-600 dark:text-green-400 whitespace-nowrap">$${p.precio_venta.toFixed(2)}</td>
                <td class="px-4 py-3 text-center text-gray-900 dark:text-gray-100 font-medium">${p.puntos || 0}</td>
                <td class="px-4 py-3 text-center">${this.renderAccionesProducto(p)}</td>
              </tr>
            `;}).join('')}
          </tbody>
        </table>
      </div>

      <div class="md:hidden space-y-3">
        ${this.state.productos.map(p => {
          const esServicio = p.es_servicio === 1 || p.es_servicio === true || p.minimo_stock === null || p.minimo_stock === undefined || p.minimo_stock < 0;
          return `
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div class="flex justify-between items-start gap-3 mb-2">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">${this.esc(p.nombre)}</p>
                  ${esServicio ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white shadow-sm ring-1 ring-purple-400/30">
                      <i class="fas fa-cut text-[9px]"></i> Servicio
                    </span>
                  ` : ''}
                </div>
                <p class="text-xs font-mono text-gray-500 dark:text-gray-400">${this.esc(p.sku)}</p>
              </div>
              <p class="font-bold text-green-600 dark:text-green-400 whitespace-nowrap">$${p.precio_venta.toFixed(2)}</p>
            </div>
            <div class="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400 mb-3">
              ${p.marca ? `<span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">${this.esc(p.marca)}</span>` : ''}
              ${p.categoria ? `<span class="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">${this.esc(p.categoria)}</span>` : ''}
            </div>
            ${this.renderAccionesProducto(p, true)}
          </div>
        `;}).join('')}
      </div>
    `;
  },

  renderOverlays() {
    return `
      <!-- Modal Confirmación con style explícito para evitar desbordes si falla Tailwind -->
      <div id="invModalConfirm" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity">
        <div id="invBtnConfirmBackdrop" class="fixed inset-0"></div>
        <div class="relative bg-white dark:bg-gray-800 rounded-2xl w-full p-6 text-center shadow-2xl border border-gray-100 dark:border-gray-700" style="max-width: 24rem;">
          <div class="w-14 h-14 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-exclamation-triangle text-2xl"></i>
          </div>
          <h3 id="invConfirmTitle" class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Eliminar producto</h3>
          <p id="invConfirmMessage" class="text-sm text-gray-500 dark:text-gray-400 mb-6 leading-relaxed"></p>
          <div class="flex gap-3">
            <button id="invBtnConfirmNo" class="flex-1 py-2.5 px-4 rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold transition">Cancelar</button>
            <button id="invBtnConfirmYes" class="flex-1 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold shadow-md shadow-red-500/20 transition">Eliminar</button>
          </div>
        </div>
      </div>

      <!-- Modal Crear Categoría -->
      <div id="modalCrearCategoria" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-[60] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl w-full p-6 space-y-4 border border-gray-200 dark:border-gray-700" style="max-width: 24rem;">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nueva Categoría</h3>
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
            <input id="inputCategoriaNombre" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
          </div>
          <div class="flex gap-2 pt-2">
            <button id="btnCancelarCat" class="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium">Cancelar</button>
            <button id="btnGuardarCat" class="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Crear Marca -->
      <div id="modalCrearMarca" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-[60] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl w-full p-6 space-y-4 border border-gray-200 dark:border-gray-700" style="max-width: 24rem;">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nueva Marca</h3>
          <div>
            <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
            <input id="inputMarcaNombre" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
          </div>
          <div class="flex gap-2 pt-2">
            <button id="btnCancelarMar" class="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium">Cancelar</button>
            <button id="btnGuardarMar" class="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Crear Proveedor -->
      <div id="modalCrearProveedor" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-[60] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl w-full p-6 space-y-4 border border-gray-200 dark:border-gray-700" style="max-width: 24rem;">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Nuevo Proveedor</h3>
          <div class="space-y-3">
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input id="inputProveedorNombre" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Contacto (Opcional)</label>
              <input id="inputProveedorContacto" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
            </div>
          </div>
          <div class="flex gap-2 pt-2">
            <button id="btnCancelarProv" class="flex-1 px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 text-sm font-medium">Cancelar</button>
            <button id="btnGuardarProv" class="flex-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Resultado Importación -->
      <div id="modalImportResult" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-[60] flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl w-full p-6 space-y-4 border border-gray-200 dark:border-gray-700" style="max-width: 28rem;">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">Resultado de Importación</h3>
          <div id="importResultBody"></div>
          <button id="btnCerrarImportResult" class="w-full px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">Cerrar</button>
        </div>
      </div>

      <!-- Modal Edición -->
      <div id="modalEditar" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div class="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl w-full p-4 sm:p-6 space-y-4 max-h-[92vh] overflow-y-auto shadow-xl" style="max-width: 42rem;">
          <h2 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <i class="fas fa-edit text-blue-600"></i> <span id="modalEditarTitulo">Editar Producto</span>
          </h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div class="sm:col-span-2 sm:col-span-1">
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre</label>
              <input id="editNombre" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">SKU</label>
              <input id="editSku" type="text" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Precio Costo</label>
              <input id="editPrecioCosto" type="number" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Precio Venta</label>
              <input id="editPrecioVenta" type="number" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300">Mínimo Stock</label>
                <label class="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                  <input id="editStockNoAplica" type="checkbox" class="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span>No aplica (Servicio)</span>
                </label>
              </div>
              <input id="editMinimoStock" type="number" placeholder="Ingrese mínimo de stock..." class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-700 disabled:cursor-not-allowed" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Puntos por Compra</label>
              <input id="editPuntos" type="number" min="0" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
              <div class="flex gap-2">
                <select id="editCategoria" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">Sin categoría</option>
                  ${this.state.categorias.map(c => `<option value="${c.id}">${this.esc(c.nombre)}</option>`).join('')}
                </select>
                <button class="btnCrearCategoria px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm" title="Crear nueva categoría"><i class="fas fa-plus"></i></button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Marca</label>
              <div class="flex gap-2">
                <select id="editMarca" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">Sin marca</option>
                  ${this.state.marcas.map(m => `<option value="${m.id}">${this.esc(m.nombre)}</option>`).join('')}
                </select>
                <button class="btnCrearMarca px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm" title="Crear nueva marca"><i class="fas fa-plus"></i></button>
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
              <div class="flex gap-2">
                <select id="editProveedor" class="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">Sin proveedor</option>
                  ${this.state.proveedores.map(p => `<option value="${p.id}">${this.esc(p.nombre)}</option>`).join('')}
                </select>
                <button class="btnCrearProveedor px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium text-sm" title="Crear nuevo proveedor"><i class="fas fa-plus"></i></button>
              </div>
            </div>
            <div class="sm:col-span-2">
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Imagen</label>
              <div id="imagenPreview" class="aspect-video sm:aspect-square max-h-40 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                <i class="fas fa-image text-4xl text-gray-400"></i>
              </div>
              <input id="editImagen" type="file" accept="image/*" class="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700" />
            </div>
          </div>
          <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <button id="btnCerrarEdicion" class="flex-1 px-4 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-600 font-medium">Cancelar</button>
            <button id="btnGuardarEdicion" class="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium"><i class="fas fa-check"></i> Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Gestión Stock -->
      <div id="modalStock" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
        <div class="bg-white dark:bg-gray-800 rounded-t-xl sm:rounded-xl w-full p-4 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto" style="max-width: 28rem;">
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <i class="fas fa-warehouse text-purple-600"></i> Gestionar Stock
          </h2>
          <div id="stockContent" class="space-y-3"></div>
          <div class="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            <button id="btnCerrarStock" class="flex-1 px-4 py-2.5 rounded-lg bg-gray-200 dark:bg-gray-600 font-medium">Cerrar</button>
            <button id="btnGuardarStock" class="flex-1 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium">Guardar</button>
          </div>
        </div>
      </div>

      <div id="invToast" class="hidden"></div>
    `;
  },

  renderUI() {
    this.container.innerHTML = `
      <div class="space-y-4 sm:space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Inventario</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión de productos y stock</p>
          </div>
          <div class="grid grid-cols-3 sm:flex sm:flex-wrap gap-2">
            <button id="btnVistaToggle" class="px-2 sm:px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs sm:text-sm font-medium transition">
              <i class="fas fa-th"></i><span class="hidden sm:inline ml-1">Vista Grid</span>
            </button>
            <button id="btnImportarExcel" class="px-2 sm:px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-xs sm:text-sm font-medium transition">
              <i class="fas fa-file-import"></i><span class="hidden sm:inline ml-1">Importar</span>
            </button>
            <button id="btnExportarExcel" class="px-2 sm:px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs sm:text-sm font-medium transition">
              <i class="fas fa-file-export"></i><span class="hidden sm:inline ml-1">Exportar</span>
            </button>
            <button id="btnCargarInventarioDoc" class="px-2 sm:px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm font-medium transition" title="Cargar assets/docs/Inventario.xlsx">
              <i class="fas fa-database"></i><span class="hidden sm:inline ml-1">Inventario.xlsx</span>
            </button>
            <button id="btnNuevoProducto" class="px-2 sm:px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs sm:text-sm font-medium transition col-span-1">
              <i class="fas fa-plus"></i><span class="hidden sm:inline ml-1">Nuevo</span>
            </button>
          </div>
        </div>

        <div class="bg-white dark:bg-gray-800 rounded-lg p-3 sm:p-4 border border-gray-200 dark:border-gray-700 space-y-3 sm:space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div class="sm:col-span-2 lg:col-span-1">
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Buscar</label>
              <div class="relative">
                <i class="fas fa-search absolute left-3 top-2.5 text-gray-400"></i>
                <input id="busqueda" type="text" placeholder="Nombre o SKU..."
                  class="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
                  value="${this.esc(this.state.busqueda)}" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Categoría</label>
              <select id="filtroCategoria" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm">
                <option value="">Todas</option>
                ${this.state.categorias.map(c => `<option value="${c.id}" ${this.state.filtro_categoria === String(c.id) ? 'selected' : ''}>${this.esc(c.nombre)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Marca</label>
              <select id="filtroMarca" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm">
                <option value="">Todas</option>
                ${this.state.marcas.map(m => `<option value="${m.id}" ${this.state.filtro_marca === String(m.id) ? 'selected' : ''}>${this.esc(m.nombre)}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Proveedor</label>
              <select id="filtroProveedor" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm">
                <option value="">Todos</option>
                ${this.state.proveedores.map(p => `<option value="${p.id}" ${this.state.filtro_proveedor === String(p.id) ? 'selected' : ''}>${this.esc(p.nombre)}</option>`).join('')}
              </select>
            </div>
          </div>
          <button id="btnBuscar" class="w-full sm:w-auto px-6 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-medium transition text-sm">
            <i class="fas fa-search"></i> Buscar
          </button>
        </div>

        ${!this.state.vistaGrid ? this.renderVistaTabla() : `
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
            ${this.state.productos.length === 0 ? `
              <div class="col-span-full bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
                <i class="fas fa-inbox text-3xl mb-2 block"></i><p>No hay productos</p>
              </div>
            ` : this.state.productos.map(p => {
              const esServicio = p.es_servicio === 1 || p.es_servicio === true || p.minimo_stock === null || p.minimo_stock === undefined || p.minimo_stock < 0;
              return `
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition">
                <div class="aspect-square bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  ${p.imagen_url ? `<img src="${this.esc(p.imagen_url)}" alt="" class="w-full h-full object-cover" />` : `<i class="fas fa-image text-4xl text-gray-400"></i>`}
                </div>
                <div class="p-3 sm:p-4 space-y-2">
                  <h3 class="font-semibold text-gray-900 dark:text-gray-100 truncate flex items-center gap-2">
                    <span class="truncate">${this.esc(p.nombre)}</span>
                    ${esServicio ? '<span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-600 text-white shadow-sm ring-1 ring-purple-400/30">Servicio</span>' : ''}
                  </h3>
                  <p class="text-xs text-gray-500">${this.esc(p.sku)}</p>
                  <div class="flex justify-between items-center text-sm">
                    <span class="text-gray-700 dark:text-gray-300 truncate">${this.esc(p.marca || 'Sin marca')}</span>
                    <span class="font-semibold text-green-600">$${p.precio_venta.toFixed(2)}</span>
                  </div>
                  <div class="flex gap-2 pt-1">
                    <button class="btn-editar flex-1 px-2 py-1.5 rounded text-xs bg-blue-500 text-white" data-id="${p.id}"><i class="fas fa-edit"></i></button>
                    <button class="btn-stock flex-1 px-2 py-1.5 rounded text-xs bg-purple-500 text-white" data-id="${p.id}"><i class="fas fa-warehouse"></i></button>
                    <button class="btn-eliminar flex-1 px-2 py-1.5 rounded text-xs bg-red-500 text-white" data-id="${p.id}"><i class="fas fa-trash"></i></button>
                  </div>
                </div>
              </div>
            `;}).join('')}
          </div>
        `}

        <div class="flex flex-col sm:flex-row gap-2 justify-center items-center py-2">
          <button id="btnPrevious" class="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm disabled:opacity-40" ${this.state.offset === 0 ? 'disabled' : ''}>
            <i class="fas fa-chevron-left"></i> Anterior
          </button>
          <span class="text-sm text-gray-600 dark:text-gray-400 text-center">
            ${this.state.offset + 1} – ${this.state.offset + this.state.productos.length}
          </span>
          <button id="btnNext" class="w-full sm:w-auto px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm disabled:opacity-40" ${this.state.productos.length < this.state.limite ? 'disabled' : ''}>
            Siguiente <i class="fas fa-chevron-right"></i>
          </button>
        </div>
      </div>

      ${this.renderOverlays()}
    `;
  },

  setupModalClose(modalId, closeButtonId = null) {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    const handleEsc = (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    };

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

  async sortTable(table, column, direction) {
    if (table !== 0) return;
    this.state.ordenar = ['sku', 'nombre', 'marca', 'categoria', 'precio_venta', 'puntos'][column] || 'id';
    this.state.direccion = direction === 1 ? 'asc' : 'desc';
    this.state.offset = 0;
    await this.cargarProductos();
    refreshWithFocus(this);
  },

  attachEvents() {
    sortableTables(this);
    this.setupModalClose('modalEditar', 'btnCerrarEdicion');
    this.setupModalClose('modalStock', 'btnCerrarStock');
    this.setupModalClose('modalImportarExcel', 'btnCancelarImport');
    this.setupModalClose('modalCrearCategoria', 'btnCancelarCat');
    this.setupModalClose('modalCrearMarca', 'btnCancelarMar');
    this.setupModalClose('modalCrearProveedor', 'btnCancelarProv');
    this.setupModalClose('invModalConfirm', 'invBtnConfirmNo');
    this.setupModalClose('modalImportResult', 'btnCerrarImportResult');

    const $ = (id) => document.getElementById(id);

    $('btnVistaToggle')?.addEventListener('click', () => {
      this.state.vistaGrid = !this.state.vistaGrid;
      this.renderUI();
      this.attachEvents();
    });

    $('btnBuscar')?.addEventListener('click', () => this.buscar());
    $('busqueda')?.addEventListener('input', e => {
      this.state.busqueda = e.target.value;
      this._productsRequest = (this._productsRequest || 0) + 1;
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.buscar(), 250);
    });
    $('busqueda')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.buscar(); });

    $('btnNext')?.addEventListener('click', () => {
      this.state.offset += this.state.limite;
      this.cargarProductos().then(() => { this.renderUI(); this.attachEvents(); });
    });

    $('btnPrevious')?.addEventListener('click', () => {
      this.state.offset = Math.max(0, this.state.offset - this.state.limite);
      this.cargarProductos().then(() => { this.renderUI(); this.attachEvents(); });
    });

    document.querySelectorAll('.btn-editar').forEach(btn => {
      btn.addEventListener('click', (e) => this.abrirEdicion(parseInt(e.currentTarget.dataset.id, 10)));
    });
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => this.eliminarProducto(parseInt(e.currentTarget.dataset.id, 10)));
    });
    document.querySelectorAll('.btn-stock').forEach(btn => {
      btn.addEventListener('click', (e) => this.abrirStock(parseInt(e.currentTarget.dataset.id, 10)));
    });

    const checkNoAplica = $('editStockNoAplica');
    const inputStock = $('editMinimoStock');
    if (checkNoAplica && inputStock) {
      checkNoAplica.addEventListener('change', () => {
        if (checkNoAplica.checked) {
          inputStock.value = '';
          inputStock.disabled = true;
        } else {
          inputStock.disabled = false;
          inputStock.value = '';
          inputStock.focus();
        }
      });
    }

    $('btnCerrarEdicion')?.addEventListener('click', () => $('modalEditar')?.classList.add('hidden'));
    $('btnGuardarEdicion')?.addEventListener('click', () => this.guardarEdicion());
    $('editImagen')?.addEventListener('change', (e) => this.previewImagen(e));

    $('btnCerrarStock')?.addEventListener('click', () => $('modalStock')?.classList.add('hidden'));
    $('btnGuardarStock')?.addEventListener('click', () => this.guardarStock());

    $('btnImportarExcel')?.addEventListener('click', () => $('modalImportarExcel')?.classList.remove('hidden'));
    $('btnExportarExcel')?.addEventListener('click', () => this.exportarExcel());
    $('btnCargarInventarioDoc')?.addEventListener('click', () => this.cargarPlantillaInventario());
    $('btnCargarInventarioDesdeModal')?.addEventListener('click', () => this.cargarPlantillaInventario());
    $('btnCancelarImport')?.addEventListener('click', () => this.cerrarModalImport());
    $('archivoExcel')?.addEventListener('change', (e) => this.leerArchivoExcel(e));
    $('btnConfirmarImport')?.addEventListener('click', () => this.importarExcel());

    const cerrarConfirm = () => {
      this._confirmCallback = null;
      $('invModalConfirm')?.classList.add('hidden');
    };
    
    $('invBtnConfirmYes')?.addEventListener('click', async () => {
      $('invModalConfirm')?.classList.add('hidden');
      if (this._confirmCallback) {
        const cb = this._confirmCallback;
        this._confirmCallback = null;
        await cb();
      }
    });
    
    $('invBtnConfirmNo')?.addEventListener('click', cerrarConfirm);
    $('invBtnConfirmBackdrop')?.addEventListener('click', cerrarConfirm);
    $('btnCerrarImportResult')?.addEventListener('click', () => $('modalImportResult')?.classList.add('hidden'));

    $('btnNuevoProducto')?.addEventListener('click', () => this.abrirNuevoProducto());

    document.querySelectorAll('.btnCrearCategoria').forEach(btn => {
      btn.addEventListener('click', () => $('modalCrearCategoria')?.classList.remove('hidden'));
    });
    $('btnCancelarCat')?.addEventListener('click', () => $('modalCrearCategoria')?.classList.add('hidden'));
    $('btnGuardarCat')?.addEventListener('click', () => this.crearCategoria());

    document.querySelectorAll('.btnCrearMarca').forEach(btn => {
      btn.addEventListener('click', () => $('modalCrearMarca')?.classList.remove('hidden'));
    });
    $('btnCancelarMar')?.addEventListener('click', () => $('modalCrearMarca')?.classList.add('hidden'));
    $('btnGuardarMar')?.addEventListener('click', () => this.crearMarca());

    document.querySelectorAll('.btnCrearProveedor').forEach(btn => {
      btn.addEventListener('click', () => $('modalCrearProveedor')?.classList.remove('hidden'));
    });
    $('btnCancelarProv')?.addEventListener('click', () => $('modalCrearProveedor')?.classList.add('hidden'));
    $('btnGuardarProv')?.addEventListener('click', () => this.crearProveedor());
  },

  async buscar() {
    this.state.busqueda = document.getElementById('busqueda')?.value || '';
    this.state.filtro_categoria = document.getElementById('filtroCategoria')?.value || '';
    this.state.filtro_marca = document.getElementById('filtroMarca')?.value || '';
    this.state.filtro_proveedor = document.getElementById('filtroProveedor')?.value || '';
    this.state.offset = 0;
    await this.cargarProductos();
    refreshWithFocus(this);
  },

  cerrarModalImport() {
    document.getElementById('modalImportarExcel')?.classList.add('hidden');
    this.state.datosExcel = null;
    const file = document.getElementById('archivoExcel');
    if (file) file.value = '';
    document.getElementById('previewExcel')?.classList.add('hidden');
    document.getElementById('importFileInfo')?.classList.add('hidden');
    const btn = document.getElementById('btnConfirmarImport');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-upload"></i> Importar'; }
  },

  eliminarProducto(id) {
    const producto = this.state.productos.find(p => p.id === id);
    if (!producto) return;
    this.openConfirm(`¿Deseas eliminar permanentemente "${producto.nombre}"?`, async () => {
      try {
        const res = await fetch(`/api/productos/${id}`, { method: 'DELETE', headers: api.getHeaders() });
        if (!res.ok) throw new Error('Error al eliminar');
        this.showToast('Producto eliminado');
        await this.cargarProductos();
        this.renderUI();
        this.attachEvents();
      } catch (e) {
        this.showToast(e.message, 'error');
      }
    }, 'Eliminar Producto');
  },

  abrirNuevoProducto() {
    this.state.producto_editando = 'nuevo';
    document.getElementById('modalEditarTitulo').textContent = 'Nuevo Producto';
    document.getElementById('editNombre').value = '';
    document.getElementById('editSku').value = '';
    document.getElementById('editSku').disabled = true;
    document.getElementById('editPrecioCosto').value = '';
    document.getElementById('editPrecioVenta').value = '';
    
    const checkNoAplica = document.getElementById('editStockNoAplica');
    const inputMinStock = document.getElementById('editMinimoStock');
    if (checkNoAplica && inputMinStock) {
      checkNoAplica.checked = false;
      inputMinStock.disabled = false;
      inputMinStock.value = '';
    }

    document.getElementById('editPuntos').value = '';
    document.getElementById('editCategoria').value = '';
    document.getElementById('editMarca').value = '';
    document.getElementById('editProveedor').value = '';
    document.getElementById('imagenPreview').innerHTML = '<i class="fas fa-image text-4xl text-gray-400"></i>';
    
    const editNombre = document.getElementById('editNombre');
    const editSku = document.getElementById('editSku');
    editNombre.oninput = () => {
      if (editNombre.value.trim()) {
        editSku.value = this.generarSku(editNombre.value);
      } else {
        editSku.value = '';
      }
    };
    
    document.getElementById('modalEditar').classList.remove('hidden');
  },

  abrirEdicion(id) {
    const producto = this.state.productos.find(p => p.id === id);
    if (!producto) return;
    this.state.producto_editando = id;
    document.getElementById('modalEditarTitulo').textContent = 'Editar Producto';
    document.getElementById('editNombre').value = producto.nombre;
    document.getElementById('editSku').value = producto.sku;
    document.getElementById('editSku').disabled = true;
    document.getElementById('editPrecioCosto').value = producto.precio_costo || '';
    document.getElementById('editPrecioVenta').value = producto.precio_venta || '';

    const checkNoAplica = document.getElementById('editStockNoAplica');
    const inputMinStock = document.getElementById('editMinimoStock');
    
    // Si el producto fue guardado con -1 o null, significa que es servicio
    const esServicio = producto.es_servicio === 1 || producto.es_servicio === true || producto.minimo_stock === null || producto.minimo_stock === undefined || producto.minimo_stock < 0;
    
    if (checkNoAplica && inputMinStock) {
      checkNoAplica.checked = esServicio;
      inputMinStock.disabled = esServicio;
      inputMinStock.value = esServicio ? '' : (producto.minimo_stock >= 0 ? producto.minimo_stock : '');
    }

    document.getElementById('editPuntos').value = producto.puntos || '';
    document.getElementById('editCategoria').value = producto.categoria_id || '';
    document.getElementById('editMarca').value = producto.marca_id || '';
    document.getElementById('editProveedor').value = producto.proveedor_id || '';
    document.getElementById('imagenPreview').innerHTML = producto.imagen_url
      ? `<img src="${producto.imagen_url}" alt="" class="w-full h-full object-cover" />`
      : '<i class="fas fa-image text-4xl text-gray-400"></i>';

    ['editPrecioCosto', 'editPrecioVenta', 'editMinimoStock', 'editPuntos'].forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.oninput = (e) => {
          if (e.target.value.startsWith('0') && e.target.value.length > 1) {
            e.target.value = e.target.value.substring(1);
          }
        };
      }
    });

    document.getElementById('modalEditar').classList.remove('hidden');
  },

  previewImagen(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      document.getElementById('imagenPreview').innerHTML = `<img src="${evt.target.result}" alt="" class="w-full h-full object-cover" />`;
    };
    reader.readAsDataURL(file);
  },

  async guardarEdicion() {
    if (!this.state.producto_editando) return;
    try {
      let imagen_url;
      const imagenInput = document.getElementById('editImagen');
      if (imagenInput?.files.length > 0) {
        const uploadFormData = new FormData();
        uploadFormData.append('imagen', imagenInput.files[0]);
        const uploadRes = await fetch('/api/upload/imagen', {
          method: 'POST',
          headers: { Authorization: `Bearer ${api.getToken()}` },
          body: uploadFormData
        });
        if (!uploadRes.ok) throw new Error('Error al subir imagen');
        imagen_url = (await uploadRes.json()).url;
      }

      const noAplicaStock = Boolean(document.getElementById('editStockNoAplica')?.checked);
      const stockInputRaw = document.getElementById('editMinimoStock')?.value.trim();
      
      let minimo_stock_final = 0;
      if (!noAplicaStock) {
        minimo_stock_final = (stockInputRaw !== '' && !isNaN(stockInputRaw)) ? parseInt(stockInputRaw, 10) : 0;
      }

      const body = {
        nombre: document.getElementById('editNombre').value.trim(),
        precio_costo: this.redondearPrecio(document.getElementById('editPrecioCosto').value),
        precio_venta: this.redondearPrecio(document.getElementById('editPrecioVenta').value),
        // Forzamos un -1 para indicar al backend que es un servicio y así evitar su valor default por defecto de "5" 
        minimo_stock: noAplicaStock ? -1 : minimo_stock_final,
        es_servicio: noAplicaStock ? 1 : 0,
        puntos: parseInt(document.getElementById('editPuntos').value, 10) || 0,
        categoria_id: document.getElementById('editCategoria').value ? parseInt(document.getElementById('editCategoria').value, 10) : null,
        marca_id: document.getElementById('editMarca').value ? parseInt(document.getElementById('editMarca').value, 10) : null,
        proveedor_id: document.getElementById('editProveedor').value ? parseInt(document.getElementById('editProveedor').value, 10) : null
      };
      if (imagen_url) body.imagen_url = imagen_url;

      if (this.state.producto_editando === 'nuevo') {
        body.sku = document.getElementById('editSku').value.trim();
        if (!body.sku || !body.nombre || !body.precio_venta) {
          this.showToast('SKU, nombre y precio de venta son requeridos', 'error');
          return;
        }
      }

      const url = this.state.producto_editando === 'nuevo'
        ? '/api/productos'
        : `/api/productos/${this.state.producto_editando}`;
      const response = await fetch(url, {
        method: this.state.producto_editando === 'nuevo' ? 'POST' : 'PUT',
        headers: api.getHeaders(),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar');
      }

      this.showToast(this.state.producto_editando === 'nuevo' ? 'Producto creado' : 'Producto actualizado');
      document.getElementById('modalEditar').classList.add('hidden');
      this.state.producto_editando = null;
      await this.cargarProductos();
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  },

  async abrirStock(id) {
    const producto = this.state.productos.find(p => p.id === id);
    if (!producto) return;

    const esServicio = producto.es_servicio === 1 || producto.es_servicio === true || producto.minimo_stock === null || producto.minimo_stock === undefined || producto.minimo_stock < 0;
    const btnGuardarStock = document.getElementById('btnGuardarStock');

    if (esServicio) {
      document.getElementById('stockContent').innerHTML = `
        <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">${this.esc(producto.nombre)} <span class="text-gray-500 font-mono text-sm">(${this.esc(producto.sku)})</span></p>
        <div class="p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg text-sm border border-purple-200 dark:border-purple-800 space-y-1">
          <div class="flex items-center gap-2 font-semibold">
            <i class="fas fa-concierge-bell"></i>
            <span>Servicio / Sin stock</span>
          </div>
          <p class="text-xs text-purple-600 dark:text-purple-400">Este ítem está configurado como servicio. No requiere control de unidades físicas ni emitirá alertas de bajo stock.</p>
        </div>
      `;
      if (btnGuardarStock) btnGuardarStock.classList.add('hidden');
      document.getElementById('modalStock').classList.remove('hidden');
      return;
    }

    if (btnGuardarStock) btnGuardarStock.classList.remove('hidden');

    const stocks = await Promise.all(this.state.sucursales.map(async (s) => {
      try {
        const res = await fetch(`/api/stock/${id}/${s.id}`, { headers: api.getHeaders() });
        const data = res.ok ? await res.json() : { cantidad: 0 };
        return { ...s, cantidad: data.cantidad || 0 };
      } catch {
        return { ...s, cantidad: 0 };
      }
    }));

    document.getElementById('stockContent').innerHTML = `
      <p class="font-semibold text-gray-900 dark:text-gray-100 truncate">${this.esc(producto.nombre)} <span class="text-gray-500 font-mono text-sm">(${this.esc(producto.sku)})</span></p>
      <div class="space-y-2">
        ${stocks.map(s => `
          <div class="flex items-center gap-3">
            <label class="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">${this.esc(s.nombre)}</label>
            <input type="number" class="stock-input w-20 sm:w-24 px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              data-producto="${id}" data-sucursal="${s.id}" value="${s.cantidad}" min="0" />
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('modalStock').classList.remove('hidden');
  },

  async guardarStock() {
    try {
      const inputs = document.querySelectorAll('.stock-input');
      for (const input of inputs) {
        await fetch(`/api/stock/${input.dataset.producto}/${input.dataset.sucursal}`, {
          method: 'PUT',
          headers: api.getHeaders(),
          body: JSON.stringify({ cantidad: parseInt(input.value, 10) || 0, tipo_movimiento: 'ajuste' })
        });
      }
      this.showToast(`Stock actualizado en ${inputs.length} sucursales`);
      document.getElementById('modalStock').classList.add('hidden');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  },

  leerArchivoExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        const normalizados = this.normalizarDatosExcel(jsonData);

        if (!normalizados.length) {
          this.state.datosExcel = null;
          this.showToast('No se encontraron filas válidas. Verificá la columna Nombre.', 'error');
          document.getElementById('btnConfirmarImport').disabled = true;
          return;
        }

        this.state.datosExcel = normalizados;
        this.mostrarPreviewImport(normalizados);
      } catch (error) {
        this.state.datosExcel = null;
        this.showToast('Error al leer Excel: ' + error.message, 'error');
      }
    };
    reader.onerror = () => this.showToast('No se pudo leer el archivo', 'error');
    reader.readAsArrayBuffer(file);
  },

  async importarExcel() {
    const datos = this.state.datosExcel;
    if (!Array.isArray(datos) || datos.length === 0) {
      this.showToast('No hay datos para importar. Seleccioná un archivo válido.', 'error');
      return;
    }

    const btn = document.getElementById('btnConfirmarImport');
    try {
      btn.disabled = true;
      btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Importando...';

      const response = await fetch('/api/import/productos', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ datos })
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Error al importar');

      this.cerrarModalImport();
      this.openResultadoImport(result);
      await this.cargarProductos();
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      this.showToast(error.message, 'error');
    } finally {
      if (btn) {
        btn.disabled = !this.state.datosExcel?.length;
        btn.innerHTML = '<i class="fas fa-upload"></i> Importar';
      }
    }
  }
};
