import { sortableTables } from '../utils/table-utils.js';
﻿import { api } from "../api-client.js";
import { exportarCSV, fmtMoney } from "../utils/print-utils.js";
import dateUtils from "../utils/date-utils.js";
import toast from "../utils/toast.js";

export default {
  state: {
    reportes: [], productos: [], clientes: [], barberos: [],
    fecha_inicio: "", fecha_fin: "", tab: "ventas", cargando: false
  },

  async render(c) {
    this.container = c;
    const hoy = new Intl.DateTimeFormat('sv-SE', { timeZone: dateUtils.TIMEZONE }).format(new Date());
    const primerDiaMes = `${hoy.slice(0, 7)}-01`;
    this.state.fecha_inicio = primerDiaMes;
    this.state.fecha_fin = hoy;
    await this.cargarReportes();
    this.renderUI();
    this.attachEvents();
  },

  // Resiliente: cada fetch falla de forma independiente
  async _safeGet(url) {
    try {
      const r = await fetch(url, { headers: api.getHeaders() });
      if (!r.ok) return [];
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    } catch { return []; }
  },

  async cargarReportes() {
    this.state.cargando = true;
    const fi = this.state.fecha_inicio;
    const ff = this.state.fecha_fin;
    const params = new URLSearchParams({ fecha_inicio: fi, fecha_fin: ff });
    const [ventas, productos, clientes, barberos] = await Promise.all([
      api.getAll(`/ventas?${params}&tipo=venta`),
      this._safeGet(`/api/reportes/productos?fecha_inicio=${fi}&fecha_fin=${ff}`),
      this._safeGet(`/api/reportes/clientes?fecha_inicio=${fi}&fecha_fin=${ff}`),
      this._safeGet(`/api/reportes/barberos?fecha_inicio=${fi}&fecha_fin=${ff}`)
    ]);
    this.state.reportes  = ventas;
    this.state.productos = productos;
    this.state.clientes  = clientes;
    this.state.barberos  = barberos;
    this.state.cargando  = false;
  },

  // ─── Inline style helpers (dark-mode safe) ─────────────────────────────────
  _s() {
    const dark = document.documentElement.classList.contains("dark");
    return {
      dark,
      card:     dark ? "background:#1e293b;border:1px solid #334155;border-radius:10px;padding:16px;" : "background:#ffffff;border:1px solid #e5e7eb;border-radius:10px;padding:16px;",
      th:       dark ? "padding:9px 12px;background:#374151;color:#e5e7eb;font-weight:700;font-size:12px;text-align:left;" : "padding:9px 12px;background:#f3f4f6;color:#374151;font-weight:700;font-size:12px;text-align:left;",
      thR:      dark ? "padding:9px 12px;background:#374151;color:#e5e7eb;font-weight:700;font-size:12px;text-align:right;" : "padding:9px 12px;background:#f3f4f6;color:#374151;font-weight:700;font-size:12px;text-align:right;",
      thC:      dark ? "padding:9px 12px;background:#374151;color:#e5e7eb;font-weight:700;font-size:12px;text-align:center;" : "padding:9px 12px;background:#f3f4f6;color:#374151;font-weight:700;font-size:12px;text-align:center;",
      td:       dark ? "padding:8px 12px;border-top:1px solid #374151;color:#f1f5f9;font-size:13px;" : "padding:8px 12px;border-top:1px solid #e5e7eb;color:#1e293b;font-size:13px;",
      tdR:      dark ? "padding:8px 12px;border-top:1px solid #374151;color:#f1f5f9;font-size:13px;text-align:right;font-weight:600;" : "padding:8px 12px;border-top:1px solid #e5e7eb;color:#1e293b;font-size:13px;text-align:right;font-weight:600;",
      tdC:      dark ? "padding:8px 12px;border-top:1px solid #374151;color:#f1f5f9;font-size:13px;text-align:center;" : "padding:8px 12px;border-top:1px solid #e5e7eb;color:#1e293b;font-size:13px;text-align:center;",
      tdMono:   dark ? "padding:8px 12px;border-top:1px solid #374151;color:#94a3b8;font-size:12px;font-family:monospace;" : "padding:8px 12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px;font-family:monospace;",
      tfoot:    dark ? "padding:8px 12px;background:#1e3a5f;color:#bfdbfe;font-size:13px;font-weight:700;" : "padding:8px 12px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:700;",
      tfootR:   dark ? "padding:8px 12px;background:#1e3a5f;color:#bfdbfe;font-size:13px;font-weight:700;text-align:right;" : "padding:8px 12px;background:#eff6ff;color:#1d4ed8;font-size:13px;font-weight:700;text-align:right;",
      tableBox: dark ? "border:1px solid #374151;border-radius:8px;overflow:hidden;" : "border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;",
      muted:    dark ? "color:#94a3b8;font-size:12px;" : "color:#6b7280;font-size:12px;",
      text:     dark ? "color:#f1f5f9;" : "color:#1e293b;",
      empty:    dark ? "padding:36px;text-align:center;color:#64748b;font-size:14px;" : "padding:36px;text-align:center;color:#9ca3af;font-size:14px;",
    };
  },

  _badgePago(medio) {
    const map = {
      efectivo:      "background:#14532d;color:#bbf7d0;",
      tarjeta:       "background:#1e3a5f;color:#bfdbfe;",
      transferencia: "background:#2e1065;color:#e9d5ff;",
    };
    const style = map[medio] || "background:#374151;color:#e5e7eb;";
    return `<span style="${style}padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;">${medio || "—"}</span>`;
  },

  _badgeEstado(estado) {
    const map = {
      pagada:     "background:#14532d;color:#bbf7d0;",
      completada: "background:#14532d;color:#bbf7d0;",
      pendiente:  "background:#451a03;color:#fde68a;",
      cancelada:  "background:#7f1d1d;color:#fecaca;",
      entregada:  "background:#1e3a5f;color:#bfdbfe;",
    };
    const style = map[estado] || "background:#374151;color:#e5e7eb;";
    return `<span style="${style}padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;">${estado || "—"}</span>`;
  },

  // ─── Render UI ───────────────────────────────────────────────────────────────
  renderUI() {
    const tabs = [
      { id: "ventas",    label: "Ventas",    icon: "fa-chart-line" },
      { id: "productos", label: "Productos", icon: "fa-box" },
      { id: "clientes",  label: "Clientes",  icon: "fa-users" },
      { id: "barberos",  label: "Barberos",  icon: "fa-scissors" },
    ];
    const cnt = { ventas: this.state.reportes.length, productos: this.state.productos.length, clientes: this.state.clientes.length, barberos: this.state.barberos.length };

    this.container.innerHTML = `
      <div class="space-y-4">
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
          <h2 class="text-xl font-bold mb-4 text-gray-900 dark:text-white">
            <i class="fas fa-chart-bar mr-2 text-blue-600"></i>Reportes
          </h2>

          <!-- Filtros de fecha -->
          <div class="flex flex-wrap items-end gap-3 mb-5">
            <div>
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Desde</label>
              <input type="date" id="fecha_inicio" value="${this.state.fecha_inicio}"
                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm">
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Hasta</label>
              <input type="date" id="fecha_fin" value="${this.state.fecha_fin}"
                class="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm">
            </div>
            <button id="btnGenerarReporte" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold">
              <i class="fas fa-sync-alt mr-1"></i>Generar
            </button>
            <div class="flex gap-2 ml-auto">
              <button id="btnExportarPDF" class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-semibold">
                <i class="fas fa-file-pdf mr-1"></i>PDF
              </button>
              <button id="btnExportarExcel" class="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-semibold">
                <i class="fas fa-file-csv mr-1"></i>CSV
              </button>
            </div>
          </div>

          <!-- Tabs -->
          <div class="flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700 mb-5">
            ${tabs.map(t => `
              <button data-tab="${t.id}"
                class="px-5 py-3 text-sm font-semibold border-b-2 transition
                  ${this.state.tab === t.id ? "border-blue-600 text-blue-600" : "border-transparent text-gray-600 dark:text-gray-300 hover:text-blue-600"}">
                <i class="fas ${t.icon} mr-1"></i>${t.label}
                <span class="ml-1 text-xs px-1.5 py-0.5 rounded-full
                  ${this.state.tab === t.id ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300" : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"}">
                  ${cnt[t.id]}
                </span>
              </button>`).join("")}
          </div>

          <!-- Contenido -->
          ${this.state.cargando
            ? `<div class="py-12 text-center text-gray-500 dark:text-gray-400"><i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>Cargando datos&hellip;</div>`
            : this.renderTabContent()
          }
        </div>
      </div>`;
  },

  // ─── Tab dispatcher ──────────────────────────────────────────────────────────
  renderTabContent() {
    const s = this._s();
    switch (this.state.tab) {
      case "ventas":    return this._tabVentas(s);
      case "productos": return this._tabProductos(s);
      case "clientes":  return this._tabClientes(s);
      case "barberos":  return this._tabBarberos(s);
      default:          return this._tabVentas(s);
    }
  },

  // ── Ventas ──────────────────────────────────────────────────────────────────
  _tabVentas(s) {
    const v = this.state.reportes;
    const total    = v.reduce((a, x) => a + (x.total || 0), 0);
    const efectivo = v.filter(x => x.medio_pago === "efectivo").reduce((a, x) => a + (x.total || 0), 0);
    const tarjeta  = v.filter(x => x.medio_pago === "tarjeta").reduce((a, x) => a + (x.total || 0), 0);
    const transf   = v.filter(x => x.medio_pago === "transferencia").reduce((a, x) => a + (x.total || 0), 0);
    const promedio = v.length ? total / v.length : 0;
    const maximo   = v.length ? Math.max(...v.map(x => x.total || 0)) : 0;

    const cardBlue   = s.dark ? "background:#1e3a5f;border:1px solid #2563eb;border-radius:10px;padding:14px;" : "background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;";
    const cardGreen  = s.dark ? "background:#14532d;border:1px solid #16a34a;border-radius:10px;padding:14px;" : "background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px;";
    const cardPurple = s.dark ? "background:#2e1065;border:1px solid #7c3aed;border-radius:10px;padding:14px;" : "background:#faf5ff;border:1px solid #e9d5ff;border-radius:10px;padding:14px;";
    const cardAmber  = s.dark ? "background:#451a03;border:1px solid #d97706;border-radius:10px;padding:14px;" : "background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;";
    const cardTeal   = s.dark ? "background:#134e4a;border:1px solid #0d9488;border-radius:10px;padding:14px;" : "background:#f0fdfa;border:1px solid #99f6e4;border-radius:10px;padding:14px;";
    const cardSlate  = s.dark ? "background:#1e293b;border:1px solid #475569;border-radius:10px;padding:14px;" : "background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:14px;";

    const lbl = (c, t) => `<p style="${c}font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin:0 0 4px;">${t}</p>`;
    const val = (c, t) => `<p style="${c}font-size:20px;font-weight:800;margin:0;">${t}</p>`;

    const rows = v.map((x, i) => {
      const bg = i % 2 === 0
        ? (s.dark ? "background:#111827;" : "background:#ffffff;")
        : (s.dark ? "background:#1e293b;" : "background:#f8fafc;");
      return `<tr style="${bg}">
        <td style="${s.tdMono}">${x.numero_ticket || x.id}</td>
        <td data-sort-value="${x.fecha_venta}" style="${s.td}">${dateUtils.formatDate(x.fecha_venta)}</td>
        <td style="${s.td}">${dateUtils.formatTime(x.fecha_venta)}</td>
        <td style="${s.td}">${x.cliente_nombre ? (x.cliente_nombre + " " + (x.cliente_apellido || "")).trim() : '<span style="color:#94a3b8;font-style:italic;">Sin cliente</span>'}</td>
        <td style="${s.td}">${x.barbero_nombre ? (x.barbero_nombre + " " + (x.barbero_apellido || "")).trim() : '<span style="color:#94a3b8;font-style:italic;">Sin barbero</span>'}</td>
        <td style="${s.tdC}">${this._badgePago(x.medio_pago)}</td>
        <td style="${s.td}">${x.sucursal_nombre || "—"}</td>
        <td style="${s.tdC}">${this._badgeEstado(x.estado)}</td>
        <td style="${s.tdR}">${fmtMoney(x.total)}</td>
      </tr>`;
    }).join("");

    return `
      <!-- Tarjetas KPI -->
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px;margin-bottom:20px;">
        <div style="${cardBlue}">${lbl(s.dark ? "color:#93c5fd;" : "color:#1d4ed8;", "Total ventas")}${val(s.dark ? "color:#bfdbfe;" : "color:#1d4ed8;", v.length)}</div>
        <div style="${cardGreen}">${lbl(s.dark ? "color:#86efac;" : "color:#15803d;", "Monto total")}${val(s.dark ? "color:#bbf7d0;" : "color:#15803d;", fmtMoney(total))}</div>
        <div style="${cardPurple}">${lbl(s.dark ? "color:#c4b5fd;" : "color:#6d28d9;", "Promedio")}${val(s.dark ? "color:#e9d5ff;" : "color:#6d28d9;", fmtMoney(promedio))}</div>
        <div style="${cardAmber}">${lbl(s.dark ? "color:#fcd34d;" : "color:#92400e;", "M&aacute;ximo")}${val(s.dark ? "color:#fde68a;" : "color:#d97706;", fmtMoney(maximo))}</div>
        <div style="${cardGreen}">${lbl(s.dark ? "color:#86efac;" : "color:#15803d;", "Efectivo")}${val(s.dark ? "color:#bbf7d0;" : "color:#15803d;", fmtMoney(efectivo))}</div>
        <div style="${cardTeal}">${lbl(s.dark ? "color:#5eead4;" : "color:#0f766e;", "Tarjeta")}${val(s.dark ? "color:#99f6e4;" : "color:#0f766e;", fmtMoney(tarjeta))}</div>
        <div style="${cardSlate}">${lbl(s.dark ? "color:#94a3b8;" : "color:#475569;", "Transferencia")}${val(s.dark ? "color:#e2e8f0;" : "color:#475569;", fmtMoney(transf))}</div>
      </div>

      <!-- Tabla -->
      <div style="${s.tableBox}overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="${s.th}">Ticket</th>
            <th style="${s.th}">Fecha</th>
            <th style="${s.th}">Hora</th>
            <th style="${s.th}">Cliente</th>
            <th style="${s.th}">Barbero</th>
            <th style="${s.thC}">Pago</th>
            <th style="${s.th}">Sucursal</th>
            <th style="${s.thC}">Estado</th>
            <th style="${s.thR}">Total</th>
          </tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="9" style="${s.empty}"><i class="fas fa-inbox" style="display:block;font-size:2rem;margin-bottom:8px;"></i>Sin ventas en el per&iacute;odo seleccionado</td></tr>`}
          </tbody>
          ${v.length ? `<tfoot><tr>
            <td colspan="8" style="${s.tfoot}text-align:right;">TOTAL &mdash; ${v.length} venta${v.length !== 1 ? "s" : ""}</td>
            <td style="${s.tfootR}">${fmtMoney(total)}</td>
          </tr></tfoot>` : ""}
        </table>
      </div>`;
  },

  // ── Productos ───────────────────────────────────────────────────────────────
  _tabProductos(s) {
    const p = this.state.productos;
    const totalUnidades  = p.reduce((a, x) => a + (x.cantidad_vendida || 0), 0);
    const totalFacturado = p.reduce((a, x) => a + (x.total_facturado || 0), 0);

    const rows = p.map((x, i) => {
      const bg = i % 2 === 0
        ? (s.dark ? "background:#111827;" : "background:#ffffff;")
        : (s.dark ? "background:#1e293b;" : "background:#f8fafc;");
      const pct    = totalFacturado > 0 ? ((x.total_facturado / totalFacturado) * 100).toFixed(1) : "0.0";
      const barW   = Math.max(2, Math.round(parseFloat(pct)));
      const barClr = s.dark ? "#2563eb" : "#3b82f6";
      return `<tr style="${bg}">
        <td style="${s.tdMono}">${x.sku || "—"}</td>
        <td style="${s.td}font-weight:600;">${x.nombre}</td>
        <td style="${s.tdC}font-weight:700;">${x.cantidad_vendida}</td>
        <td style="${s.td}">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;height:6px;background:${s.dark ? "#374151" : "#e5e7eb"};border-radius:3px;overflow:hidden;">
              <div style="width:${barW}%;height:100%;background:${barClr};border-radius:3px;"></div>
            </div>
            <span style="${s.muted}">${pct}%</span>
          </div>
        </td>
        <td style="${s.tdR}">${fmtMoney(x.total_facturado)}</td>
      </tr>`;
    }).join("");

    return `
      <div style="${s.tableBox}overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="${s.th}">SKU</th>
            <th style="${s.th}">Producto / Servicio</th>
            <th style="${s.thC}">Unidades</th>
            <th style="${s.th}">Participaci&oacute;n</th>
            <th style="${s.thR}">Facturado</th>
          </tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="5" style="${s.empty}">Sin productos vendidos en el per&iacute;odo</td></tr>`}
          </tbody>
          ${p.length ? `<tfoot><tr>
            <td colspan="2" style="${s.tfoot}text-align:right;">${p.length} producto${p.length !== 1 ? "s" : ""}</td>
            <td style="${s.tfoot}text-align:center;">${totalUnidades}</td>
            <td style="${s.tfoot}"></td>
            <td style="${s.tfootR}">${fmtMoney(totalFacturado)}</td>
          </tr></tfoot>` : ""}
        </table>
      </div>`;
  },

  // ── Clientes ────────────────────────────────────────────────────────────────
  _tabClientes(s) {
    const c = this.state.clientes;
    const totalGastado = c.reduce((a, x) => a + (x.total_gastado || 0), 0);

    const rows = c.map((x, i) => {
      const bg = i % 2 === 0
        ? (s.dark ? "background:#111827;" : "background:#ffffff;")
        : (s.dark ? "background:#1e293b;" : "background:#f8fafc;");
      const promedio = x.compras > 0 ? x.total_gastado / x.compras : 0;
      const pct      = totalGastado > 0 ? ((x.total_gastado / totalGastado) * 100).toFixed(1) : "0.0";
      const barClr   = s.dark ? "#7c3aed" : "#8b5cf6";
      return `<tr style="${bg}">
        <td style="${s.td}font-weight:600;">${x.nombre} ${x.apellido || ""}</td>
        <td style="${s.tdC}font-weight:700;">${x.compras}</td>
        <td style="${s.tdR}">${fmtMoney(promedio)}</td>
        <td style="${s.td}">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;height:6px;background:${s.dark ? "#374151" : "#e5e7eb"};border-radius:3px;overflow:hidden;">
              <div style="width:${Math.max(2, Math.round(parseFloat(pct)))}%;height:100%;background:${barClr};border-radius:3px;"></div>
            </div>
            <span style="${s.muted}">${pct}%</span>
          </div>
        </td>
        <td style="${s.tdR}">${fmtMoney(x.total_gastado)}</td>
      </tr>`;
    }).join("");

    return `
      <div style="${s.tableBox}overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr>
            <th style="${s.th}">Cliente</th>
            <th style="${s.thC}">Compras</th>
            <th style="${s.thR}">Ticket promedio</th>
            <th style="${s.th}">Participaci&oacute;n</th>
            <th style="${s.thR}">Total gastado</th>
          </tr></thead>
          <tbody>
            ${rows || `<tr><td colspan="5" style="${s.empty}">Sin clientes con compras en el per&iacute;odo</td></tr>`}
          </tbody>
          ${c.length ? `<tfoot><tr>
            <td colspan="4" style="${s.tfoot}text-align:right;">${c.length} cliente${c.length !== 1 ? "s" : ""}</td>
            <td style="${s.tfootR}">${fmtMoney(totalGastado)}</td>
          </tr></tfoot>` : ""}
        </table>
      </div>`;
  },

  // ── Barberos ────────────────────────────────────────────────────────────────
  _tabBarberos(s) {
    const bars = this.state.barberos;
    if (!bars.length) {
      return `<div style="${s.empty}"><i class="fas fa-scissors" style="display:block;font-size:2rem;margin-bottom:8px;"></i>No hay barberos registrados.</div>`;
    }
    const totalGlobal = bars.reduce((a, b) => a + (b.total_acumulado || 0), 0);
    const fi = dateUtils.formatDate(this.state.fecha_inicio);
    const ff = dateUtils.formatDate(this.state.fecha_fin);

    const summary = `
      <div style="background:${s.dark ? "#1e3a5f" : "#eff6ff"};border:1px solid ${s.dark ? "#2563eb" : "#bfdbfe"};border-radius:10px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:12px;">
        <i class="fas fa-calendar-alt" style="color:${s.dark ? "#93c5fd" : "#2563eb"};font-size:18px;"></i>
        <span style="color:${s.dark ? "#bfdbfe" : "#1d4ed8"};font-size:13px;">
          Per&iacute;odo: <strong>${fi}</strong> al <strong>${ff}</strong>
          &nbsp;&mdash;&nbsp; ${bars.length} barbero${bars.length !== 1 ? "s" : ""}
          &nbsp;&mdash;&nbsp; Total: <strong>${fmtMoney(totalGlobal)}</strong>
        </span>
      </div>`;

    const cards = bars.map(bar => {
      const pct = totalGlobal > 0 ? ((bar.total_acumulado / totalGlobal) * 100).toFixed(1) : "0.0";
      const itemRows = bar.items && bar.items.length
        ? bar.items.map(it => `<tr>
            <td style="${s.td}">${it.producto_nombre}</td>
            <td style="${s.tdMono}">${it.sku || "—"}</td>
            <td style="${s.tdC}font-weight:700;">${it.cantidad}</td>
            <td style="${s.tdR}color:${s.dark ? "#86efac" : "#15803d"};">${fmtMoney(it.subtotal)}</td>
          </tr>`).join("")
        : `<tr><td colspan="4" style="${s.empty}font-size:13px;">Sin ventas en el per&iacute;odo.</td></tr>`;

      return `
        <div style="${s.card}margin-bottom:16px;">
          <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);border-radius:8px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div>
              <p style="font-size:17px;font-weight:700;color:#fff;margin:0;">${bar.nombre} ${bar.apellido || ""}</p>
              <p style="font-size:11px;color:#c4b5fd;margin:4px 0 0;font-family:monospace;">C&oacute;digo: ${bar.codigo_barbero}</p>
            </div>
            <div style="text-align:right;">
              <p style="font-size:20px;font-weight:800;color:#fff;margin:0;">${fmtMoney(bar.total_acumulado)}</p>
              <p style="font-size:11px;color:#c4b5fd;margin:4px 0 0;">${bar.total_ventas} venta${bar.total_ventas !== 1 ? "s" : ""} &nbsp;|&nbsp; ${pct}% del total</p>
            </div>
          </div>
          <div style="${s.tableBox}overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="${s.th}">Producto / Servicio</th>
                <th style="${s.th}">SKU</th>
                <th style="${s.thC}">Cantidad</th>
                <th style="${s.thR}">Total</th>
              </tr></thead>
              <tbody>${itemRows}</tbody>
              ${bar.items && bar.items.length ? `<tfoot><tr>
                <td colspan="3" style="${s.tfoot}text-align:right;">TOTAL BARBERO</td>
                <td style="${s.tfootR}">${fmtMoney(bar.total_acumulado)}</td>
              </tr></tfoot>` : ""}
            </table>
          </div>
        </div>`;
    }).join("");

    return `<div>${summary}${cards}</div>`;
  },

  // ─── Events ──────────────────────────────────────────────────────────────────
  attachEvents() {
    sortableTables(this, this.state.tab);
    this.container.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", e => {
        this.state.tab = e.target.closest("[data-tab]").dataset.tab;
        this.renderUI();
        this.attachEvents();
      });
    });

    document.getElementById("btnGenerarReporte")?.addEventListener("click", async () => {
      const fi = document.getElementById("fecha_inicio").value;
      const ff = document.getElementById("fecha_fin").value;
      if (!fi || !ff) return toast.warning('Selecciona ambas fechas');
      if (fi > ff) return toast.warning('La fecha inicio debe ser anterior a la fecha fin');
      this.state.fecha_inicio = fi;
      this.state.fecha_fin    = ff;
      this.state.cargando     = true;
      this.renderUI();
      await this.cargarReportes();
      this.renderUI();
      this.attachEvents();
    });

    document.getElementById("btnExportarExcel")?.addEventListener("click", () => this.exportar());
    document.getElementById("btnExportarPDF")?.addEventListener("click", () => this.exportarPDF());
  },

  // ─── PDF Export ───────────────────────────────────────────────────────────────
  exportarPDF() {
    const fi   = dateUtils.formatDate(this.state.fecha_inicio);
    const ff   = dateUtils.formatDate(this.state.fecha_fin);
    const slug = `${this.state.fecha_inicio}_${this.state.fecha_fin}`;
    const tabLabel = { ventas: "VENTAS", productos: "PRODUCTOS", clientes: "CLIENTES", barberos: "VENTAS POR BARBERO" }[this.state.tab] || "REPORTE";

    const tdS  = 'style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#1e293b;font-size:12px;"';
    const tdRS = 'style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#1e293b;font-size:12px;text-align:right;font-weight:600;"';
    const tdCS = 'style="padding:6px 10px;border-bottom:1px solid #e5e7eb;color:#1e293b;font-size:12px;text-align:center;"';
    const thS  = 'style="padding:7px 10px;background:#f3f4f6;color:#374151;font-weight:700;font-size:11px;text-align:left;border-bottom:2px solid #e5e7eb;"';
    const thRS = 'style="padding:7px 10px;background:#f3f4f6;color:#374151;font-weight:700;font-size:11px;text-align:right;border-bottom:2px solid #e5e7eb;"';
    const thCS = 'style="padding:7px 10px;background:#f3f4f6;color:#374151;font-weight:700;font-size:11px;text-align:center;border-bottom:2px solid #e5e7eb;"';

    let body = "";

    if (this.state.tab === "ventas") {
      const v     = this.state.reportes;
      const total = v.reduce((a, x) => a + (x.total || 0), 0);
      const ef    = v.filter(x => x.medio_pago === "efectivo").reduce((a, x) => a + (x.total || 0), 0);
      const ta    = v.filter(x => x.medio_pago === "tarjeta").reduce((a, x) => a + (x.total || 0), 0);
      const tr    = v.filter(x => x.medio_pago === "transferencia").reduce((a, x) => a + (x.total || 0), 0);

      body = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:10px;text-align:center;">
            <p style="color:#1d4ed8;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 3px;">Total Ventas</p>
            <p style="color:#1e3a8a;font-size:20px;font-weight:800;margin:0;">${v.length}</p>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <p style="color:#15803d;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 3px;">Monto Total</p>
            <p style="color:#14532d;font-size:18px;font-weight:800;margin:0;">${fmtMoney(total)}</p>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;text-align:center;">
            <p style="color:#15803d;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 3px;">Efectivo</p>
            <p style="color:#14532d;font-size:18px;font-weight:800;margin:0;">${fmtMoney(ef)}</p>
          </div>
          <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:8px;padding:10px;text-align:center;">
            <p style="color:#0f766e;font-size:10px;font-weight:700;text-transform:uppercase;margin:0 0 3px;">Tarjeta</p>
            <p style="color:#134e4a;font-size:18px;font-weight:800;margin:0;">${fmtMoney(ta)}</p>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th ${thS}>Ticket</th><th ${thS}>Fecha</th><th ${thS}>Hora</th><th ${thS}>Cliente</th>
            <th ${thS}>Barbero</th><th ${thCS}>Pago</th><th ${thS}>Sucursal</th><th ${thS}>Estado</th><th ${thRS}>Total</th>
          </tr></thead>
          <tbody>${v.map(x => `<tr>
            <td ${tdS} style="font-family:monospace;font-size:11px;">${x.numero_ticket || x.id}</td>
            <td ${tdS}>${dateUtils.formatDate(x.fecha_venta)}</td>
            <td ${tdS}>${dateUtils.formatTime(x.fecha_venta)}</td>
            <td ${tdS}>${x.cliente_nombre ? (x.cliente_nombre + " " + (x.cliente_apellido || "")).trim() : "—"}</td>
            <td ${tdS}>${x.barbero_nombre ? (x.barbero_nombre + " " + (x.barbero_apellido || "")).trim() : "—"}</td>
            <td ${tdCS}><span style="background:#f3f4f6;border-radius:4px;padding:1px 6px;font-size:11px;font-weight:600;">${x.medio_pago || "—"}</span></td>
            <td ${tdS}>${x.sucursal_nombre || "—"}</td>
            <td ${tdS}>${x.estado || "—"}</td>
            <td ${tdRS}>${fmtMoney(x.total)}</td>
          </tr>`).join("") || `<tr><td colspan="9" style="padding:16px;text-align:center;color:#9ca3af;">Sin ventas</td></tr>`}
          </tbody>
          <tfoot><tr>
            <td colspan="8" style="padding:8px 10px;background:#eff6ff;color:#1d4ed8;font-weight:700;text-align:right;">TOTAL (${v.length} ventas)</td>
            <td style="padding:8px 10px;background:#eff6ff;color:#1d4ed8;font-weight:700;text-align:right;">${fmtMoney(total)}</td>
          </tr></tfoot>
        </table>`;

    } else if (this.state.tab === "productos") {
      const p   = this.state.productos;
      const tot = p.reduce((a, x) => a + (x.total_facturado || 0), 0);
      body = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th ${thS}>SKU</th><th ${thS}>Producto</th>
            <th ${thCS}>Unidades</th><th ${thRS}>Facturado</th>
          </tr></thead>
          <tbody>${p.map(x => `<tr>
            <td ${tdS} style="font-family:monospace;font-size:11px;">${x.sku || "—"}</td>
            <td ${tdS}>${x.nombre}</td>
            <td ${tdCS} style="font-weight:700;">${x.cantidad_vendida}</td>
            <td ${tdRS}>${fmtMoney(x.total_facturado)}</td>
          </tr>`).join("") || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;">Sin datos</td></tr>`}
          </tbody>
          <tfoot><tr>
            <td colspan="3" style="padding:8px 10px;background:#eff6ff;color:#1d4ed8;font-weight:700;text-align:right;">TOTAL</td>
            <td style="padding:8px 10px;background:#eff6ff;color:#1d4ed8;font-weight:700;text-align:right;">${fmtMoney(tot)}</td>
          </tr></tfoot>
        </table>`;

    } else if (this.state.tab === "clientes") {
      const c   = this.state.clientes;
      const tot = c.reduce((a, x) => a + (x.total_gastado || 0), 0);
      body = `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr>
            <th ${thS}>Cliente</th><th ${thCS}>Compras</th>
            <th ${thRS}>Ticket promedio</th><th ${thRS}>Total gastado</th>
          </tr></thead>
          <tbody>${c.map(x => `<tr>
            <td ${tdS}>${x.nombre} ${x.apellido || ""}</td>
            <td ${tdCS} style="font-weight:700;">${x.compras}</td>
            <td ${tdRS}>${fmtMoney(x.compras > 0 ? x.total_gastado / x.compras : 0)}</td>
            <td ${tdRS}>${fmtMoney(x.total_gastado)}</td>
          </tr>`).join("") || `<tr><td colspan="4" style="padding:16px;text-align:center;color:#9ca3af;">Sin datos</td></tr>`}
          </tbody>
          <tfoot><tr>
            <td colspan="3" style="padding:8px 10px;background:#eff6ff;color:#1d4ed8;font-weight:700;text-align:right;">TOTAL</td>
            <td style="padding:8px 10px;background:#eff6ff;color:#1d4ed8;font-weight:700;text-align:right;">${fmtMoney(tot)}</td>
          </tr></tfoot>
        </table>`;

    } else {
      // Barberos PDF
      body = this.state.barberos.map(bar => {
        const rows = bar.items && bar.items.length
          ? bar.items.map(it => `<tr>
              <td ${tdS}>${it.producto_nombre}</td>
              <td ${tdS} style="font-family:monospace;font-size:11px;">${it.sku || "—"}</td>
              <td ${tdCS} style="font-weight:700;">${it.cantidad}</td>
              <td ${tdRS} style="color:#15803d;">${fmtMoney(it.subtotal)}</td>
            </tr>`).join("") +
            `<tr><td colspan="3" style="padding:6px 10px;background:#f3f4f6;text-align:right;font-weight:700;">TOTAL</td>
            <td style="padding:6px 10px;background:#f3f4f6;text-align:right;font-weight:700;color:#15803d;">${fmtMoney(bar.total_acumulado)}</td></tr>`
          : `<tr><td colspan="4" style="padding:10px;color:#9ca3af;font-style:italic;">Sin ventas en el per&iacute;odo.</td></tr>`;
        return `
          <div style="margin-bottom:24px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;break-inside:avoid;">
            <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:12px 16px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <p style="font-weight:700;font-size:16px;color:#fff;margin:0;">${bar.nombre} ${bar.apellido || ""}</p>
                <p style="font-size:11px;color:#c4b5fd;font-family:monospace;margin:3px 0 0;">C&oacute;d: ${bar.codigo_barbero} &nbsp;|&nbsp; ${bar.total_ventas} venta${bar.total_ventas !== 1 ? "s" : ""}</p>
              </div>
              <p style="font-size:20px;font-weight:800;color:#fff;margin:0;">${fmtMoney(bar.total_acumulado)}</p>
            </div>
            <table style="width:100%;border-collapse:collapse;font-size:12px;">
              <thead><tr>
                <th ${thS}>Producto</th><th ${thS}>SKU</th>
                <th ${thCS}>Cantidad</th><th ${thRS}>Total</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>`;
      }).join("") || '<p style="text-align:center;color:#9ca3af;">Sin barberos.</p>';
    }

    const el = document.createElement("div");
    el.style.cssText = "font-family:Arial,sans-serif;color:#1e293b;background:#fff;";
    el.innerHTML = `
      <div style="background:linear-gradient(135deg,#1e1b4b,#3730a3);padding:20px 24px;">
        <p style="color:#a5b4fc;font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin:0 0 4px;">POS Barbershop</p>
        <h1 style="color:#fff;font-size:20px;font-weight:900;margin:0;">REPORTE DE ${tabLabel}</h1>
        <p style="color:#c7d2fe;font-size:12px;margin:6px 0 0;">Per&iacute;odo: ${fi} al ${ff}</p>
      </div>
      <div style="padding:16px 20px 20px;">${body}
        <p style="margin-top:20px;padding-top:10px;border-top:1px solid #e5e7eb;font-size:10px;color:#94a3b8;text-align:center;">
          Generado el ${new Date().toLocaleString("es-AR")} &mdash; POS Barbershop
        </p>
      </div>`;

    html2pdf().set({
      margin: [0, 0, 5, 0],
      filename: `reporte_${this.state.tab}_${slug}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, backgroundColor: "#fff", useCORS: true },
      jsPDF: { orientation: this.state.tab === "barberos" ? "portrait" : "landscape", unit: "mm", format: "a4" }
    }).from(el).save();
  },

  // ─── CSV Export ───────────────────────────────────────────────────────────────
  exportar() {
    const fi   = dateUtils.formatDate(this.state.fecha_inicio);
    const ff   = dateUtils.formatDate(this.state.fecha_fin);
    const slug = `${fi}_${ff}`;

    if (this.state.tab === "ventas") {
      exportarCSV(`ventas_${slug}.csv`,
        [
          { key: "ticket",   label: "Ticket"      },
          { key: "fecha",    label: "Fecha"        },
          { key: "hora",     label: "Hora"         },
          { key: "cliente",  label: "Cliente"      },
          { key: "barbero",  label: "Barbero"      },
          { key: "pago",     label: "Medio Pago"   },
          { key: "sucursal", label: "Sucursal"     },
          { key: "estado",   label: "Estado"       },
          { key: "subtotal", label: "Subtotal"     },
          { key: "total",    label: "Total"        },
        ],
        this.state.reportes.map(v => ({
          ticket:   v.numero_ticket || v.id,
          fecha:    dateUtils.formatDate(v.fecha_venta),
          hora:     dateUtils.formatTime(v.fecha_venta),
          cliente:  v.cliente_nombre ? `${v.cliente_nombre} ${v.cliente_apellido || ""}`.trim() : "",
          barbero:  v.barbero_nombre ? `${v.barbero_nombre} ${v.barbero_apellido || ""}`.trim() : "",
          pago:     v.medio_pago || "",
          sucursal: v.sucursal_nombre || "",
          estado:   v.estado || "",
          subtotal: v.subtotal,
          total:    v.total,
        }))
      );
    } else if (this.state.tab === "productos") {
      exportarCSV(`productos_${slug}.csv`,
        [
          { key: "sku",      label: "SKU"       },
          { key: "nombre",   label: "Producto"  },
          { key: "cantidad", label: "Unidades"  },
          { key: "total",    label: "Facturado" },
        ],
        this.state.productos.map(p => ({
          sku: p.sku, nombre: p.nombre,
          cantidad: p.cantidad_vendida, total: p.total_facturado
        }))
      );
    } else if (this.state.tab === "clientes") {
      exportarCSV(`clientes_${slug}.csv`,
        [
          { key: "nombre",   label: "Cliente"         },
          { key: "compras",  label: "Compras"         },
          { key: "promedio", label: "Ticket promedio" },
          { key: "total",    label: "Total gastado"   },
        ],
        this.state.clientes.map(c => ({
          nombre:   `${c.nombre} ${c.apellido || ""}`.trim(),
          compras:  c.compras,
          promedio: c.compras > 0 ? (c.total_gastado / c.compras).toFixed(2) : "0.00",
          total:    c.total_gastado,
        }))
      );
    } else {
      const rows = [];
      this.state.barberos.forEach(bar => {
        if (bar.items && bar.items.length) {
          bar.items.forEach(it => rows.push({
            barbero:  `${bar.nombre} ${bar.apellido || ""}`.trim(),
            codigo:   bar.codigo_barbero,
            producto: it.producto_nombre,
            sku:      it.sku || "",
            cantidad: it.cantidad,
            total:    it.subtotal,
          }));
        } else {
          rows.push({ barbero: `${bar.nombre} ${bar.apellido || ""}`.trim(), codigo: bar.codigo_barbero, producto: "(Sin ventas)", sku: "", cantidad: 0, total: 0 });
        }
      });
      exportarCSV(`barberos_${slug}.csv`,
        [
          { key: "barbero",  label: "Barbero"  },
          { key: "codigo",   label: "Codigo"   },
          { key: "producto", label: "Producto" },
          { key: "sku",      label: "SKU"      },
          { key: "cantidad", label: "Cantidad" },
          { key: "total",    label: "Total"    },
        ],
        rows
      );
    }
  },
};

