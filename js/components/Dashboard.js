import { api } from "../api-client.js";
export default {
  state: { resumen: {}, cajas: [], ventas_recientes: [], alertas: [] },
  async render(c, p) {
    this.container = c;
    try { await Promise.all([this.cargarDatos()]); } catch (e) { }
    this.renderUI();
    this.attachEvents();
  },
  async cargarDatos() {
    try {
      const [cajas, ventas, stockBajo] = await Promise.all([
        fetch("/api/cajas?filtro=hoy", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []),
        fetch("/api/ventas", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []),
        fetch("/api/reportes/stock-bajo", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : [])
      ]);
      const hoy = new Date().toISOString().split("T")[0];
      const ventasDelDia = ventas.filter(v => (v.fecha_venta || "").includes(hoy));
      const ventas_hoy = ventasDelDia.length;
      const ingresos = ventasDelDia.reduce((s, v) => s + (v.total || 0), 0);
      const ticket_promedio = ventas_hoy > 0 ? Math.round(ingresos / ventas_hoy) : 0;
      this.state.resumen = { ventas_hoy, ingresos, cajas_abiertas: cajas.length, ticket_promedio };
      this.state.cajas = cajas;
      this.state.ventas_recientes = ventas.slice(-5).reverse();
      this.state.stock_bajo = stockBajo;
      this.generarAlertas();
    } catch (e) { this.state.resumen = {}; }
  },
  generarAlertas() {
    this.state.alertas = [];
    if (this.state.cajas.length === 0) this.state.alertas.push({ tipo: "warning", icon: "fa-cash-register", msg: "Sin cajas abiertas hoy" });
    if ((this.state.resumen.ingresos || 0) === 0 && (this.state.resumen.ventas_hoy || 0) === 0) {
      this.state.alertas.push({ tipo: "warning", icon: "fa-chart-line", msg: "Sin ventas registradas hoy" });
    }
    (this.state.stock_bajo || []).slice(0, 3).forEach(p => {
      this.state.alertas.push({ tipo: "danger", icon: "fa-box-open", msg: `Stock bajo: ${p.nombre} (${p.stock_total} u.)` });
    });
  },
  renderUI() {
    const { ventas_hoy, ingresos, cajas_abiertas, ticket_promedio } = this.state.resumen;
    const color = (t) => t === "warning" ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200" : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200";
    const fmt = (n) => "$" + (n || 0).toLocaleString("es-AR", { maximumFractionDigits: 0 });
    this.container.innerHTML = `
      <div class="space-y-6">
        ${this.state.alertas.length ? `<div class="space-y-2">${this.state.alertas.map(a => `<div class="p-4 rounded border ${color(a.tipo)} flex items-center gap-3"><i class="fas ${a.icon}"></i><span>${a.msg}</span></div>`).join("")}</div>` : ""}
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/50 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-sm font-medium text-blue-600 dark:text-blue-400">Ventas Hoy</h3>
              <i class="fas fa-chart-bar text-2xl text-blue-500"></i>
            </div>
            <p class="text-4xl font-bold text-blue-900 dark:text-blue-100">${ventas_hoy || 0}</p>
            <p class="text-xs text-blue-600 dark:text-blue-400 mt-1">Tickets procesados</p>
          </div>
          
          <div class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-900/50 border border-green-200 dark:border-green-800 rounded-lg p-6">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-sm font-medium text-green-600 dark:text-green-400">Ingresos</h3>
              <i class="fas fa-money-bill-wave text-2xl text-green-500"></i>
            </div>
            <p class="text-4xl font-bold text-green-900 dark:text-green-100">${fmt(ingresos)}</p>
            <p class="text-xs text-green-600 dark:text-green-400 mt-1">Total acumulado</p>
          </div>
          
          <div class="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-900/50 border border-purple-200 dark:border-purple-800 rounded-lg p-6">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-sm font-medium text-purple-600 dark:text-purple-400">Ticket Promedio</h3>
              <i class="fas fa-arrow-trend-up text-2xl text-purple-500"></i>
            </div>
            <p class="text-4xl font-bold text-purple-900 dark:text-purple-100">${fmt(ticket_promedio)}</p>
            <p class="text-xs text-purple-600 dark:text-purple-400 mt-1">Valor promedio</p>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-cash-register mr-2"></i>Cajas Abiertas</h2>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Caja</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Sucursal</th>
                    <th class="px-6 py-3 text-right text-gray-700 dark:text-gray-300 font-semibold">Inicial</th>
                    <th class="px-6 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  ${this.state.cajas.length ? this.state.cajas.map(c => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td class="px-6 py-4 text-gray-900 dark:text-gray-100 font-medium">Caja #${c.numero || c.id}</td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${c.sucursal_nombre || "Principal"}</td>
                      <td class="px-6 py-4 text-right text-gray-900 dark:text-gray-100 font-medium">$${(c.monto_inicial || 0).toLocaleString("es-AR")}</td>
                      <td class="px-6 py-4 text-center"><span class="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">Abierta</span></td>
                    </tr>
                  `).join("") : "<tr><td colspan='4' class='px-6 py-8 text-center text-gray-500 dark:text-gray-400'>Sin cajas abiertas</td></tr>"}
                </tbody>
              </table>
            </div>
          </div>

          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <h2 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-history mr-2"></i>Últimas Transacciones</h2>
            </div>
            <div class="overflow-y-auto max-h-64">
              <div class="divide-y divide-gray-200 dark:divide-gray-700">
                ${this.state.ventas_recientes.length ? this.state.ventas_recientes.map(v => `
                  <div class="px-6 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition flex justify-between items-center">
                    <div>
                      <p class="text-sm font-medium text-gray-900 dark:text-gray-100">Venta #${v.id}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">${v.fecha_venta || "N/A"}</p>
                    </div>
                    <span class="text-lg font-bold text-green-600 dark:text-green-400">$${(v.total || 0).toLocaleString("es-AR")}</span>
                  </div>
                `).join("") : "<div class='px-6 py-8 text-center text-gray-500 dark:text-gray-400'>Sin transacciones</div>"}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },
  attachEvents() {}
};
