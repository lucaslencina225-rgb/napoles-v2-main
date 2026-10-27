/*
import { api } from '../api-client.js';
import { fmtMoney } from '../utils/print-utils.js';
import { cierreCajaEmitter } from '../utils/cierre-caja-events.js';

export default {
  state: {
    caja_actual: null,
    resumen_caja: null,
    movimientos_caja: [],
    ventas_dia: [],
    barberos_dia: [],
    historial_cierres: [],
    tab_activo: 'cierre' // 'cierre' o 'historial'
  },

  async render(container) {
    this.container = container;
    await this.verificarCajaAbierta();
    if (this.state.caja_actual) {
      await Promise.all([
        this.cargarResumenCaja(this.state.caja_actual.id),
        this.cargarMovimientosCaja(this.state.caja_actual.id),
        this.cargarVentasDia(this.state.caja_actual.id),
        this.cargarBarberosDia(this.state.caja_actual.id)
      ]);
    }
    await this.cargarHistorialCierres();
    this.renderUI();
    this.attachEvents();
    this.setupEventListeners();
  },

  async verificarCajaAbierta() {
    try {
      const res = await fetch('/api/cajas/actual', { headers: api.getHeaders() });
      this.state.caja_actual = res.ok ? await res.json() : null;
    } catch (error) {
      console.error('Error verificando caja:', error);
      this.state.caja_actual = null;
    }
  },

  async cargarResumenCaja(cajaId) {
    try {
      const res = await fetch(`/api/cajas/${cajaId}/resumen`, { headers: api.getHeaders() });
      this.state.resumen_caja = res.ok ? await res.json() : null;
    } catch (error) {
      console.error('Error cargando resumen:', error);
      this.state.resumen_caja = null;
    }
  },

  async cargarMovimientosCaja(cajaId) {
    try {
      const res = await fetch(`/api/cajas/${cajaId}/movimientos`, { headers: api.getHeaders() });
      this.state.movimientos_caja = res.ok ? await res.json() : [];
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      this.state.movimientos_caja = [];
    }
  },

  async cargarVentasDia(cajaId) {
    try {
      const res = await fetch(`/api/ventas/caja/${cajaId}`, { headers: api.getHeaders() });
      this.state.ventas_dia = res.ok ? await res.json() : [];
    } catch (error) {
      console.error('Error cargando ventas:', error);
      this.state.ventas_dia = [];
    }
  },

  async cargarBarberosDia(cajaId) {
    try {
      const res = await fetch(`/api/cajas/${cajaId}/barberos-dia`, { headers: api.getHeaders() });
      this.state.barberos_dia = res.ok ? await res.json() : [];
    } catch (error) {
      console.error('Error cargando barberos del día:', error);
      this.state.barberos_dia = [];
    }
  },

  async cargarHistorialCierres() {
    try {
      const res = await fetch('/api/cajas?filtro=todas', { headers: api.getHeaders() });
      const cajas = res.ok ? await res.json() : [];
      this.state.historial_cierres = cajas.filter(c => c.estado === 'cerrada').sort((a, b) => 
        new Date(b.fecha_cierre) - new Date(a.fecha_cierre)
      );
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.state.historial_cierres = [];
    }
  },

  setupEventListeners() {
    cierreCajaEmitter.on('cierre-caja:cerrada', async () => {
      this.showToast('Caja cerrada desde Ventas', 'info');
      await this.verificarCajaAbierta();
      if (this.state.caja_actual) {
        await Promise.all([
          this.cargarResumenCaja(this.state.caja_actual.id),
          this.cargarMovimientosCaja(this.state.caja_actual.id),
          this.cargarVentasDia(this.state.caja_actual.id),
          this.cargarBarberosDia(this.state.caja_actual.id)
        ]);
      }
      await this.cargarHistorialCierres();
      this.renderUI();
      this.attachEvents();
    });
  },

  showToast(message, type = 'success') {
    const toast = this.container?.querySelector('#cajaToast');
    if (!toast) return;
    const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-blue-600' };
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.className = `fixed bottom-4 right-4 max-w-sm z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-white font-medium ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${message}</span>`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3500);
  },

  renderUI() {
    this.container.innerHTML = `
      <div class="space-y-4 sm:space-y-6">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
              <i class="fas fa-cash-register mr-2 text-green-600"></i>Cierre de Caja
            </h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Gestión y control de efectivo</p>
          </div>
        </div>

        <!-- Tabs -->
        <div class="flex gap-2 border-b border-gray-200 dark:border-gray-700">
          <button id="tabCierre" class="px-4 py-2 font-medium border-b-2 transition ${this.state.tab_activo === 'cierre' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            <i class="fas fa-edit mr-1"></i>Cierre Actual
          </button>
          <button id="tabHistorial" class="px-4 py-2 font-medium border-b-2 transition ${this.state.tab_activo === 'historial' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}">
            <i class="fas fa-history mr-1"></i>Historial
          </button>
        </div>

        ${this.state.tab_activo === 'cierre' ? this.renderTabCierre() : this.renderTabHistorial()}

        <!-- Toast -->
        <div id="cajaToast" class="hidden fixed bottom-4 right-4 max-w-sm z-50 px-4 py-3 rounded-lg shadow-lg text-white font-medium"></div>
      </div>
    `;
  },

  _getDifHtml(dif) {
    if (isNaN(dif)) return '<p class="font-bold text-gray-500 dark:text-gray-400">—</p>';
    if (dif === 0) return '<p class="font-bold text-green-600 dark:text-green-400 text-lg">✓ OK</p>';
    if (dif > 0) return `<p class="font-bold text-orange-500 text-sm">SOBRANTE</p><p class="font-bold text-orange-500">+$${dif.toFixed(2)}</p>`;
    return `<p class="font-bold text-red-500 text-sm">FALTANTE</p><p class="font-bold text-red-500">-$${Math.abs(dif).toFixed(2)}</p>`;
  },

  renderTabCierre() {
    const r = this.state.resumen_caja;
    const caja = this.state.caja_actual;
    const montoInicial = caja?.monto_inicial || 0;
    const efectivoVentas = r?.pagos?.efectivo || 0;
    const transferenciaEsp = r?.pagos?.transferencia || 0;
    const tarjetaEsp = (r?.pagos?.tarjeta || 0) + (r?.pagos?.cheque || 0);
    const egresos = r?.total_egresos || 0;
    const efectivoEsp = montoInicial + efectivoVentas - egresos;
    const totalEsp = efectivoEsp + transferenciaEsp + tarjetaEsp;

    return `
      <div class="space-y-6">
        ${caja ? `
          <!-- Resumen del sistema por método de pago -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700">
              <p class="text-xs uppercase font-semibold text-green-700 dark:text-green-300 mb-1"><i class="fas fa-money-bills mr-1"></i>Efectivo — Sistema</p>
              <p class="text-2xl font-bold text-green-800 dark:text-green-200">$${efectivoEsp.toFixed(2)}</p>
              <p class="text-xs text-green-600 dark:text-green-400 mt-1">Inicial $${montoInicial.toFixed(2)} + Ventas $${efectivoVentas.toFixed(2)}${egresos > 0 ? ' − Egresos $'+egresos.toFixed(2) : ''}</p>
            </div>
            <div class="p-4 rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700">
              <p class="text-xs uppercase font-semibold text-purple-700 dark:text-purple-300 mb-1"><i class="fas fa-right-left mr-1"></i>Transferencia — Sistema</p>
              <p class="text-2xl font-bold text-purple-800 dark:text-purple-200">$${transferenciaEsp.toFixed(2)}</p>
              <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">Total ventas por transferencia</p>
            </div>
            <div class="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700">
              <p class="text-xs uppercase font-semibold text-blue-700 dark:text-blue-300 mb-1"><i class="fas fa-credit-card mr-1"></i>Tarjeta/Cheque — Sistema</p>
              <p class="text-2xl font-bold text-blue-800 dark:text-blue-200">$${tarjetaEsp.toFixed(2)}</p>
              <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">Total ventas por tarjeta</p>
            </div>
          </div>

          <!-- Formulario de verificación -->
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-5 space-y-4">
            <h3 class="font-bold text-gray-900 dark:text-white text-base"><i class="fas fa-clipboard-check mr-2 text-green-600"></i>Verificación de Cierre</h3>

            <!-- Efectivo -->
            <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200"><i class="fas fa-money-bills mr-1 text-green-600"></i>Efectivo en caja</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Sistema espera: <strong class="text-gray-800 dark:text-gray-100">$${efectivoEsp.toFixed(2)}</strong></p>
                </div>
                <div class="flex-1">
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Monto contado físicamente:</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                    <input id="efectivoReal" type="number" step="0.01" placeholder="0.00"
                      class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                  </div>
                </div>
                <div class="md:w-36 text-center">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Diferencia</p>
                  <div id="difEfectivo" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 min-h-[46px] flex flex-col items-center justify-center">
                    <p class="font-bold text-gray-500 dark:text-gray-400">—</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Transferencia -->
            <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200"><i class="fas fa-right-left mr-1 text-purple-600"></i>Transferencias</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Sistema espera: <strong class="text-gray-800 dark:text-gray-100">$${transferenciaEsp.toFixed(2)}</strong></p>
                </div>
                <div class="flex-1">
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Total recibido por transferencia:</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                    <input id="transferenciaReal" type="number" step="0.01" placeholder="0.00"
                      class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                  </div>
                </div>
                <div class="md:w-36 text-center">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Diferencia</p>
                  <div id="difTransferencia" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 min-h-[46px] flex flex-col items-center justify-center">
                    <p class="font-bold text-gray-500 dark:text-gray-400">—</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Tarjeta / Cheque -->
            <div class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div class="flex flex-col md:flex-row md:items-center gap-4">
                <div class="flex-1">
                  <p class="text-sm font-semibold text-gray-700 dark:text-gray-200"><i class="fas fa-credit-card mr-1 text-blue-600"></i>Tarjeta / Cheque</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Sistema espera: <strong class="text-gray-800 dark:text-gray-100">$${tarjetaEsp.toFixed(2)}</strong></p>
                </div>
                <div class="flex-1">
                  <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Total recibido por tarjeta/cheque:</label>
                  <div class="relative">
                    <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                    <input id="tarjetaReal" type="number" step="0.01" placeholder="0.00"
                      class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
                  </div>
                </div>
                <div class="md:w-36 text-center">
                  <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">Diferencia</p>
                  <div id="difTarjeta" class="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 min-h-[46px] flex flex-col items-center justify-center">
                    <p class="font-bold text-gray-500 dark:text-gray-400">—</p>
                  </div>
                </div>
              </div>
            </div>

            <!-- Resumen total -->
            <div class="rounded-lg border border-gray-300 dark:border-gray-600 p-4 bg-white dark:bg-gray-800">
              <div class="flex justify-between items-center text-sm mb-1">
                <span class="text-gray-600 dark:text-gray-400">Total esperado del sistema:</span>
                <strong class="text-gray-900 dark:text-white">$${totalEsp.toFixed(2)}</strong>
              </div>
              <div class="flex justify-between items-center text-sm mb-2">
                <span class="text-gray-600 dark:text-gray-400">Total ingresado:</span>
                <strong id="totalReal" class="text-gray-900 dark:text-white">$0.00</strong>
              </div>
              <div class="pt-2 border-t border-gray-200 dark:border-gray-600 flex justify-between items-center">
                <span class="font-semibold text-gray-700 dark:text-gray-300">Estado general del cierre:</span>
                <span id="estadoCierre" class="font-bold text-gray-400">Completar campos</span>
              </div>
            </div>

            <!-- Monto inicial para mañana -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
                <i class="fas fa-sun mr-1 text-yellow-500"></i>Monto inicial para el día siguiente
              </label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                <input id="montoInicialManana" type="number" step="0.01" placeholder="0.00"
                  class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">Solo ingrese el monto. No se calcula automáticamente.</p>
            </div>

            <!-- Observaciones -->
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Observaciones</label>
              <textarea id="closeObservaciones" rows="2" placeholder="Notas adicionales..." class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"></textarea>
            </div>

            <!-- Botones -->
            <div class="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <button id="btnGenerarPDFCierre" class="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition">
                <i class="fas fa-file-pdf mr-1"></i>Descargar PDF
              </button>
              <button id="btnConfirmarCierre" class="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition">
                <i class="fas fa-lock mr-1"></i>Cerrar Caja
              </button>
            </div>
          </div>

          <!-- Movimientos -->
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
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

          <!-- Ventas del día -->
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-semibold mb-3 text-gray-900 dark:text-white">
              <i class="fas fa-shopping-cart mr-2 text-blue-600"></i>Ventas del día (${this.state.ventas_dia.length})
            </h3>
            <div class="max-h-72 overflow-y-auto">
              ${this.state.ventas_dia.length ? `
                <div class="space-y-2">
                  ${this.state.ventas_dia.map(v => `
                    <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                      <div class="flex justify-between gap-2">
                        <div>
                          <strong class="text-gray-900 dark:text-gray-100">${v.numero_ticket}</strong>
                          <span class="text-gray-600 dark:text-gray-400"> • ${v.cliente_nombre ? v.cliente_nombre + ' ' + (v.cliente_apellido || '') : 'Sin cliente'}</span>
                          ${v.barbero_nombre ? `<span class="text-purple-600 dark:text-purple-400 text-xs ml-1">• ${v.barbero_nombre}</span>` : ''}
                        </div>
                        <div class="font-semibold text-green-700 dark:text-green-300">$${Number(v.total).toFixed(2)}</div>
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <i class="fas fa-clock mr-1"></i>${new Date(v.fecha_venta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} •
                        <span class="capitalize">${v.medio_pago}</span>
                      </p>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-gray-500 dark:text-gray-400 text-sm">No hay ventas registradas.</p>'}
            </div>
          </div>

          <!-- Barberos del día -->
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-semibold mb-3 text-gray-900 dark:text-white">
              <i class="fas fa-scissors mr-2 text-purple-600"></i>Barberos activos del día (${this.state.barberos_dia.length})
            </h3>
            ${this.state.barberos_dia.length ? `
              <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                ${this.state.barberos_dia.map(b => `
                  <div class="p-4 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700">
                    <p class="font-bold text-gray-900 dark:text-white">${b.nombre} ${b.apellido}</p>
                    <p class="text-xs text-purple-700 dark:text-purple-300 font-mono mb-3">Código: ${b.codigo_barbero}</p>
                    <div class="grid grid-cols-2 gap-2 text-sm pt-2 border-t border-purple-200 dark:border-purple-700">
                      <div><p class="text-xs text-gray-500 dark:text-gray-400">Ventas</p><p class="font-bold text-purple-700 dark:text-purple-300">${b.total_ventas}</p></div>
                      <div><p class="text-xs text-gray-500 dark:text-gray-400">Cortes</p><p class="font-bold text-purple-700 dark:text-purple-300">${b.total_productos || 0}</p></div>
                      <div><p class="text-xs text-gray-500 dark:text-gray-400">Clientes</p><p class="font-bold text-purple-700 dark:text-purple-300">${b.clientes_distintos}</p></div>
                      <div><p class="text-xs text-gray-500 dark:text-gray-400">Total</p><p class="font-bold text-green-700 dark:text-green-300">$${Number(b.total_acumulado).toFixed(2)}</p></div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-gray-500 dark:text-gray-400 text-sm">No hay barberos activos en este cierre de caja.</p>'}
          </div>

        ` : `
          <div class="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-lg border border-blue-200 dark:border-blue-700 text-center">
            <i class="fas fa-inbox text-4xl text-blue-600 dark:text-blue-400 mb-3 block"></i>
            <p class="text-gray-700 dark:text-gray-300 font-semibold">No hay caja abierta</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Abre una caja desde el módulo de Ventas para continuar</p>
          </div>
        `}
      </div>

      <!-- Modal de confirmación -->
      <div id="modalCierre" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
            <i class="fas fa-check-circle text-green-600 mr-2"></i>Confirmar Cierre de Caja
          </h3>
          <div class="space-y-2 text-sm">
            <div class="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 flex justify-between border border-green-200 dark:border-green-700">
              <span class="text-gray-700 dark:text-gray-300">Efectivo — Esperado vs Real:</span>
              <span class="font-bold text-gray-900 dark:text-white" id="modalEfectivo">—</span>
            </div>
            <div class="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 flex justify-between border border-purple-200 dark:border-purple-700">
              <span class="text-gray-700 dark:text-gray-300">Transferencia — Esperado vs Real:</span>
              <span class="font-bold text-gray-900 dark:text-white" id="modalTransferencia">—</span>
            </div>
            <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 flex justify-between border border-blue-200 dark:border-blue-700">
              <span class="text-gray-700 dark:text-gray-300">Tarjeta/Cheque — Esperado vs Real:</span>
              <span class="font-bold text-gray-900 dark:text-white" id="modalTarjeta">—</span>
            </div>
            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600 space-y-1">
              <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Total esperado:</span> <strong class="text-gray-900 dark:text-white" id="modalExpected">$0.00</strong></div>
              <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Total ingresado:</span> <strong class="text-gray-900 dark:text-white" id="modalIngresado">$0.00</strong></div>
              <div class="flex justify-between pt-1 border-t border-gray-200 dark:border-gray-600"><span class="text-gray-600 dark:text-gray-400">Diferencia total:</span> <strong id="modalDiferencia" class="text-gray-900 dark:text-white">$0.00</strong></div>
              <div class="flex justify-between"><span class="text-gray-600 dark:text-gray-400">Estado:</span> <strong id="modalEstado" class="font-bold">—</strong></div>
            </div>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400"><i class="fas fa-info-circle mr-1"></i>Se guardará el registro del cierre.</p>
          <div class="flex gap-2 pt-2">
            <button id="btnCancelarModalCierre" class="flex-1 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white font-medium">Cancelar</button>
            <button id="btnConfirmarModalCierre" class="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium">Confirmar cierre</button>
          </div>
        </div>
      </div>
    `;
  },

  renderTabHistorial() {
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

          <!-- Ventas del día -->
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-semibold mb-3 text-gray-900 dark:text-white">
              <i class="fas fa-shopping-cart mr-2 text-blue-600"></i>Ventas del día (${this.state.ventas_dia.length})
            </h3>
            <div class="max-h-96 overflow-y-auto">
              ${this.state.ventas_dia.length ? `
                <div class="space-y-2">
                  ${this.state.ventas_dia.map(v => `
                    <div class="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm">
                      <div class="flex justify-between gap-2">
                        <div>
                          <strong>${v.numero_ticket}</strong> • ${v.cliente_nombre ? v.cliente_nombre + ' ' + (v.cliente_apellido || '') : 'Sin cliente'}
                        </div>
                        <div class="font-semibold text-green-700 dark:text-green-300">$${Number(v.total).toFixed(2)}</div>
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <i class="fas fa-clock mr-1"></i>${new Date(v.fecha_venta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} • 
                        ${v.medio_pago}
                      </p>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-gray-500 dark:text-gray-400">No hay ventas registradas.</p>'}
            </div>
          </div>

          <!-- Barberos del día -->
          <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 class="font-semibold mb-3 text-gray-900 dark:text-white">
              <i class="fas fa-scissors mr-2 text-purple-600"></i>Barberos activos del día (${this.state.barberos_dia.length})
            </h3>
            <div class="max-h-96 overflow-y-auto">
              ${this.state.barberos_dia.length ? `
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  ${this.state.barberos_dia.map(b => `
                    <div class="p-4 rounded-lg bg-gradient-to-br from-purple-50 dark:from-purple-900/20 to-indigo-50 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-700">
                      <div class="flex justify-between items-start mb-2">
                        <div>
                          <p class="font-bold text-gray-900 dark:text-white">${b.nombre} ${b.apellido}</p>
                          <p class="text-xs text-purple-700 dark:text-purple-300 font-mono">Código: ${b.codigo_barbero}</p>
                        </div>
                      </div>
                      <div class="grid grid-cols-2 gap-2 text-sm mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                        <div>
                          <p class="text-xs text-gray-600 dark:text-gray-400">Ventas</p>
                          <p class="font-bold text-purple-700 dark:text-purple-300">${b.total_ventas}</p>
                        </div>
                        <div>
                          <p class="text-xs text-gray-600 dark:text-gray-400">Cortes</p>
                          <p class="font-bold text-purple-700 dark:text-purple-300">${b.total_productos || 0}</p>
                        </div>
                        <div>
                          <p class="text-xs text-gray-600 dark:text-gray-400">Clientes</p>
                          <p class="font-bold text-purple-700 dark:text-purple-300">${b.clientes_distintos}</p>
                        </div>
                        <div>
                          <p class="text-xs text-gray-600 dark:text-gray-400">Total venta</p>
                          <p class="font-bold text-green-700 dark:text-green-300">$${Number(b.total_acumulado).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="text-gray-500 dark:text-gray-400">No hay barberos activos en este cierre de caja.</p>'}
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Monto retirado</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                <input id="montoRetirado" type="number" step="0.01" placeholder="0.00" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Monto en caja</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                <input id="montoEnCaja" type="number" step="0.01" placeholder="0.00" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Transferencia a caja admin</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                <input id="transferenciaAdmin" type="number" step="0.01" placeholder="0.00" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Saldo inicial siguiente</label>
              <div class="relative">
                <span class="absolute left-3 top-2 text-gray-500 dark:text-gray-400">$</span>
                <input id="saldoInicialSiguiente" type="number" step="0.01" placeholder="0.00" class="w-full pl-8 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500" />
          <div class="bg-gray-50 dark:bg-gray-900/20 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between text-sm text-gray-700 dark:text-gray-300">
              <span>Total real estimado</span>
              <strong id="actualTotal">$0.00</strong>
            </div>
            <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Esperado en caja: $${(this.state.resumen_caja?.expected_cash || 0).toFixed(2)}
            </p>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Observaciones</label>
            <textarea id="closeObservaciones" class="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" placeholder="Notas adicionales..." rows="3"></textarea>
          </div>

          <div class="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button id="btnGenerarPDFCierre" class="flex-1 px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 font-medium transition">
              <i class="fas fa-file-pdf mr-1"></i> Descargar PDF
            </button>
            <button id="btnConfirmarCierre" class="flex-1 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-medium transition">
              <i class="fas fa-check"></i> Cerrar Caja
            </button>
          </div>
        ` : `
          <div class="bg-blue-50 dark:bg-blue-900/20 p-8 rounded-lg border border-blue-200 dark:border-blue-700 text-center">
            <i class="fas fa-inbox text-4xl text-blue-600 dark:text-blue-400 mb-3 block"></i>
            <p class="text-gray-700 dark:text-gray-300 font-semibold">No hay caja abierta</p>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-2">Abre una caja desde el módulo de Ventas para continuar</p>
          </div>
        `}
      </div>

      <!-- Modal de confirmación -->
      <div id="modalCierre" class="hidden fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 space-y-4">
          <h3 class="text-lg font-bold text-gray-900 dark:text-gray-100">
            <i class="fas fa-check-circle text-green-600 mr-2"></i>Confirmar Cierre de Caja
          </h3>
          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
            <p><span class="text-gray-600 dark:text-gray-400">Total esperado:</span> <span class="font-bold text-gray-900 dark:text-white" id="modalExpected">$0.00</span></p>
            <p><span class="text-gray-600 dark:text-gray-400">Total ingresado:</span> <span class="font-bold text-gray-900 dark:text-white" id="modalIngresado">$0.00</span></p>
            <p class="border-t border-gray-200 dark:border-gray-600 pt-2"><span class="text-gray-600 dark:text-gray-400">Diferencia:</span> <span class="font-bold text-gray-900 dark:text-white" id="modalDiferencia">$0.00</span></p>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400">
            <i class="fas fa-info-circle mr-1"></i>Se guardará el registro del cierre.
          </p>
          <div class="flex gap-2 pt-2">
            <button id="btnCancelarModalCierre" class="flex-1 px-4 py-2 rounded-lg bg-gray-300 dark:bg-gray-600 font-medium">Cancelar</button>
            <button id="btnConfirmarModalCierre" class="flex-1 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-medium">Confirmar</button>
          </div>
        </div>
      </div>
    `;
  },

  renderTabHistorial() {
    return `
      <div class="space-y-4">
        <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Fecha/Hora</th>
                  <th class="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-300">Usuario</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Esperado</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Real</th>
                  <th class="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-300">Diferencia</th>
                  <th class="px-4 py-3 text-center font-semibold text-gray-700 dark:text-gray-300">Acciones</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                ${this.state.historial_cierres.length ? this.state.historial_cierres.map(cierre => {
                  const monto_real = (cierre.monto_retirado || 0) + (cierre.monto_en_caja || 0) + (cierre.transferencia_admin || 0);
                  const estado_clase = cierre.diferencia === 0 ? 'text-green-600' : (cierre.diferencia > 0 ? 'text-orange-600' : 'text-red-600');
                  const estado_texto = cierre.diferencia === 0 ? 'OK' : (cierre.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
                  return `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800 transition">
                      <td class="px-4 py-3 text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        <div class="font-medium">${new Date(cierre.fecha_cierre).toLocaleDateString('es-ES')}</div>
                        <div class="text-xs text-gray-500 dark:text-gray-400">${new Date(cierre.fecha_cierre).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                      </td>
                      <td class="px-4 py-3 text-gray-900 dark:text-gray-100">${cierre.usuario_nombre || 'N/A'}</td>
                      <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">$${(cierre.monto_final_esperado || 0).toFixed(2)}</td>
                      <td class="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">$${monto_real.toFixed(2)}</td>
                      <td class="px-4 py-3 text-right font-bold ${estado_clase}">
                        $${Math.abs(cierre.diferencia || 0).toFixed(2)} <span class="text-xs ml-1">(${estado_texto})</span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <button data-cierre-id="${cierre.id}" class="btnDescargarPDFHistorial px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium transition">
                          <i class="fas fa-download mr-1"></i>PDF
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="6" class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                      <i class="fas fa-inbox text-3xl mb-3 block opacity-50"></i>
                      No hay cierres registrados
                    </td>
                  </tr>
                `}
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

    document.removeEventListener('keydown', handleEsc);
    document.addEventListener('keydown', handleEsc);
    modal.removeEventListener('click', handleClickOutside);
    modal.addEventListener('click', handleClickOutside);

    if (closeButtonId) {
      document.getElementById(closeButtonId)?.addEventListener('click', () => modal.classList.add('hidden'));
    }
  },

  attachEvents() {
    const $ = (id) => document.getElementById(id);

    // Tabs
    $('tabCierre')?.addEventListener('click', () => {
      this.state.tab_activo = 'cierre';
      this.renderUI();
      this.attachEvents();
    });
    $('tabHistorial')?.addEventListener('click', () => {
      this.state.tab_activo = 'historial';
      this.renderUI();
      this.attachEvents();
    });

    // Registrar movimiento
    $('btnRegistrarMovimiento')?.addEventListener('click', () => this.registrarMovimiento());

    // Generar PDF cierre actual
    $('btnGenerarPDFCierre')?.addEventListener('click', () => this.generarPDFCierre());

    // Cerrar caja
    $('btnConfirmarCierre')?.addEventListener('click', () => this.confirmarCierre());

    // Modal
    $('btnConfirmarModalCierre')?.addEventListener('click', () => this.procesarCierre());
    $('btnCancelarModalCierre')?.addEventListener('click', () => $('modalCierre')?.classList.add('hidden'));

    // Configurar cierre de modales con ESC y click fuera
    this.setupModalClose('modalCierre', 'btnCancelarModalCierre');

    // Calcular diferencias en tiempo real
    const inputs = [$('efectivoReal'), $('transferenciaReal'), $('tarjetaReal')];
    inputs.forEach(input => {
      if (input) {
        input.addEventListener('input', () => this.actualizarDiferencias());
      }
    });

    // Descargar PDFs del historial
    document.querySelectorAll('.btnDescargarPDFHistorial').forEach(btn => {
      btn.addEventListener('click', (e) => this.descargarPDFHistorial(e.target.closest('button').dataset.cierreId));
    });
  },

  actualizarDiferencias() {
    const r = this.state.resumen_caja;
    const caja = this.state.caja_actual;
    const montoInicial = caja?.monto_inicial || 0;
    const egresos = r?.total_egresos || 0;
    const efectivoEsp = montoInicial + (r?.pagos?.efectivo || 0) - egresos;
    const transferenciaEsp = r?.pagos?.transferencia || 0;
    const tarjetaEsp = (r?.pagos?.tarjeta || 0) + (r?.pagos?.cheque || 0);
    const totalEsp = efectivoEsp + transferenciaEsp + tarjetaEsp;

    const efectivoReal = parseFloat(document.getElementById('efectivoReal')?.value) || NaN;
    const transferenciaReal = parseFloat(document.getElementById('transferenciaReal')?.value) || NaN;
    const tarjetaReal = parseFloat(document.getElementById('tarjetaReal')?.value) || NaN;

    const setDif = (elId, esp, real) => {
      const el = document.getElementById(elId);
      if (!el) return;
      if (isNaN(real)) { el.innerHTML = '<p class="font-bold text-gray-500 dark:text-gray-400">—</p>'; return; }
      const dif = real - esp;
      el.innerHTML = this._getDifHtml(dif);
    };

    setDif('difEfectivo', efectivoEsp, efectivoReal);
    setDif('difTransferencia', transferenciaEsp, transferenciaReal);
    setDif('difTarjeta', tarjetaEsp, tarjetaReal);

    // Total
    const totalRealEl = document.getElementById('totalReal');
    const estadoEl = document.getElementById('estadoCierre');
    const allFilled = !isNaN(efectivoReal) && !isNaN(transferenciaReal) && !isNaN(tarjetaReal);
    if (allFilled) {
      const totalReal = efectivoReal + transferenciaReal + tarjetaReal;
      if (totalRealEl) totalRealEl.textContent = `$${totalReal.toFixed(2)}`;
      const dif = totalReal - totalEsp;
      if (estadoEl) {
        if (dif === 0) { estadoEl.textContent = '✓ CIERRE CORRECTO'; estadoEl.className = 'font-bold text-green-600 dark:text-green-400'; }
        else if (dif > 0) { estadoEl.textContent = `SOBRANTE $${dif.toFixed(2)}`; estadoEl.className = 'font-bold text-orange-500'; }
        else { estadoEl.textContent = `FALTANTE $${Math.abs(dif).toFixed(2)}`; estadoEl.className = 'font-bold text-red-500'; }
      }
    } else {
      if (totalRealEl) totalRealEl.textContent = '$0.00';
      if (estadoEl) { estadoEl.textContent = 'Completar campos'; estadoEl.className = 'font-bold text-gray-400'; }
    }
  },

  confirmarCierre() {
    if (!this.state.caja_actual) return;
    const r = this.state.resumen_caja;
    const caja = this.state.caja_actual;
    const montoInicial = caja?.monto_inicial || 0;
    const egresos = r?.total_egresos || 0;
    const efectivoEsp = montoInicial + (r?.pagos?.efectivo || 0) - egresos;
    const transferenciaEsp = r?.pagos?.transferencia || 0;
    const tarjetaEsp = (r?.pagos?.tarjeta || 0) + (r?.pagos?.cheque || 0);
    const totalEsp = efectivoEsp + transferenciaEsp + tarjetaEsp;

    const efectivoReal = parseFloat(document.getElementById('efectivoReal')?.value) || 0;
    const transferenciaReal = parseFloat(document.getElementById('transferenciaReal')?.value) || 0;
    const tarjetaReal = parseFloat(document.getElementById('tarjetaReal')?.value) || 0;
    const totalReal = efectivoReal + transferenciaReal + tarjetaReal;
    const diferencia = totalReal - totalEsp;

    const fmtRow = (esp, real) => {
      const d = real - esp;
      const tag = d === 0 ? '✓ OK' : (d > 0 ? `SOBRANTE +$${d.toFixed(2)}` : `FALTANTE -$${Math.abs(d).toFixed(2)}`);
      return `$${esp.toFixed(2)} → $${real.toFixed(2)} (${tag})`;
    };

    document.getElementById('modalEfectivo').textContent = fmtRow(efectivoEsp, efectivoReal);
    document.getElementById('modalTransferencia').textContent = fmtRow(transferenciaEsp, transferenciaReal);
    document.getElementById('modalTarjeta').textContent = fmtRow(tarjetaEsp, tarjetaReal);
    document.getElementById('modalExpected').textContent = `$${totalEsp.toFixed(2)}`;
    document.getElementById('modalIngresado').textContent = `$${totalReal.toFixed(2)}`;
    document.getElementById('modalDiferencia').textContent = diferencia >= 0 ? `+$${diferencia.toFixed(2)}` : `-$${Math.abs(diferencia).toFixed(2)}`;
    const estadoEl = document.getElementById('modalEstado');
    if (diferencia === 0) { estadoEl.textContent = '✓ CORRECTO'; estadoEl.className = 'font-bold text-green-600'; }
    else if (diferencia > 0) { estadoEl.textContent = 'SOBRANTE'; estadoEl.className = 'font-bold text-orange-500'; }
    else { estadoEl.textContent = 'FALTANTE'; estadoEl.className = 'font-bold text-red-500'; }

    document.getElementById('modalCierre')?.classList.remove('hidden');
  },

  async registrarMovimiento() {
    const tipo = document.getElementById('movimientoTipo').value;
    const categoria = document.getElementById('movimientoCategoria').value.trim();
    const monto = parseFloat(document.getElementById('movimientoMonto').value) || 0;
    const descripcion = document.getElementById('movimientoDescripcion').value.trim();

    if (!categoria || monto <= 0) {
      this.showToast('Completa los campos requeridos', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/cajas/${this.state.caja_actual.id}/movimientos`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({ tipo, categoria, monto, descripcion })
      });

      if (!res.ok) throw new Error('Error al registrar movimiento');

      this.showToast('Movimiento registrado', 'success');
      document.getElementById('movimientoCategoria').value = '';
      document.getElementById('movimientoMonto').value = '';
      document.getElementById('movimientoDescripcion').value = '';

      await this.cargarResumenCaja(this.state.caja_actual.id);
      await this.cargarMovimientosCaja(this.state.caja_actual.id);
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  },

  async procesarCierre() {
    const efectivoReal = parseFloat(document.getElementById('efectivoReal')?.value) || 0;
    const transferenciaReal = parseFloat(document.getElementById('transferenciaReal')?.value) || 0;
    const tarjetaReal = parseFloat(document.getElementById('tarjetaReal')?.value) || 0;
    const montoInicialManana = parseFloat(document.getElementById('montoInicialManana')?.value) || 0;
    const observaciones = document.getElementById('closeObservaciones')?.value || '';

    try {
      const res = await fetch(`/api/cajas/cerrar`, {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({
          caja_id: this.state.caja_actual.id,
          monto_retirado: transferenciaReal,
          monto_en_caja: efectivoReal,
          transferencia_admin: tarjetaReal,
          saldo_inicial_siguiente: montoInicialManana,
          observaciones
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Error al cerrar caja');
      }

      const data = await res.json();
      const status = data.diferencia === 0 ? 'OK' : (data.diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');
      alert(`Caja Cerrada\n\nEsperado: $${data.monto_esperado.toFixed(2)}\nReal: $${data.monto_real.toFixed(2)}\nDiferencia: $${Math.abs(data.diferencia).toFixed(2)}\nEstado: ${status}`);

      cierreCajaEmitter.notificarCierreCaja(data);

      document.getElementById('modalCierre')?.classList.add('hidden');
      this.state.caja_actual = null;
      this.state.resumen_caja = null;
      this.state.movimientos_caja = [];
      this.state.ventas_dia = [];
      await this.cargarHistorialCierres();
      this.renderUI();
      this.attachEvents();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  },

  async generarPDFCierre() {
    if (!this.state.caja_actual) return;

    try {
      const fechaFormato = new Date().toLocaleDateString('es-ES', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
      });

      const ventasHTML = this.state.ventas_dia.map(v => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${v.numero_ticket}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${new Date(v.fecha_venta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${v.cliente_nombre ? v.cliente_nombre + ' ' + (v.cliente_apellido || '') : 'Sin cliente'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${Number(v.total).toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${v.medio_pago}</td>
        </tr>
      `).join('');

      const movimientosHTML = this.state.movimientos_caja.map(m => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${m.tipo}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${m.categoria || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">$${Number(m.monto).toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${m.descripcion || ''}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${new Date(m.fecha_movimiento).toLocaleString()}</td>
        </tr>
      `).join('');

      const montoRetirado = parseFloat(document.getElementById('montoRetirado').value) || 0;
      const montoEnCaja = parseFloat(document.getElementById('montoEnCaja').value) || 0;
      const transferenciaAdmin = parseFloat(document.getElementById('transferenciaAdmin').value) || 0;
      const totalEsperado = this.state.resumen_caja?.expected_cash || 0;
      const totalReal = montoRetirado + montoEnCaja;
      const diferencia = totalReal - totalEsperado;

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #333; padding-bottom: 15px; }
            h1 { margin: 0; color: #333; }
            .subtitle { color: #666; font-size: 14px; margin: 5px 0; }
            .section { margin: 20px 0; }
            .section-title { background-color: #f0f0f0; padding: 10px; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #333; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { background-color: #e0e0e0; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #ccc; }
            td { padding: 8px; }
            .total-row { background-color: #f9f9f9; font-weight: bold; }
            .summary { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .summary-box { flex: 1; min-width: 150px; border: 2px solid #ddd; padding: 15px; text-align: center; }
            .summary-label { font-size: 12px; color: #666; margin-bottom: 5px; }
            .summary-value { font-size: 20px; font-weight: bold; color: #333; }
            .status-ok { color: green; }
            .status-faltante { color: red; }
            .status-sobrante { color: orange; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CIERRE DE CAJA</h1>
            <p class="subtitle">Fecha: ${fechaFormato}</p>
            <p class="subtitle">Sucursal: ${this.state.caja_actual.sucursal_nombre}</p>
          </div>

          <div class="section">
            <div class="summary">
              <div class="summary-box">
                <div class="summary-label">SALDO INICIAL</div>
                <div class="summary-value">$${(this.state.caja_actual.monto_inicial || 0).toFixed(2)}</div>
              </div>
              <div class="summary-box">
                <div class="summary-label">TOTAL ESPERADO</div>
                <div class="summary-value">$${totalEsperado.toFixed(2)}</div>
              </div>
              <div class="summary-box">
                <div class="summary-label">TOTAL REAL</div>
                <div class="summary-value">$${totalReal.toFixed(2)}</div>
              </div>
              <div class="summary-box">
                <div class="summary-label">DIFERENCIA</div>
                <div class="summary-value ${diferencia === 0 ? 'status-ok' : (diferencia > 0 ? 'status-sobrante' : 'status-faltante')}">
                  $${Math.abs(diferencia).toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">RESUMEN DE PAGOS</div>
            <table>
              <tr class="total-row">
                <td>Efectivo:</td>
                <td style="text-align: right;">$${(this.state.resumen_caja?.pagos?.efectivo || 0).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Tarjeta:</td>
                <td style="text-align: right;">$${(this.state.resumen_caja?.pagos?.tarjeta || 0).toFixed(2)}</td>
              </tr>
              <tr class="total-row">
                <td>Transferencia:</td>
                <td style="text-align: right;">$${(this.state.resumen_caja?.pagos?.transferencia || 0).toFixed(2)}</td>
              </tr>
              <tr style="background-color: #fff; font-weight: bold; font-size: 16px;">
                <td>TOTAL VENTAS:</td>
                <td style="text-align: right;">$${(this.state.resumen_caja?.total_ventas || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="section">
            <div class="section-title">DETALLES DE VENTAS (${this.state.ventas_dia.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Medio Pago</th>
                </tr>
              </thead>
              <tbody>
                ${ventasHTML}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">OTROS MOVIMIENTOS</div>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th>Fecha/Hora</th>
                </tr>
              </thead>
              <tbody>
                ${movimientosHTML || '<tr><td colspan="5" style="text-align: center; color: #999;">Sin movimientos adicionales</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">DETALLES DEL CIERRE</div>
            <table>
              <tr>
                <td><strong>Monto Retirado:</strong></td>
                <td style="text-align: right;">$${montoRetirado.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Monto en Caja:</strong></td>
                <td style="text-align: right;">$${montoEnCaja.toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Transferencia Admin:</strong></td>
                <td style="text-align: right;">$${transferenciaAdmin.toFixed(2)}</td>
              </tr>
              <tr style="background-color: #f0f0f0; font-weight: bold; font-size: 16px;">
                <td>TOTAL CONTABILIZADO:</td>
                <td style="text-align: right;">$${(montoRetirado + montoEnCaja + transferenciaAdmin).toFixed(2)}</td>
              </tr>
            </table>
          </div>

          <div class="footer">
            <p>Generado el ${new Date().toLocaleString()}</p>
            <p>Este documento ha sido generado automáticamente por el sistema POS</p>
          </div>
        </body>
        </html>
      `;

      const element = document.createElement('div');
      element.innerHTML = html;
      const opt = {
        margin: 10,
        filename: `cierre-caja-${new Date().toISOString().split('T')[0]}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };
      html2pdf().set(opt).from(html).save();
      this.showToast('PDF descargado exitosamente', 'success');
    } catch (error) {
      this.showToast('Error al generar PDF', 'error');
      console.error(error);
    }
  },

  async descargarPDFHistorial(cierreId) {
    try {
      const cierre = this.state.historial_cierres.find(c => c.id == cierreId);
      if (!cierre) return;

      // Cargar detalles del cierre
      const res = await fetch(`/api/cajas/${cierreId}`, { headers: api.getHeaders() });
      if (!res.ok) throw new Error('Error al cargar cierre');
      const cajaCompleta = await res.json();

      // Cargar ventas de esa caja
      const resVentas = await fetch(`/api/ventas/caja/${cierreId}`, { headers: api.getHeaders() });
      const ventas = resVentas.ok ? await resVentas.json() : [];

      // Cargar movimientos
      const resMovimientos = await fetch(`/api/cajas/${cierreId}/movimientos`, { headers: api.getHeaders() });
      const movimientos = resMovimientos.ok ? await resMovimientos.json() : [];

      const ventasHTML = ventas.map(v => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${v.numero_ticket}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${new Date(v.fecha_venta).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${v.cliente_nombre ? v.cliente_nombre + ' ' + (v.cliente_apellido || '') : 'Sin cliente'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: right;">$${Number(v.total).toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0; text-align: center;">${v.medio_pago}</td>
        </tr>
      `).join('');

      const movimientosHTML = movimientos.map(m => `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${m.tipo}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${m.categoria || '-'}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">$${Number(m.monto).toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${m.descripcion || ''}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${new Date(m.fecha_movimiento).toLocaleString()}</td>
        </tr>
      `).join('');

      const monto_real = (cierre.monto_retirado || 0) + (cierre.monto_en_caja || 0) + (cierre.transferencia_admin || 0);
      const diferencia = monto_real - (cierre.monto_final_esperado || 0);
      const estado = diferencia === 0 ? 'OK' : (diferencia > 0 ? 'SOBRANTE' : 'FALTANTE');

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #333; padding-bottom: 15px; }
            h1 { margin: 0; color: #333; }
            .subtitle { color: #666; font-size: 14px; margin: 5px 0; }
            .section { margin: 20px 0; }
            .section-title { background-color: #f0f0f0; padding: 10px; font-weight: bold; margin-bottom: 10px; border-left: 4px solid #333; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th { background-color: #e0e0e0; padding: 10px; text-align: left; font-weight: bold; border: 1px solid #ccc; }
            td { padding: 8px; }
            .total-row { background-color: #f9f9f9; font-weight: bold; }
            .summary { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
            .summary-box { flex: 1; min-width: 150px; border: 2px solid #ddd; padding: 15px; text-align: center; }
            .summary-label { font-size: 12px; color: #666; margin-bottom: 5px; }
            .summary-value { font-size: 20px; font-weight: bold; color: #333; }
            .status-ok { color: green; }
            .status-faltante { color: red; }
            .status-sobrante { color: orange; }
            .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CIERRE DE CAJA (HISTORIAL)</h1>
            <p class="subtitle">Fecha: ${new Date(cierre.fecha_cierre).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            <p class="subtitle">Hora: ${new Date(cierre.fecha_cierre).toLocaleTimeString()}</p>
            <p class="subtitle">Sucursal: ${cierre.sucursal_nombre}</p>
            <p class="subtitle">Usuario: ${cierre.usuario_nombre}</p>
          </div>

          <div class="section">
            <div class="summary">
              <div class="summary-box">
                <div class="summary-label">SALDO INICIAL</div>
                <div class="summary-value">$${(cajaCompleta.monto_inicial || 0).toFixed(2)}</div>
              </div>
              <div class="summary-box">
                <div class="summary-label">TOTAL ESPERADO</div>
                <div class="summary-value">$${(cierre.monto_final_esperado || 0).toFixed(2)}</div>
              </div>
              <div class="summary-box">
                <div class="summary-label">TOTAL REAL</div>
                <div class="summary-value">$${monto_real.toFixed(2)}</div>
              </div>
              <div class="summary-box">
                <div class="summary-label">DIFERENCIA</div>
                <div class="summary-value ${diferencia === 0 ? 'status-ok' : (diferencia > 0 ? 'status-sobrante' : 'status-faltante')}">
                  $${Math.abs(diferencia).toFixed(2)} (${estado})
                </div>
              </div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">DETALLES DE VENTAS (${ventas.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Hora</th>
                  <th>Cliente</th>
                  <th>Monto</th>
                  <th>Medio Pago</th>
                </tr>
              </thead>
              <tbody>
                ${ventasHTML || '<tr><td colspan="5" style="text-align: center; color: #999;">Sin ventas</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">OTROS MOVIMIENTOS</div>
            <table>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Categoría</th>
                  <th>Monto</th>
                  <th>Descripción</th>
                  <th>Fecha/Hora</th>
                </tr>
              </thead>
              <tbody>
                ${movimientosHTML || '<tr><td colspan="5" style="text-align: center; color: #999;">Sin movimientos adicionales</td></tr>'}
              </tbody>
            </table>
          </div>

          <div class="section">
            <div class="section-title">DETALLES DEL CIERRE</div>
            <table>
              <tr>
                <td><strong>Monto Retirado:</strong></td>
                <td style="text-align: right;">$${(cierre.monto_retirado || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Monto en Caja:</strong></td>
                <td style="text-align: right;">$${(cierre.monto_en_caja || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Transferencia Admin:</strong></td>
                <td style="text-align: right;">$${(cierre.transferencia_admin || 0).toFixed(2)}</td>
              </tr>
              <tr style="background-color: #f0f0f0; font-weight: bold; font-size: 16px;">
                <td>TOTAL CONTABILIZADO:</td>
                <td style="text-align: right;">$${monto_real.toFixed(2)}</td>
              </tr>
            </table>
            ${cierre.observaciones ? `<p><strong>Observaciones:</strong> ${cierre.observaciones}</p>` : ''}
          </div>

          <div class="footer">
            <p>Documento generado el ${new Date().toLocaleString()}</p>
            <p>Este es un registro histórico del cierre de caja realizado</p>
          </div>
        </body>
        </html>
      `;

      const opt = {
        margin: 10,
        filename: `cierre-caja-${new Date(cierre.fecha_cierre).toISOString().split('T')[0]}-${cierre.usuario_nombre}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2 },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
      };
      html2pdf().set(opt).from(html).save();
      this.showToast('PDF descargado exitosamente', 'success');
    } catch (error) {
      this.showToast('Error al descargar PDF', 'error');
      console.error(error);
    }
  }
};
*/