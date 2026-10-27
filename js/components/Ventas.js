import { searchText } from '../utils/table-utils.js';
import { api } from '../api-client.js';
import CierreCajaUtils from '../utils/cierre-caja-utils.js';
import { cierreCajaEmitter } from '../utils/cierre-caja-events.js';
import toast from '../utils/toast.js';

export default {
  state: {
    caja_actual: null,
    carrito: [],
    productos: [],
    clientes: [],
    barberos: [],
    sucursales: [],
    cliente_seleccionado: null,
    barbero_seleccionado: null,
    sucursal_seleccionada: null,
    busqueda_producto: '',
    busqueda_cliente: '',
    historial_ventas: [],
    saldoInicialApertura: 1000,
    monto_anterior_sugerido: 0,
    saldo_inicial_siguiente: 0,
    transferencia_admin: 0,
    movimiento_tipo: 'egreso',
    movimiento_categoria: 'compra',
    movimiento_monto: 0,
    movimiento_descripcion: '',
    resumen_caja: null,
    movimientos_caja: [],
    historial_cajas: [],
    aplicar_iva: false
  },

  async render(container, { params }) {
    this.container = container;

    try {
      await Promise.all([
        this.cargarProductos(),
        this.cargarClientes(),
        this.cargarBarberos(),
        this.cargarSucursales(),
        this.verificarCajaAbierta()
      ]);

      if (this.state.caja_actual) {
        await Promise.all([
          this.cargarResumenCaja(this.state.caja_actual.id),
          this.cargarMovimientosCaja(this.state.caja_actual.id)
        ]);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
    }

    this.renderUI();
    this.attachEvents();
  },

  async cargarProductos() {
    this.state.productos = await api.getAll('/productos');
  },

  async cargarClientes() {
    this.state.clientes = await api.getAll('/clientes');
  },

  async cargarBarberos() {
    this.state.barberos = await api.getAll('/barberos');
  },

  esc(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  opcionesClientes() {
    const query = searchText(this.state.busqueda_cliente);
    return this.state.clientes.filter(c => c.id === this.state.cliente_seleccionado ||
      searchText(`${c.nombre} ${c.apellido || ''} ${c.telefono || ''}`).includes(query))
      .map(c => `<option value="${c.id}" ${c.id === this.state.cliente_seleccionado ? 'selected' : ''}>${this.esc(c.nombre)} ${this.esc(c.apellido)}${c.telefono ? ' · ' + this.esc(c.telefono) : ''}</option>`).join('');
  },

  async cargarSucursales() {
    try {
      const response = await fetch('/api/sucursales', { headers: api.getHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.state.sucursales = await response.json();
      if (this.state.sucursales.length > 0) {
        this.state.sucursal_seleccionada = this.state.sucursales[0].id;
      }
    } catch (error) {
      console.error('Error cargando sucursales:', error);
    }
  },

  async verificarCajaAbierta() {
    this.state.caja_actual = await CierreCajaUtils.verificarCajaAbierta();
  },

  renderUI() {
    this.container.innerHTML = `
      <div class="space-y-6">
        <!-- HEADER -->
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Módulo de Ventas</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Procesamiento de pedidos y pagos</p>
          </div>
          <div class="flex items-center gap-2">
            ${this.state.caja_actual ? `
              <span class="px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100 font-semibold text-sm">
                <i class="fas fa-check-circle"></i> Caja Abierta (ID: ${this.state.caja_actual.id})
              </span>
            ` : ''}
            <button id="btnCajaControl" class="px-4 py-2 rounded-lg ${this.state.caja_actual ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white font-medium transition">
              <i class="fas fa-cash-register"></i> ${this.state.caja_actual ? 'Administrar Caja' : 'Abrir / Cerrar Caja'}
            </button>
            <button id="btnHistorialCajas" class="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition">
              <i class="fas fa-history"></i> Historial
            </button>
          </div>
        </div>

        ${!this.state.caja_actual ? `
          <div class="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
              <i class="fas fa-info-circle text-blue-600"></i> No hay caja abierta
            </h2>
            <p class="text-gray-600 dark:text-gray-400">Para iniciar ventas, abre caja. La primera apertura se realiza desde el mismo proceso de venta o con el botón de caja.</p>
            <div class="mt-4">
              <button id="btnCajaControlSecondary" class="w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold transition">
                <i class="fas fa-cash-register mr-2"></i> Abrir / Administrar Caja
              </button>
            </div>
          </div>
        ` : ''}

        <!-- INTERFAZ DE VENTAS -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- COLUMNA IZQUIERDA -->
            <div class="lg:col-span-2 space-y-4">
              <!-- BÚSQUEDA DE PRODUCTOS -->
              <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                  <i class="fas fa-search"></i> Buscar Producto
                </h3>
                
                <div class="space-y-3">
                  <div class="relative">
                    <i class="fas fa-search absolute left-3 top-3 text-gray-400"></i>
                    <input id="busquedaProducto" type="text" placeholder="Nombre o SKU..." 
                      class="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                      value="${this.state.busqueda_producto}" />
                  </div>
                  
                  <div id="productosLista" class="space-y-2 max-h-64 overflow-y-auto">
                    ${this.state.productos
                      .filter(p => !this.state.busqueda_producto || 
                        p.nombre.toLowerCase().includes(this.state.busqueda_producto.toLowerCase()) ||
                        p.sku.toLowerCase().includes(this.state.busqueda_producto.toLowerCase()))
                      .slice(0, 20)
                      .map(p => `
                        <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition cursor-pointer border-l-4 border-transparent hover:border-blue-500">
                          <div class="flex-1 min-w-0">
                            <div class="font-semibold text-gray-900 dark:text-gray-100 truncate">${p.nombre}</div>
                            <div class="text-xs text-gray-500 dark:text-gray-400">${p.sku} • $${p.precio_venta.toFixed(2)}</div>
                          </div>
                          <button class="btn-agregar ml-2 px-3 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition" data-id="${p.id}">
                            <i class="fas fa-plus"></i> Agregar
                          </button>
                        </div>
                      `).join('')}
                  </div>
                </div>
              </div>

              <!-- CLIENTE -->
              <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <i class="fas fa-user"></i> Cliente
                  </h3>
                  <button id="btnNuevoClienteVentas" class="px-3 py-1 rounded text-xs bg-green-600 text-white hover:bg-green-700 transition">
                    <i class="fas fa-plus"></i> Nuevo
                  </button>
                </div>
                
                <input id="buscarClienteVenta" type="search" aria-label="Buscar cliente por nombre o teléfono" placeholder="Buscar cliente por nombre o teléfono" value="${this.esc(this.state.busqueda_cliente)}" class="w-full px-3 py-2 mb-2 rounded-lg border dark:bg-gray-700" />
                <select id="clienteSeleccionar" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">Consumidor Final</option>
                  ${this.opcionesClientes()}
                </select>
              </div>

              <!-- BARBERO -->
              <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                <div class="flex items-center justify-between mb-3">
                  <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <i class="fas fa-scissors"></i> Barbero a cargo
                  </h3>
                  <button id="btnNuevoBarberoVentas" class="px-3 py-1 rounded text-xs bg-purple-600 text-white hover:bg-purple-700 transition">
                    <i class="fas fa-plus"></i> Nuevo
                  </button>
                </div>
                
                <select id="barberoSeleccionar" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                  <option value="">-- Seleccionar barbero --</option>
                  ${this.state.barberos.map(b => `<option value="${b.id}" ${b.id === this.state.barbero_seleccionado ? 'selected' : ''}>${b.nombre} ${b.apellido} (${b.codigo_barbero})</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- COLUMNA DERECHA: CARRITO -->
            <div class="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 h-fit sticky top-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <i class="fas fa-shopping-cart"></i> Carrito
                <span class="ml-auto text-sm font-normal bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100 px-2 py-1 rounded">${this.state.carrito.length}</span>
              </h3>
              
              <div id="carritoItems" class="space-y-2 max-h-96 overflow-y-auto mb-4">
                ${this.state.carrito.length === 0 ? `
                  <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                    <i class="fas fa-inbox text-2xl mb-2 block"></i>
                    <p>Carrito vacío</p>
                  </div>
                ` : this.state.carrito.map((item, idx) => `
                  <div class="flex items-center justify-between p-2 rounded-lg bg-gray-50 dark:bg-gray-700 border-l-4 border-blue-500">
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">${item.nombre}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">${item.cantidad} x $${item.precio_unitario.toFixed(2)}</div>
                    </div>
                    <div class="text-right ml-2">
                      <div class="font-bold text-green-600 dark:text-green-400 text-sm">$${(item.cantidad * item.precio_unitario).toFixed(2)}</div>
                      <button class="btn-eliminar text-xs text-red-500 hover:text-red-700 transition" data-index="${idx}">
                        <i class="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div class="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2 bg-gray-50 dark:bg-gray-700 -m-4 p-4 rounded-b-lg">
                <div class="flex justify-between text-gray-700 dark:text-gray-300 text-sm">
                  <span>Subtotal:</span>
                  <span>$${this.calcularSubtotal().toFixed(2)}</span>
                </div>
                
                <div class="flex items-center justify-between">
                  <label class="flex items-center gap-2 text-gray-700 dark:text-gray-300 text-sm cursor-pointer">
                    <input id="aplicarIVACheck" type="checkbox" ${this.state.aplicar_iva ? 'checked' : ''} class="w-4 h-4 rounded" />
                    <span>Aplicar IVA (21%)</span>
                  </label>
                  <span id="ivaAmount" class="text-gray-700 dark:text-gray-300 text-sm">$${(this.state.aplicar_iva ? this.calcularSubtotal() * 0.21 : 0).toFixed(2)}</span>
                </div>
                
                <div class="flex justify-between text-lg font-bold text-gray-900 dark:text-gray-100 pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span>Total:</span>
                  <span class="text-green-600 dark:text-green-400">$${(this.calcularSubtotal() * (this.state.aplicar_iva ? 1.21 : 1)).toFixed(2)}</span>
                </div>
              </div>

              <button id="btnProcesarVenta" class="w-full mt-4 px-4 py-3 rounded-lg bg-green-600 text-white hover:bg-green-700 font-bold transition" 
                ${this.state.carrito.length === 0 ? 'disabled' : ''}>
                <i class="fas fa-check"></i> ${this.state.caja_actual ? 'Procesar Venta' : 'Procesar Venta y abrir caja'}
              </button>
              ${!this.state.caja_actual ? `
                <p class="mt-3 text-sm text-gray-500 dark:text-gray-400">La primera venta abrirá caja automáticamente con saldo inicial de $${this.state.saldoInicialApertura.toFixed(2)}.</p>
              ` : ''}
            </div>
          </div>
      </div>

      <!-- MODAL CAJA CONTROL -->
      <div id="modalCajaControl" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <i class="fas fa-cash-register text-green-600"></i> Control de Caja
              </h2>
              <p class="text-sm text-gray-500 dark:text-gray-400">Apertura, cierre y resumen de movimientos.</p>
            </div>
            <button id="btnCerrarModalCaja" class="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"><i class="fas fa-times fa-lg"></i></button>
          </div>

          ${this.state.caja_actual ? `
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div class="space-y-4">
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p class="text-sm font-semibold text-blue-800 dark:text-blue-100 mb-2">Resumen rápido</p>
                  <p class="text-sm text-gray-700 dark:text-gray-300">Saldo inicial: $${(this.state.caja_actual.monto_inicial || 0).toFixed(2)}</p>
                  <p class="text-sm text-gray-700 dark:text-gray-300">Ventas totales: $${(this.state.resumen_caja?.total_ventas || 0).toFixed(2)}</p>
                  <p class="text-sm text-gray-700 dark:text-gray-300">Egresos: $${(this.state.resumen_caja?.total_egresos || 0).toFixed(2)}</p>
                  <p class="text-sm text-gray-700 dark:text-gray-300">Ingresos adicionales: $${(this.state.resumen_caja?.total_ingresos_movimientos || 0).toFixed(2)}</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Efectivo</p>
                    <p class="text-xl font-bold text-green-700 dark:text-green-300">$${(this.state.resumen_caja?.pagos?.efectivo || 0).toFixed(2)}</p>
                  </div>
                  <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Tarjeta</p>
                    <p class="text-xl font-bold text-blue-700 dark:text-blue-300">$${(this.state.resumen_caja?.pagos?.tarjeta || 0).toFixed(2)}</p>
                  </div>
                  <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                    <p class="text-xs uppercase text-gray-500 dark:text-gray-400">Transferencia</p>
                    <p class="text-xl font-bold text-purple-700 dark:text-purple-300">$${(this.state.resumen_caja?.pagos?.transferencia || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div class="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-700">
                  <p class="text-sm text-yellow-800 dark:text-yellow-100">Total esperado en efectivo: <strong>$${(this.state.resumen_caja?.expected_cash || 0).toFixed(2)}</strong></p>
                </div>
              </div>

              <div class="space-y-4">
                <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
                  <h3 class="font-semibold mb-2 text-gray-900 dark:text-white">Registrar movimiento</h3>
                  <div class="grid grid-cols-1 gap-3">
                    <select id="movimientoTipo" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                      <option value="egreso">Egreso</option>
                      <option value="ingreso">Ingreso</option>
                    </select>
                    <input id="movimientoCategoria" type="text" placeholder="Categoría (compra, otros...)" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                    <div class="relative">
                      <span class="absolute left-3 top-2 text-gray-500">$</span>
                      <input id="movimientoMonto" type="number" step="0.01" placeholder="Monto" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                    </div>
                    <textarea id="movimientoDescripcion" rows="2" placeholder="Descripción" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"></textarea>
                    <button id="btnRegistrarMovimiento" class="w-full px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition">Guardar movimiento</button>
                  </div>
                </div>

                <div class="p-4 rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 max-h-72 overflow-y-auto">
                  <h3 class="font-semibold mb-3 text-gray-900 dark:text-white">Movimientos recientes</h3>
                  <div id="movimientosCajaLista" class="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    ${this.state.movimientos_caja.length ? this.state.movimientos_caja.map(m => `
                      <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <div class="flex justify-between gap-2">
                          <div><strong>${m.tipo.toUpperCase()}</strong> • ${m.categoria || 'Sin categoría'}</div>
                          <div>$${Number(m.monto).toFixed(2)}</div>
                        </div>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${m.descripcion || ''}</p>
                        <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">${new Date(m.fecha_movimiento).toLocaleString()}</p>
                      </div>
                    `).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400">No hay movimientos registrados.</p>'}
                  </div>
                </div>
              </div>
            </div>

            ${(() => {
              const resumen = this.state.resumen_caja;
              const efectivoEsp = (resumen?.expected_cash || 0);
              const transEsp = (resumen?.pagos?.transferencia || 0);
              const tarjEsp = (resumen?.pagos?.tarjeta || 0) + (resumen?.pagos?.cheque || 0);
              const totalEsp = efectivoEsp + transEsp + tarjEsp;
              return `
            <div class="space-y-3">
              <p class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest border-b border-gray-200 dark:border-gray-700 pb-2">
                Verificación de cierre
              </p>

              <!-- Efectivo -->
              <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <i class="fas fa-money-bill-wave text-green-500 mr-1"></i> Efectivo
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">Sistema: <strong class="text-gray-700 dark:text-gray-200">$${efectivoEsp.toFixed(2)}</strong></span>
                </div>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                  <input id="efectivoReal" type="number" step="0.01" placeholder="Real contado..."
                    class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div id="difEfectivo" class="text-xs text-gray-400 dark:text-gray-500">Ingresa el efectivo contado en caja</div>
              </div>

              <!-- Transferencia -->
              <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <i class="fas fa-exchange-alt text-purple-500 mr-1"></i> Transferencia
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">Sistema: <strong class="text-gray-700 dark:text-gray-200">$${transEsp.toFixed(2)}</strong></span>
                </div>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                  <input id="transferenciaReal" type="number" step="0.01" placeholder="Real recibido..."
                    class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div id="difTransferencia" class="text-xs text-gray-400 dark:text-gray-500">Ingresa el total de transferencias recibidas</div>
              </div>

              <!-- Tarjeta y Cheque -->
              <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 space-y-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    <i class="fas fa-credit-card text-blue-500 mr-1"></i> Tarjeta y Cheque
                  </span>
                  <span class="text-xs text-gray-500 dark:text-gray-400">Sistema: <strong class="text-gray-700 dark:text-gray-200">$${tarjEsp.toFixed(2)}</strong></span>
                </div>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                  <input id="tarjetaReal" type="number" step="0.01" placeholder="Real cobrado..."
                    class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <div id="difTarjeta" class="text-xs text-gray-400 dark:text-gray-500">Ingresa el total cobrado con tarjeta y cheque</div>
              </div>

              <!-- Resumen total -->
              <div class="p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 space-y-1">
                <div class="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>Total esperado:</span>
                  <strong>$${totalEsp.toFixed(2)}</strong>
                </div>
                <div class="flex justify-between text-sm text-gray-700 dark:text-gray-300">
                  <span>Total real:</span>
                  <strong id="totalRealCierre">$0.00</strong>
                </div>
                <div id="estadoCierre" class="text-sm font-semibold text-gray-400 dark:text-gray-500 pt-1">—</div>
              </div>

              <!-- Monto inicial del día siguiente -->
              <div>
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Monto inicial del día siguiente</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                  <input id="montoInicialManana" type="number" step="0.01" placeholder="0" value="${this.state.saldo_inicial_siguiente || 0}"
                    class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                </div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Monto que se tomará al abrir caja mañana.</p>
              </div>
            </div>`;
            })()}

            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Observaciones</label>
              <textarea id="closeObservaciones" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Notas adicionales..." rows="3"></textarea>
            </div>

            <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button id="btnConfirmarCierre" class="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition">
                <i class="fas fa-check"></i> Cerrar Caja
              </button>
              <button id="btnCancelarCierre" class="flex-1 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:opacity-90 font-medium transition">
                <i class="fas fa-times"></i> Cancelar
              </button>
            </div>
          ` : `
            <div class="space-y-4">
              ${this.state.monto_anterior_sugerido > 0 ? `
                <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4 rounded-lg">
                  <p class="text-sm text-green-900 dark:text-green-100 font-semibold mb-1">
                    <i class="fas fa-history mr-2"></i>Monto anterior (del cierre anterior)
                  </p>
                  <p class="text-2xl font-bold text-green-700 dark:text-green-400">$${this.state.monto_anterior_sugerido.toFixed(2)}</p>
                </div>
              ` : `
                <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p class="text-sm text-blue-800 dark:text-blue-100 font-semibold mb-2">Apertura de caja</p>
                  <p class="text-sm text-gray-700 dark:text-gray-300">Primera apertura del día. Ingresa el saldo inicial.</p>
                </div>
              `}

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Sucursal</label>
                  <select id="sucursalCaja" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                    ${this.state.sucursales.map(s => `<option value="${s.id}">${s.nombre}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Saldo inicial ${this.state.monto_anterior_sugerido > 0 ? '(sugerido)' : ''}</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500">$</span>
                    <input id="montoInicial" type="number" step="0.01" value="${(this.state.monto_anterior_sugerido || this.state.saldoInicialApertura).toFixed(2)}" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
                  </div>
                </div>
              </div>

              <button id="btnConfirmarAbrirCaja" class="w-full px-4 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-bold transition">
                <i class="fas fa-play mr-2"></i> Confirmar saldo inicial y abrir caja
              </button>
            </div>
          `}
        </div>
      </div>

      <!-- MODAL PROCESAR VENTA -->
      <div id="modalProcesarVenta" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <i class="fas fa-credit-card text-green-600"></i> Procesar Venta
          </h2>
          
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Medio de Pago</label>
              <select id="medioPago" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>

            <div id="seccionEfectivo" class="space-y-3">
              <div>
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Efectivo Recibido</label>
                <input id="inputEfectivoRecibido" type="number" placeholder="0.00" min="0" step="0.01" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
                <p class="text-sm text-blue-800 dark:text-blue-100">
                  <strong>Vuelto a Dar:</strong> $<span id="vueltoDisplay">0.00</span>
                </p>
              </div>
            </div>

            <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <p class="text-sm text-green-800 dark:text-green-100">
                <strong>Subtotal:</strong> $<span id="ventaSubtotalDisplay">0.00</span><br>
                <strong>IVA (21%):</strong> $<span id="ventaIVADisplay">0.00</span><br>
                <strong class="text-lg">Total:</strong> <span id="ventaTotalDisplay" class="font-bold text-lg">$0.00</span><br>
                <strong>Ítems:</strong> <span id="ventaItemsDisplay">0</span>
              </p>
            </div>
          </div>

          <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button id="btnConfirmarVenta" class="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition">
              <i class="fas fa-check"></i> Confirmar
            </button>
            <button id="btnCancelarVenta" class="flex-1 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:opacity-90 font-medium transition">
              <i class="fas fa-times"></i> Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL NUEVO CLIENTE -->
      <div id="modalNuevoClienteVentas" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
          <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <i class="fas fa-user-plus text-blue-600"></i> Nuevo Cliente
          </h2>
          
          <div class="space-y-3">
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
              <input id="nuevoCliNombre" type="text" placeholder="Nombre" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Apellido *</label>
              <input id="nuevoCliApellido" type="text" placeholder="Apellido" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Teléfono *</label>
              <input id="nuevoCliTelefono" type="text" placeholder="Teléfono" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email (Opcional)</label>
              <input id="nuevoCliEmail" type="email" placeholder="Email" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
          </div>

          <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button id="btnConfirmarNuevoCliente" class="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition">
              <i class="fas fa-check"></i> Guardar
            </button>
            <button id="btnCancelarNuevoCliente" class="flex-1 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 hover:opacity-90 font-medium transition">
              <i class="fas fa-times"></i> Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- Modal Nuevo Barbero desde Ventas -->
      <div id="modalNuevoBarberoVentas" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
          <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <i class="fas fa-scissors text-purple-600"></i> Nuevo Barbero
          </h2>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
                <input id="nuevoBarNombre" type="text" placeholder="Nombre" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Apellido *</label>
                <input id="nuevoBarApellido" type="text" placeholder="Apellido" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Teléfono *</label>
              <input id="nuevoBarTelefono" type="text" placeholder="Teléfono" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Email</label>
              <input id="nuevoBarEmail" type="email" placeholder="Email (opcional)" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
            </div>
          </div>
          <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button id="btnConfirmarNuevoBarbero" class="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition">
              <i class="fas fa-check"></i> Guardar
            </button>
            <button id="btnCancelarNuevoBarbero" class="flex-1 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium transition">
              <i class="fas fa-times"></i> Cancelar
            </button>
          </div>
        </div>
      </div>

      <!-- MODAL HISTORIAL DE CAJAS -->
      <div id="modalHistorialCajas" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg w-full max-w-5xl p-6 space-y-4 max-h-[90vh] flex flex-col">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <i class="fas fa-history text-indigo-600"></i> Historial de Cajas
              </h2>
              <p class="text-xs text-gray-500 dark:text-gray-400"><span id="histConteo">0</span> cierres encontrados</p>
            </div>
            <button id="btnCerrarModalHistorial" class="text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"><i class="fas fa-times fa-lg"></i></button>
          </div>

          <div class="flex flex-wrap items-end gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
            <div>
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Desde</label>
              <input id="histFechaInicio" type="date" class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Hasta</label>
              <input id="histFechaFin" type="date" class="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm" />
            </div>
            <button id="btnFiltrarHistorial" class="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition">
              <i class="fas fa-filter mr-1"></i>Filtrar
            </button>
            <button id="btnLimpiarHistorial" class="px-4 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg text-sm font-semibold transition">
              <i class="fas fa-times mr-1"></i>Limpiar
            </button>
          </div>

          <div class="overflow-y-auto flex-1 rounded-lg border border-gray-200 dark:border-gray-700">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 sticky top-0">
                <tr>
                  <th class="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Fecha / Hora</th>
                  <th class="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Sucursal</th>
                  <th class="px-3 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Usuario</th>
                  <th class="px-3 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Esperado</th>
                  <th class="px-3 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Real</th>
                  <th class="px-3 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Estado</th>
                  <th class="px-3 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">PDF</th>
                </tr>
              </thead>
              <tbody id="historialCajasContenido" class="divide-y divide-gray-100 dark:divide-gray-700">
                <tr><td colspan="7" class="px-3 py-8 text-center text-gray-400 dark:text-gray-500">Cargando...</td></tr>
              </tbody>
            </table>
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
    // Configurar cierre de modales con ESC y click fuera
    this.setupModalClose('modalCajaControl', 'btnCerrarModalCaja');
    this.setupModalClose('modalProcesarVenta', 'btnCancelarVenta');
    this.setupModalClose('modalNuevoClienteVentas', 'btnCancelarNuevoCliente');
    this.setupModalClose('modalNuevoBarberoVentas', 'btnCancelarNuevoBarbero');
    this.setupModalClose('modalHistorialCajas', 'btnCerrarModalHistorial');

    document.getElementById('btnCajaControl')?.addEventListener('click', () => this.abrirModalCajaControl());
    document.getElementById('btnCajaControlSecondary')?.addEventListener('click', () => this.abrirModalCajaControl());
    document.getElementById('btnCerrarModalCaja')?.addEventListener('click', () => this.cerrarModalCaja());
    document.getElementById('btnCancelarCierre')?.addEventListener('click', () => this.cerrarModalCaja());
    document.getElementById('btnConfirmarAbrirCaja')?.addEventListener('click', () => this.confirmarAbrirCaja());
    document.getElementById('btnConfirmarCierre')?.addEventListener('click', () => this.confirmarCierre());
    document.getElementById('btnRegistrarMovimiento')?.addEventListener('click', () => this.registrarMovimientoCaja());

    // Búsqueda de productos
    document.getElementById('busquedaProducto')?.addEventListener('input', (e) => {
      this.state.busqueda_producto = e.target.value;
      this.actualizarListaProductos();
    });

    // Agregar productos
    document.querySelectorAll('.btn-agregar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productoId = parseInt(e.currentTarget.dataset.id);
        this.agregarAlCarrito(productoId);
      });
    });

    // Eliminar del carrito
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.currentTarget.dataset.index);
        this.state.carrito.splice(index, 1);
        this.renderUI();
        this.attachEvents();
      });
    });

    document.getElementById('buscarClienteVenta')?.addEventListener('input', e => {
      this.state.busqueda_cliente = e.target.value;
      const select = document.getElementById('clienteSeleccionar');
      select.innerHTML = '<option value="">Consumidor Final</option>' + this.opcionesClientes();
    });

    // Cliente
    document.getElementById('clienteSeleccionar')?.addEventListener('change', (e) => {
      this.state.cliente_seleccionado = e.target.value ? parseInt(e.target.value) : null;
    });

    // Barbero
    document.getElementById('barberoSeleccionar')?.addEventListener('change', (e) => {
      this.state.barbero_seleccionado = e.target.value ? parseInt(e.target.value) : null;
    });

    // IVA
    document.getElementById('aplicarIVACheck')?.addEventListener('change', (e) => {
      this.state.aplicar_iva = e.target.checked;
      document.getElementById('ivaAmount').textContent = `$${(this.state.aplicar_iva ? this.calcularSubtotal() * 0.21 : 0).toFixed(2)}`;
      
      const subtotal = this.calcularSubtotal();
      const totalSpan = document.querySelector('.text-green-600.dark\\:text-green-400');
      if (totalSpan) {
        totalSpan.textContent = `$${(subtotal * (this.state.aplicar_iva ? 1.21 : 1)).toFixed(2)}`;
      }
    });

    // Procesar venta
    document.getElementById('btnProcesarVenta')?.addEventListener('click', () => {
      if (this.state.carrito.length === 0) {
        toast.warning('El carrito está vacío');
        return;
      }
      this.abrirModalVenta();
    });

    document.getElementById('btnCancelarVenta')?.addEventListener('click', () => {
      document.getElementById('modalProcesarVenta').classList.add('hidden');
    });

    document.getElementById('btnConfirmarVenta')?.addEventListener('click', () => this.confirmarVenta());

    // Medio de pago - mostrar/ocultar sección de efectivo
    document.getElementById('medioPago')?.addEventListener('change', (e) => {
      const esEfectivo = e.target.value === 'efectivo';
      const seccion = document.getElementById('seccionEfectivo');
      if (seccion) {
        seccion.style.display = esEfectivo ? 'block' : 'none';
      }
      if (esEfectivo) {
        document.getElementById('inputEfectivoRecibido').value = '';
        document.getElementById('vueltoDisplay').textContent = '0.00';
      }
    });

    // Calcular vuelto cuando cambia el efectivo recibido
    document.getElementById('inputEfectivoRecibido')?.addEventListener('input', (e) => {
      this.actualizarVuelto();
    });

    // Nuevo cliente en ventas
    document.getElementById('btnNuevoClienteVentas')?.addEventListener('click', () => this.abrirModalNuevoClienteVentas());
    document.getElementById('btnCancelarNuevoCliente')?.addEventListener('click', () => this.cerrarModalNuevoClienteVentas());
    document.getElementById('btnConfirmarNuevoCliente')?.addEventListener('click', () => this.guardarNuevoClienteVentas());

    // Nuevo barbero en ventas
    document.getElementById('btnNuevoBarberoVentas')?.addEventListener('click', () => this.abrirModalNuevoBarberoVentas());
    document.getElementById('btnCancelarNuevoBarbero')?.addEventListener('click', () => document.getElementById('modalNuevoBarberoVentas')?.classList.add('hidden'));
    document.getElementById('btnConfirmarNuevoBarbero')?.addEventListener('click', () => this.guardarNuevoBarberoVentas());

    // Historial de cajas
    document.getElementById('btnHistorialCajas')?.addEventListener('click', () => this.abrirModalHistorialCajas());

    // Actualización en tiempo real de diferencias al escribir en los campos de cierre
    ['efectivoReal', 'transferenciaReal', 'tarjetaReal'].forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.addEventListener('input', () => this.actualizarDiferencias());
      }
    });
  },

  actualizarListaProductos() {
    const listElement = document.getElementById('productosLista');
    if (!listElement) return;
    
    const productosHTML = this.state.productos
      .filter(p => !this.state.busqueda_producto || 
        p.nombre.toLowerCase().includes(this.state.busqueda_producto.toLowerCase()) ||
        p.sku.toLowerCase().includes(this.state.busqueda_producto.toLowerCase()))
      .slice(0, 20)
      .map(p => `
        <div class="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition cursor-pointer border-l-4 border-transparent hover:border-blue-500">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-900 dark:text-gray-100 truncate">${p.nombre}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${p.sku} • $${p.precio_venta.toFixed(2)}</div>
          </div>
          <button class="btn-agregar ml-2 px-3 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition" data-id="${p.id}">
            <i class="fas fa-plus"></i> Agregar
          </button>
        </div>
      `).join('');
    
    listElement.innerHTML = productosHTML;
    
    // Re-adjuntar eventos de agregar al carrito
    document.querySelectorAll('.btn-agregar').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productoId = parseInt(e.currentTarget.dataset.id);
        this.agregarAlCarrito(productoId);
      });
    });
  },

  agregarAlCarrito(productoId) {
    const producto = this.state.productos.find(p => p.id === productoId);
    if (!producto) return;

    const itemExistente = this.state.carrito.find(item => item.producto_id === productoId);
    if (itemExistente) {
      itemExistente.cantidad++;
    } else {
      this.state.carrito.push({
        producto_id: productoId,
        nombre: producto.nombre,
        precio_unitario: producto.precio_venta,
        cantidad: 1
      });
    }

    this.renderUI();
    this.attachEvents();
  },

  calcularSubtotal() {
    return this.state.carrito.reduce((sum, item) => sum + (item.cantidad * item.precio_unitario), 0);
  },

  async confirmarAbrirCaja() {
    const montoIngresado = parseFloat(document.getElementById('montoInicial').value);
    const sucursalId = parseInt(document.getElementById('sucursalCaja').value);

    if (isNaN(montoIngresado) || montoIngresado < 0) {
      toast.warning('Ingresa un monto inicial válido');
      return;
    }

    try {
      const response = await fetch('/api/cajas/abrir', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({
          sucursal_id: sucursalId,
          monto_inicial: montoIngresado
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al abrir caja');
      }

      const data = await response.json();
      // IMPORTANTE: Usar siempre data.monto_inicial del servidor (que incluye el cierre anterior)
      // NO usar el monto que el usuario ingresó
      this.state.caja_actual = { 
        id: data.caja_id, 
        monto_inicial: data.monto_inicial,  // ← USAR VALOR DEL SERVIDOR
        sucursal_id: sucursalId 
      };
      this.state.sucursal_seleccionada = sucursalId;
      this.state.resumen_caja = null;
      this.state.movimientos_caja = [];
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      toast.error('Error al abrir caja: ' + error.message);
    }
  },

  async abrirModalCajaControl() {
    // Cargar monto anterior sugerido para la sucursal actual
    try {
      const sucursalId = this.state.sucursal_seleccionada || 1;
      const response = await fetch(`/api/cajas/monto-sugerido?sucursal_id=${sucursalId}`, { 
        headers: api.getHeaders() 
      });
      if (response.ok) {
        const data = await response.json();
        this.state.monto_anterior_sugerido = data.monto_anterior || 0;
      }
    } catch (error) {
      console.log('No se pudo cargar monto anterior:', error);
      this.state.monto_anterior_sugerido = 0;
    }

    if (this.state.caja_actual) {
      await Promise.all([
        this.cargarResumenCaja(this.state.caja_actual.id),
        this.cargarMovimientosCaja(this.state.caja_actual.id)
      ]);
    }

    this.renderUI();
    this.attachEvents();
    document.getElementById('modalCajaControl')?.classList.remove('hidden');
    this.actualizarDiferencias();
  },

  cerrarModalCaja() {
    document.getElementById('modalCajaControl')?.classList.add('hidden');
  },

  async cargarResumenCaja(cajaId) {
    try {
      const response = await fetch(`/api/cajas/${cajaId}/resumen`, { headers: api.getHeaders() });
      if (!response.ok) throw new Error('No se pudo cargar el resumen de caja');
      this.state.resumen_caja = await response.json();
    } catch (error) {
      console.error('Error cargando resumen de caja:', error);
      this.state.resumen_caja = null;
    }
  },

  async cargarMovimientosCaja(cajaId) {
    try {
      const response = await fetch(`/api/cajas/${cajaId}/movimientos`, { headers: api.getHeaders() });
      if (!response.ok) throw new Error('No se pudieron cargar los movimientos de caja');
      this.state.movimientos_caja = await response.json();
    } catch (error) {
      console.error('Error cargando movimientos de caja:', error);
      this.state.movimientos_caja = [];
    }
  },

  async registrarMovimientoCaja() {
    if (!this.state.caja_actual) {
      toast.warning('No hay caja abierta');
      return;
    }

    const tipo = document.getElementById('movimientoTipo').value;
    const categoria = document.getElementById('movimientoCategoria').value.trim() || 'otros';
    const monto = parseFloat(document.getElementById('movimientoMonto').value);
    const descripcion = document.getElementById('movimientoDescripcion').value.trim();

    if (!tipo || isNaN(monto) || monto <= 0) {
      toast.warning('Selecciona tipo de movimiento y un monto válido');
      return;
    }

    try {
      const response = await fetch(`/api/cajas/${this.state.caja_actual.id}/movimientos`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ tipo, categoria, monto, descripcion })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al registrar movimiento');
      }

      this.state.movimiento_tipo = 'egreso';
      this.state.movimiento_categoria = 'compra';
      this.state.movimiento_monto = 0;
      this.state.movimiento_descripcion = '';

      await Promise.all([
        this.cargarResumenCaja(this.state.caja_actual.id),
        this.cargarMovimientosCaja(this.state.caja_actual.id)
      ]);

      this.renderUI();
      this.attachEvents();
      toast.success('Movimiento registrado con éxito');
    } catch (error) {
      toast.error('Error al registrar movimiento: ' + error.message);
    }
  },

  actualizarDiferencias() {
    const resumen = this.state.resumen_caja;
    const efectivoEsp = resumen?.expected_cash || 0;
    const transEsp = resumen?.pagos?.transferencia || 0;
    const tarjEsp = (resumen?.pagos?.tarjeta || 0) + (resumen?.pagos?.cheque || 0);
    const totalEsp = efectivoEsp + transEsp + tarjEsp;

    const efectivoReal = parseFloat(document.getElementById('efectivoReal')?.value) || 0;
    const transReal = parseFloat(document.getElementById('transferenciaReal')?.value) || 0;
    const tarjReal = parseFloat(document.getElementById('tarjetaReal')?.value) || 0;
    const totalReal = efectivoReal + transReal + tarjReal;

    const showDif = (id, esp, real, inputId) => {
      const el = document.getElementById(id);
      if (!el) return;
      const inputEl = document.getElementById(inputId);
      if (!inputEl || inputEl.value === '') {
        el.innerHTML = '<span style="color:#9ca3af">Ingresa el valor real</span>';
        return;
      }
      const dif = real - esp;
      if (dif === 0) {
        el.innerHTML = '<span style="color:#16a34a;font-weight:600">✓ CORRECTO</span>';
      } else if (dif > 0) {
        el.innerHTML = `<span style="color:#d97706;font-weight:600">⚠ SOBRANTE: $${dif.toFixed(2)}</span>`;
      } else {
        el.innerHTML = `<span style="color:#dc2626;font-weight:600">✗ FALTANTE: $${Math.abs(dif).toFixed(2)}</span>`;
      }
    };

    showDif('difEfectivo', efectivoEsp, efectivoReal, 'efectivoReal');
    showDif('difTransferencia', transEsp, transReal, 'transferenciaReal');
    showDif('difTarjeta', tarjEsp, tarjReal, 'tarjetaReal');

    const totalRealEl = document.getElementById('totalRealCierre');
    if (totalRealEl) totalRealEl.textContent = `$${totalReal.toFixed(2)}`;

    const estadoEl = document.getElementById('estadoCierre');
    if (estadoEl) {
      const dif = totalReal - totalEsp;
      if (dif === 0) {
        estadoEl.innerHTML = '<span style="color:#16a34a;font-weight:700">✓ CIERRE CORRECTO</span>';
      } else if (dif > 0) {
        estadoEl.innerHTML = `<span style="color:#d97706;font-weight:700">⚠ SOBRANTE TOTAL: $${dif.toFixed(2)}</span>`;
      } else {
        estadoEl.innerHTML = `<span style="color:#dc2626;font-weight:700">✗ FALTANTE TOTAL: $${Math.abs(dif).toFixed(2)}</span>`;
      }
    }
  },

  actualizarVuelto() {
    const efectivoRecibido = parseFloat(document.getElementById('inputEfectivoRecibido')?.value) || 0;
    const totalText = document.getElementById('ventaTotalDisplay')?.textContent || '$0.00';
    const total = parseFloat(totalText.replace('$', '')) || 0;
    const vuelto = efectivoRecibido - total;
    document.getElementById('vueltoDisplay').textContent = vuelto.toFixed(2);
  },

  abrirModalVenta() {
    const subtotal = this.calcularSubtotal();
    const iva = this.state.aplicar_iva ? subtotal * 0.21 : 0;
    const total = subtotal + iva;
    document.getElementById('ventaSubtotalDisplay').textContent = subtotal.toFixed(2);
    document.getElementById('ventaIVADisplay').textContent = iva.toFixed(2);
    document.getElementById('ventaTotalDisplay').textContent = '$' + total.toFixed(2);
    document.getElementById('ventaItemsDisplay').textContent = this.state.carrito.length;
    
    // Inicializar campos de efectivo
    document.getElementById('medioPago').value = 'efectivo';
    document.getElementById('inputEfectivoRecibido').value = '';
    document.getElementById('vueltoDisplay').textContent = '0.00';
    document.getElementById('seccionEfectivo').style.display = 'block';
    
    document.getElementById('modalProcesarVenta').classList.remove('hidden');
  },

  async confirmarCierre() {
    if (!this.state.caja_actual) return;

    const efectivoReal = parseFloat(document.getElementById('efectivoReal')?.value) || 0;
    const transferenciaReal = parseFloat(document.getElementById('transferenciaReal')?.value) || 0;
    const tarjetaReal = parseFloat(document.getElementById('tarjetaReal')?.value) || 0;
    const montoInicialManana = parseFloat(document.getElementById('montoInicialManana')?.value) || 0;
    const observaciones = document.getElementById('closeObservaciones')?.value || '';

    const resumen = this.state.resumen_caja;
    const efectivoEsp = resumen?.expected_cash || 0;
    const transEsp = resumen?.pagos?.transferencia || 0;
    const tarjEsp = (resumen?.pagos?.tarjeta || 0) + (resumen?.pagos?.cheque || 0);
    const totalEsp = efectivoEsp + transEsp + tarjEsp;
    const totalReal = efectivoReal + transferenciaReal + tarjetaReal;

    const fmtDif = (dif) => {
      if (dif === 0) return 'CORRECTO ✓';
      if (dif > 0) return `SOBRANTE: $${dif.toFixed(2)}`;
      return `FALTANTE: $${Math.abs(dif).toFixed(2)}`;
    };

    const difEfectivo = efectivoReal - efectivoEsp;
    const difTrans = transferenciaReal - transEsp;
    const difTarj = tarjetaReal - tarjEsp;
    const difTotal = totalReal - totalEsp;

    const resumenMsg = `─── VERIFICACIÓN DE CIERRE ───

` +
      `💵 EFECTIVO
  Sistema: $${efectivoEsp.toFixed(2)}
  Real: $${efectivoReal.toFixed(2)}
  → ${fmtDif(difEfectivo)}

` +
      `🔄 TRANSFERENCIA
  Sistema: $${transEsp.toFixed(2)}
  Real: $${transferenciaReal.toFixed(2)}
  → ${fmtDif(difTrans)}

` +
      `💳 TARJETA / CHEQUE
  Sistema: $${tarjEsp.toFixed(2)}
  Real: $${tarjetaReal.toFixed(2)}
  → ${fmtDif(difTarj)}

` +
      `─────────────
` +
      `TOTAL ESPERADO: $${totalEsp.toFixed(2)}
` +
      `TOTAL REAL:     $${totalReal.toFixed(2)}
` +
      `ESTADO:         ${fmtDif(difTotal)}`;

    const cierreBodyHTML =
      `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;line-height:1.6;">${resumenMsg}</pre>`;

    const confirmed = await toast.confirm(cierreBodyHTML, 'Verificación de cierre de caja', 'Confirmar cierre', 'Cancelar', true);
    if (!confirmed) return;

    try {
      const data = await CierreCajaUtils.cerrarCaja(this.state.caja_actual.id, {
        monto_en_caja: efectivoReal,
        monto_retirado: transferenciaReal,
        transferencia_admin: tarjetaReal,
        saldo_inicial_siguiente: montoInicialManana,
        observaciones
      });

      cierreCajaEmitter.notificarCierreCaja({
        caja_id: this.state.caja_actual.id,
        monto_retirado: transferenciaReal,
        monto_en_caja: efectivoReal,
        diferencia: data.diferencia
      });

      this.state.caja_actual = null;
      this.state.carrito = [];
      document.getElementById('modalCajaControl')?.classList.add('hidden');
      this.state.resumen_caja = null;
      this.state.movimientos_caja = [];
      toast.success('Caja cerrada correctamente', 5000);
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      toast.error('Error al cerrar caja: ' + error.message);
    }
  },

  async confirmarVenta() {
    if (!this.state.caja_actual) {
      const montoInicial = this.state.saldoInicialApertura;
      const sucursalId = this.state.sucursal_seleccionada;

      try {
        const responseOpen = await fetch('/api/cajas/abrir', {
          method: 'POST',
          headers: api.getHeaders(),
          body: JSON.stringify({ sucursal_id: sucursalId, monto_inicial: montoInicial })
        });

        if (!responseOpen.ok) {
          const err = await responseOpen.json().catch(() => ({}));
          throw new Error(err.error || 'Error al abrir caja automáticamente');
        }

        const openData = await responseOpen.json();
        const montoInicialReal = openData.monto_inicial ?? montoInicial;
        this.state.caja_actual = { 
          id: openData.caja_id, 
          monto_inicial: montoInicialReal, 
          monto_anterior: openData.monto_anterior || 0,
          sucursal_id: sucursalId 
        };
        
        // Si hubo monto del cierre anterior, mostrar información
        if (openData.monto_anterior > 0) {
          toast.info(`<strong>Caja abierta</strong><br>Monto anterior: <strong>$${openData.monto_anterior.toFixed(2)}</strong> &nbsp;|&nbsp; Saldo inicial: <strong>$${montoInicialReal.toFixed(2)}</strong>`, 6000);
        } else {
          toast.success('Caja abierta correctamente');
        }
      } catch (error) {
        toast.error('Error al abrir caja: ' + error.message);
        return;
      }
    }

    const medioPago = document.getElementById('medioPago').value;
    const subtotal = this.calcularSubtotal();
    const iva = this.state.aplicar_iva ? subtotal * 0.21 : 0;
    const total = subtotal + iva;

    // Validar efectivo si es el medio de pago
    if (medioPago === 'efectivo') {
      const efectivoRecibido = parseFloat(document.getElementById('inputEfectivoRecibido').value) || 0;
      if (efectivoRecibido < total) {
        toast.warning(`Efectivo insuficiente — Falta <strong>$${(total - efectivoRecibido).toFixed(2)}</strong> (Total: $${total.toFixed(2)}, recibido: $${efectivoRecibido.toFixed(2)})`);
        return;
      }
    }

    const items = this.state.carrito.map(item => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      precio_unitario: item.precio_unitario
    }));

    try {
      const response = await fetch('/api/ventas', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({
          caja_id: this.state.caja_actual.id,
          cliente_id: this.state.cliente_seleccionado,
          barbero_id: this.state.barbero_seleccionado,
          sucursal_id: this.state.sucursal_seleccionada,
          items,
          medio_pago: medioPago,
          estado: 'pagada',
          subtotal,
          iva,
          total
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al procesar venta');
      }

      const data = await response.json();
      
      let vueltoHtml = '';
      if (medioPago === 'efectivo') {
        const efectivoRecibido = parseFloat(document.getElementById('inputEfectivoRecibido').value) || 0;
        const vuelto = efectivoRecibido - total;
        vueltoHtml = ` &nbsp;|&nbsp; Vuelto: <strong>$${vuelto.toFixed(2)}</strong>`;
      }

      toast.success(`<strong>Venta procesada</strong> — Ticket: ${data.numero_ticket} &nbsp;|&nbsp; Total: <strong>$${total.toFixed(2)}</strong>${vueltoHtml}`, 6000);

      this.state.carrito = [];
      this.state.cliente_seleccionado = null;
      this.state.barbero_seleccionado = null;
      document.getElementById('modalProcesarVenta').classList.add('hidden');
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      toast.error('Error al procesar venta: ' + error.message);
    }
  },

  abrirModalNuevoClienteVentas() {
    document.getElementById('modalNuevoClienteVentas')?.classList.remove('hidden');
    document.getElementById('nuevoCliNombre').value = '';
    document.getElementById('nuevoCliApellido').value = '';
    document.getElementById('nuevoCliTelefono').value = '';
    document.getElementById('nuevoCliEmail').value = '';
  },

  cerrarModalNuevoClienteVentas() {
    document.getElementById('modalNuevoClienteVentas')?.classList.add('hidden');
  },

  async guardarNuevoClienteVentas() {
    const nombre = document.getElementById('nuevoCliNombre').value.trim();
    const apellido = document.getElementById('nuevoCliApellido').value.trim();
    const telefono = document.getElementById('nuevoCliTelefono').value.trim();
    const email = document.getElementById('nuevoCliEmail').value.trim();

    if (!nombre || !apellido || !telefono) {
      toast.warning('Nombre, apellido y teléfono son campos obligatorios');
      return;
    }

    try {
      const response = await fetch('/api/clientes', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({
          nombre,
          apellido,
          telefono,
          email
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar cliente');
      }

      const responseData = await response.json();
      
      // Construir objeto cliente completo con los datos que enviamos
      const nuevoCliente = {
        id: responseData.id,
        nombre,
        apellido,
        telefono,
        email: email || null,
        documento_tipo: 'DNI',
        documento_numero: null,
        direccion: null,
        ciudad: null,
        provincia: null,
        codigo_postal: null,
        razon_social: null,
        cuit: null,
        activo: 1
      };
      
      // Agregar el cliente a la lista local
      this.state.clientes.push(nuevoCliente);
      
      // Seleccionar automáticamente el nuevo cliente
      this.state.cliente_seleccionado = nuevoCliente.id;
      
      // Cerrar modal y actualizar UI
      this.cerrarModalNuevoClienteVentas();
      this.renderUI();
      this.attachEvents();
      
      toast.success(`Cliente <strong>${nombre} ${apellido}</strong> agregado correctamente`);
    } catch (error) {
      toast.error('Error al guardar cliente: ' + error.message);
    }
  },

  abrirModalNuevoBarberoVentas() {
    document.getElementById('modalNuevoBarberoVentas')?.classList.remove('hidden');
    document.getElementById('nuevoBarNombre').value = '';
    document.getElementById('nuevoBarApellido').value = '';
    document.getElementById('nuevoBarTelefono').value = '';
    document.getElementById('nuevoBarEmail').value = '';
  },

  async guardarNuevoBarberoVentas() {
    const nombre = document.getElementById('nuevoBarNombre')?.value.trim();
    const apellido = document.getElementById('nuevoBarApellido')?.value.trim();
    const telefono = document.getElementById('nuevoBarTelefono')?.value.trim();
    const email = document.getElementById('nuevoBarEmail')?.value.trim();

    if (!nombre || !apellido || !telefono) {
      toast.warning('Nombre, apellido y teléfono son obligatorios');
      return;
    }

    try {
      const res = await fetch('/api/barberos', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ nombre, apellido, telefono, email })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar barbero');
      }

      const data = await res.json();
      const nuevoBarbero = { id: data.id, nombre, apellido, telefono, email: email || null, codigo_barbero: data.codigo_barbero };
      this.state.barberos.push(nuevoBarbero);
      this.state.barbero_seleccionado = nuevoBarbero.id;

      document.getElementById('modalNuevoBarberoVentas')?.classList.add('hidden');
      this.renderUI();
      this.attachEvents();

      toast.success(`Barbero <strong>${nombre} ${apellido}</strong> (${data.codigo_barbero}) agregado correctamente`);
    } catch (error) {
      toast.error('Error al guardar barbero: ' + error.message);
    }
  },

  async abrirModalHistorialCajas() {
    const modal = document.getElementById('modalHistorialCajas');
    if (!modal) return;
    document.getElementById('historialCajasContenido').innerHTML =
      '<tr><td colspan="7" class="px-3 py-8 text-center text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Cargando historial...</td></tr>';
    modal.classList.remove('hidden');
    try {
      const res = await fetch('/api/cajas?filtro=todas', { headers: api.getHeaders() });
      const cajas = res.ok ? await res.json() : [];
      this.state.historial_cajas = cajas
        .filter(c => c.estado === 'cerrada')
        .sort((a, b) => new Date(b.fecha_cierre) - new Date(a.fecha_cierre));
      this._renderHistorialCajas();
      this._attachHistorialEvents();
    } catch (error) {
      document.getElementById('historialCajasContenido').innerHTML =
        `<tr><td colspan="7" class="px-3 py-8 text-center text-red-500">Error: ${error.message}</td></tr>`;
    }
  },

  _renderHistorialCajas() {
    const inicio = document.getElementById('histFechaInicio')?.value || '';
    const fin = document.getElementById('histFechaFin')?.value || '';
    let cierres = this.state.historial_cajas;
    if (inicio) cierres = cierres.filter(c => new Date(c.fecha_cierre) >= new Date(inicio + 'T00:00:00'));
    if (fin) cierres = cierres.filter(c => new Date(c.fecha_cierre) <= new Date(fin + 'T23:59:59'));

    const contEl = document.getElementById('histConteo');
    if (contEl) contEl.textContent = cierres.length;

    const rows = cierres.map(c => {
      const real = (c.monto_en_caja || 0) + (c.monto_retirado || 0) + (c.transferencia_admin || 0);
      const dif = real - (c.monto_final_esperado || 0);
      const estadoColor = dif === 0 ? 'text-green-600 dark:text-green-400' : (dif > 0 ? 'text-orange-500 dark:text-orange-400' : 'text-red-500 dark:text-red-400');
      const estadoText = dif === 0 ? '✓ OK' : (dif > 0 ? `SOBRANTE +$${dif.toFixed(2)}` : `FALTANTE -$${Math.abs(dif).toFixed(2)}`);
      return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition">
          <td class="px-3 py-2.5 text-gray-900 dark:text-gray-100 whitespace-nowrap">
            <div class="font-medium">${new Date(c.fecha_cierre).toLocaleDateString('es-ES',{day:'2-digit',month:'2-digit',year:'numeric'})}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">${new Date(c.fecha_cierre).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
          </td>
          <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-sm">${c.sucursal_nombre || '—'}</td>
          <td class="px-3 py-2.5 text-gray-600 dark:text-gray-400 text-sm">${c.usuario_nombre || '—'}</td>
          <td class="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">$${(c.monto_final_esperado || 0).toFixed(2)}</td>
          <td class="px-3 py-2.5 text-right font-medium text-gray-900 dark:text-gray-100">$${real.toFixed(2)}</td>
          <td class="px-3 py-2.5 text-right font-bold ${estadoColor}">${estadoText}</td>
          <td class="px-3 py-2.5 text-center">
            <button data-cierre-id="${c.id}" class="btnPDFCierre px-2.5 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-xs transition">
              <i class="fas fa-file-pdf mr-1"></i>PDF
            </button>
          </td>
        </tr>`;
    }).join('');

    document.getElementById('historialCajasContenido').innerHTML = rows || `
      <tr><td colspan="7" class="px-3 py-10 text-center text-gray-500 dark:text-gray-400">
        <i class="fas fa-inbox text-3xl mb-2 block opacity-40"></i>
        ${inicio || fin ? 'No hay cierres en el período seleccionado' : 'No hay cierres registrados'}
      </td></tr>`;

    this._attachHistorialEvents();
  },

  _attachHistorialEvents() {
    document.getElementById('btnFiltrarHistorial')?.addEventListener('click', () => this._renderHistorialCajas());
    document.getElementById('btnLimpiarHistorial')?.addEventListener('click', () => {
      const i = document.getElementById('histFechaInicio');
      const f = document.getElementById('histFechaFin');
      if (i) i.value = '';
      if (f) f.value = '';
      this._renderHistorialCajas();
    });
    document.querySelectorAll('.btnPDFCierre').forEach(btn => {
      btn.addEventListener('click', async e => {
        const id = e.currentTarget.dataset.cierreId;
        const cierre = this.state.historial_cajas.find(c => c.id == id);
        if (cierre) await this.descargarPDFCierreCaja(id, cierre);
      });
    });
  },

  async descargarPDFCierreCaja(cierreId, cierre) {
    try {
      const [resCaja, resVentas, resMov, resBarberos] = await Promise.all([
        fetch(`/api/cajas/${cierreId}`, { headers: api.getHeaders() }),
        fetch(`/api/ventas/caja/${cierreId}`, { headers: api.getHeaders() }),
        fetch(`/api/cajas/${cierreId}/movimientos`, { headers: api.getHeaders() }),
        fetch(`/api/cajas/${cierreId}/barberos-dia`, { headers: api.getHeaders() })
      ]);
      const cajaCompleta = resCaja.ok ? await resCaja.json() : {};
      const ventas = resVentas.ok ? await resVentas.json() : [];
      const movimientos = resMov.ok ? await resMov.json() : [];
      const barberos = resBarberos.ok ? await resBarberos.json() : [];

      // Mapa de barbero_id → barbero para resolución garantizada aunque el JOIN falle
      const barberoMap = new Map(barberos.map(b => [Number(b.id), b]));

      const real = (cierre.monto_en_caja || 0) + (cierre.monto_retirado || 0) + (cierre.transferencia_admin || 0);
      const diferencia = real - (cierre.monto_final_esperado || 0);
      const estado = diferencia === 0 ? 'CUADRA' : (diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
      const estadoTxt = diferencia === 0 ? '#059669' : (diferencia > 0 ? '#b45309' : '#dc2626');
      const estadoLt = diferencia === 0 ? '#d1fae5' : (diferencia > 0 ? '#fef3c7' : '#fee2e2');
      const totalVentas = ventas.reduce((s, v) => s + Number(v.total), 0);

      const TH  = 'padding:8px 10px;text-align:left;background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;letter-spacing:0.4px;';
      const THR = 'padding:8px 10px;text-align:right;background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;letter-spacing:0.4px;';
      const THC = 'padding:8px 10px;text-align:center;background:#1e293b;color:#f1f5f9;font-size:11px;font-weight:700;letter-spacing:0.4px;';
      const td  = 'padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;';
      const tdR = 'padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;text-align:right;';
      const tdC = 'padding:7px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#1e293b;text-align:center;';

      const ventasHTML = ventas.map((v, i) => {
        const bar = v.barbero_id ? barberoMap.get(Number(v.barbero_id)) : null;
        const barNombre = bar
          ? `${bar.nombre} ${bar.apellido}`.trim()
          : (v.barbero_nombre ? `${v.barbero_nombre} ${v.barbero_apellido||''}`.trim() : null);
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr style="background:${bg};">
            <td style="${td}font-family:monospace;font-size:10px;color:#64748b;">${v.numero_ticket||'—'}</td>
            <td style="${td}">${new Date(v.fecha_venta).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
            <td style="${td}">${v.cliente_nombre ? v.cliente_nombre+' '+(v.cliente_apellido||'') : '<span style="color:#94a3b8;font-style:italic;">Sin cliente</span>'}</td>
            <td style="${td}font-weight:600;">${barNombre || '<span style="color:#94a3b8;">—</span>'}</td>
            <td style="${tdC}text-transform:capitalize;">${v.medio_pago||'—'}</td>
            <td style="${tdR}font-weight:700;color:#059669;">$${Number(v.total).toFixed(2)}</td>
          </tr>`;
      }).join('');

      const barberosHTML = barberos.map((b, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        return `
          <tr style="background:${bg};">
            <td style="${td}font-weight:700;">${b.nombre} ${b.apellido}</td>
            <td style="${td}font-family:monospace;font-size:11px;color:#7c3aed;">${b.codigo_barbero}</td>
            <td style="${tdC}font-weight:600;">${b.total_ventas}</td>
            <td style="${tdC}">${b.total_productos||0}</td>
            <td style="${tdR}font-weight:700;color:#059669;">$${Number(b.total_acumulado).toFixed(2)}</td>
          </tr>`;
      }).join('') || '<tr><td colspan="5" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;">Sin barberos registrados</td></tr>';

      const movHTML = movimientos.map((m, i) => {
        const bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';
        const esIngreso = (m.tipo||'').toLowerCase() === 'ingreso';
        return `
          <tr style="background:${bg};">
            <td style="${td}font-weight:600;text-transform:capitalize;">${m.tipo||'—'}</td>
            <td style="${td}">${m.categoria||'—'}</td>
            <td style="${tdR}font-weight:700;color:${esIngreso ? '#059669' : '#dc2626'};">${esIngreso ? '+' : '-'}$${Number(m.monto).toFixed(2)}</td>
            <td style="${td}color:#475569;">${m.descripcion||'—'}</td>
          </tr>`;
      }).join('') || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;">Sin movimientos registrados</td></tr>';

      const el = document.createElement('div');
      el.style.cssText = 'font-family:Arial,sans-serif;color:#1e293b;background:#ffffff;';
      el.innerHTML = `
        <div style="background:linear-gradient(135deg,#1e1b4b 0%,#3730a3 100%);padding:22px 24px;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:9px;letter-spacing:3px;color:#a5b4fc;font-weight:700;text-transform:uppercase;margin-bottom:4px;">POS Barbershop</div>
              <h1 style="margin:0;font-size:26px;font-weight:900;color:#ffffff;letter-spacing:1px;">CIERRE DE CAJA</h1>
              <p style="margin:6px 0 0;color:#c7d2fe;font-size:12px;">${new Date(cierre.fecha_cierre).toLocaleDateString('es-ES',{weekday:'long',year:'numeric',month:'long',day:'numeric'})} &mdash; ${new Date(cierre.fecha_cierre).toLocaleTimeString()}</p>
            </div>
            <div style="text-align:right;">
              <div style="font-size:10px;color:#a5b4fc;font-weight:600;letter-spacing:0.5px;">SUCURSAL</div>
              <div style="font-size:14px;font-weight:800;color:#ffffff;margin-bottom:6px;">${cierre.sucursal_nombre||'—'}</div>
              <div style="font-size:10px;color:#a5b4fc;font-weight:600;letter-spacing:0.5px;">USUARIO</div>
              <div style="font-size:14px;font-weight:800;color:#ffffff;">${cierre.usuario_nombre||'—'}</div>
            </div>
          </div>
        </div>

        <div style="background:#0f172a;padding:14px 24px;">
          <div style="display:flex;gap:0;">
            <div style="flex:1;text-align:center;padding:8px 6px;border-right:1px solid #334155;">
              <div style="font-size:9px;letter-spacing:1px;color:#60a5fa;font-weight:700;text-transform:uppercase;">Saldo Inicial</div>
              <div style="font-size:17px;font-weight:800;color:#93c5fd;margin-top:3px;">$${(cajaCompleta.monto_inicial||0).toFixed(2)}</div>
            </div>
            <div style="flex:1;text-align:center;padding:8px 6px;border-right:1px solid #334155;">
              <div style="font-size:9px;letter-spacing:1px;color:#34d399;font-weight:700;text-transform:uppercase;">Total Ventas</div>
              <div style="font-size:17px;font-weight:800;color:#6ee7b7;margin-top:3px;">$${totalVentas.toFixed(2)}</div>
            </div>
            <div style="flex:1;text-align:center;padding:8px 6px;border-right:1px solid #334155;">
              <div style="font-size:9px;letter-spacing:1px;color:#fbbf24;font-weight:700;text-transform:uppercase;">Esperado</div>
              <div style="font-size:17px;font-weight:800;color:#fcd34d;margin-top:3px;">$${(cierre.monto_final_esperado||0).toFixed(2)}</div>
            </div>
            <div style="flex:1;text-align:center;padding:8px 6px;border-right:1px solid #334155;">
              <div style="font-size:9px;letter-spacing:1px;color:#a78bfa;font-weight:700;text-transform:uppercase;">Total Real</div>
              <div style="font-size:17px;font-weight:800;color:#c4b5fd;margin-top:3px;">$${real.toFixed(2)}</div>
            </div>
            <div style="flex:1;text-align:center;padding:8px 6px;background:${diferencia===0?'#052e16':(diferencia>0?'#451a03':'#450a0a')};">
              <div style="font-size:9px;letter-spacing:1px;color:${estadoTxt};font-weight:700;text-transform:uppercase;">${estado}</div>
              <div style="font-size:17px;font-weight:800;color:${estadoTxt};margin-top:3px;">$${Math.abs(diferencia).toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div style="padding:16px 20px 20px;">

          <div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #7c3aed;">
              <span style="font-size:14px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">&#9986; Barberos a Cargo</span>
              <span style="background:#7c3aed;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;">${barberos.length}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="${TH}border-radius:6px 0 0 0;">Nombre</th>
                <th style="${TH}">C&oacute;digo</th>
                <th style="${THC}">Ventas</th>
                <th style="${THC}">Servicios</th>
                <th style="${THR}border-radius:0 6px 0 0;">Total Facturado</th>
              </tr></thead>
              <tbody>${barberosHTML}</tbody>
            </table>
          </div>

          <div style="margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #059669;">
              <span style="font-size:14px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">Ventas del D&iacute;a</span>
              <span style="background:#059669;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;">${ventas.length}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="${TH}">N&deg; Ticket</th>
                <th style="${TH}">Hora</th>
                <th style="${TH}">Cliente</th>
                <th style="${TH}">Barbero</th>
                <th style="${THC}">Medio de Pago</th>
                <th style="${THR}">Total</th>
              </tr></thead>
              <tbody>
                ${ventasHTML || '<tr><td colspan="6" style="padding:18px;text-align:center;color:#94a3b8;font-style:italic;">Sin ventas registradas</td></tr>'}
                <tr style="background:#f0fdf4;">
                  <td colspan="5" style="padding:9px 10px;text-align:right;font-weight:800;font-size:12px;color:#1e293b;border-top:2px solid #bbf7d0;">TOTAL DEL D&Iacute;A</td>
                  <td style="padding:9px 10px;text-align:right;font-weight:800;font-size:14px;color:#059669;border-top:2px solid #bbf7d0;">$${totalVentas.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;padding-bottom:6px;border-bottom:2px solid #6366f1;">
              <span style="font-size:14px;font-weight:800;color:#1e293b;text-transform:uppercase;letter-spacing:0.5px;">Otros Movimientos</span>
              <span style="background:#6366f1;color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;">${movimientos.length}</span>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="${TH}">Tipo</th>
                <th style="${TH}">Categor&iacute;a</th>
                <th style="${THR}">Monto</th>
                <th style="${TH}">Descripci&oacute;n</th>
              </tr></thead>
              <tbody>${movHTML}</tbody>
            </table>
          </div>

          ${cierre.observaciones ? `<div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:4px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#78350f;"><strong>Observaciones:</strong> ${cierre.observaciones}</div>` : ''}

          <div style="margin-top:18px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;">
            Documento generado el ${new Date().toLocaleString('es-AR')} &mdash; POS Barbershop
          </div>
        </div>
      `;

      const filename = `cierre-caja_${new Date(cierre.fecha_cierre).toISOString().split('T')[0]}_${(cierre.sucursal_nombre||'caja').replace(/\s+/g,'_')}.pdf`;
      html2pdf().set({
        margin: [0, 0, 5, 0], filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, backgroundColor: '#ffffff', useCORS: true },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      }).from(el).save();
    } catch (error) {
      toast.error('Error al generar PDF: ' + error.message);
    }
  }
};

