import { refreshWithFocus } from '../utils/table-utils.js';
﻿import { api } from "../api-client.js";
import { imprimirComprobante, fmtMoney } from "../utils/print-utils.js";

export default {
  state: {
    tab: "lista",
    presupuestos: [],
    productos: [],
    clientes: [],
    carrito: [],
    busqueda: "",
    descuento: 0,
    cliente_id: null,
    filtro_estado: "todas",
    busqueda_lista: ""
  },

  async render(c, p) {
    this.container = c;
    await Promise.all([this.cargarPresupuestos(), this.cargarProductos(), this.cargarClientes()]);
    this.renderUI();
    this.attachEvents();
  },

  async cargarPresupuestos() {
    try {
      this.state.presupuestos = await fetch("/api/presupuestos", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch { this.state.presupuestos = []; }
  },

  async cargarProductos() {
    try {
      this.state.productos = await fetch("/api/productos?limite=500", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch { this.state.productos = []; }
  },

  async cargarClientes() {
    try {
      this.state.clientes = await api.getAll('/clientes');
    } catch { this.state.clientes = []; }
  },

  renderUI() {
    this.container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div class="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <button data-tab="lista" class="flex-1 px-6 py-4 font-medium border-b-2 ${this.state.tab === "lista" ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300"}"><i class="fas fa-list mr-2"></i>Presupuestos</button>
            <button data-tab="crear" class="flex-1 px-6 py-4 font-medium border-b-2 ${this.state.tab === "crear" ? "border-blue-600 text-blue-600 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300"}"><i class="fas fa-plus mr-2"></i>Nuevo Presupuesto</button>
          </div>
          <div class="p-6">${this.state.tab === "crear" ? this.renderCrear() : this.renderLista()}</div>
        </div>
      </div>
      <div id="modalDetalle" class="hidden fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
          <div id="detalleContent"></div>
          <div class="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button id="btnImprimirDetalle" class="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg"><i class="fas fa-print mr-1"></i>Imprimir</button>
            <button id="btnCerrarDetalle" class="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 rounded-lg">Cerrar</button>
          </div>
        </div>
      </div>`;
  },

  renderLista() {
    const filtradas = this.state.presupuestos.filter(f => {
      const q = this.state.busqueda_lista.toLowerCase();
      const matchQ = !q || f.id.toString().includes(q) || (f.cliente_nombre || "").toLowerCase().includes(q) || (f.numero_ticket || "").toLowerCase().includes(q);
      const matchE = this.state.filtro_estado === "todas" || f.estado === this.state.filtro_estado;
      return matchQ && matchE;
    });
    const total = filtradas.reduce((s, f) => s + (f.total || 0), 0);
    return `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <input id="busquedaLista" type="text" placeholder="Buscar..." value="${this.state.busqueda_lista}" class="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
        <select id="filtroLista" class="px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <option value="todas" ${this.state.filtro_estado === "todas" ? "selected" : ""}>Todas</option>
          <option value="pendiente" ${this.state.filtro_estado === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="pagada" ${this.state.filtro_estado === "pagada" ? "selected" : ""}>Pagada</option>
          <option value="anulada" ${this.state.filtro_estado === "anulada" ? "selected" : ""}>Anulada</option>
        </select>
        <div class="flex items-center text-sm text-gray-600 dark:text-gray-400"><strong>${filtradas.length}</strong>&nbsp;presupuestos — Total: ${fmtMoney(total)}</div>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700/50"><tr>
            <th class="px-4 py-3 text-left">Ticket</th><th class="px-4 py-3 text-left">Cliente</th>
            <th class="px-4 py-3 text-left">Fecha</th><th class="px-4 py-3 text-right">Total</th>
            <th class="px-4 py-3 text-center">Estado</th><th class="px-4 py-3 text-center">Acciones</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            ${filtradas.length ? filtradas.map(f => `
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-4 py-3 font-mono text-xs">${f.numero_ticket || "#" + f.id}</td>
                <td class="px-4 py-3">${f.cliente_nombre || "Sin cliente"} ${f.cliente_apellido || ""}</td>
                <td class="px-4 py-3">${(f.fecha_venta || "").split("T")[0] || "N/A"}</td>
                <td class="px-4 py-3 text-right font-bold">${fmtMoney(f.total)}</td>
                <td class="px-4 py-3 text-center"><span class="px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">${f.estado}</span></td>
                <td class="px-4 py-3 text-center space-x-1">
                  <button data-action="ver" data-id="${f.id}" class="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"><i class="fas fa-eye"></i></button>
                  <button data-action="imprimir" data-id="${f.id}" class="px-2 py-1 bg-red-100 text-red-700 rounded text-xs"><i class="fas fa-print"></i></button>
                </td>
              </tr>`).join("") : `<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Sin presupuestos</td></tr>`}
          </tbody>
        </table>
      </div>`;
  },

  renderCrear() {
    const subtotal = this.calcularSubtotal();
    const total = subtotal * (1 - this.state.descuento / 100);
    const productosFiltrados = this.state.productos.filter(p =>
      !this.state.busqueda || p.nombre.toLowerCase().includes(this.state.busqueda.toLowerCase()) || p.sku.toLowerCase().includes(this.state.busqueda.toLowerCase())
    ).slice(0, 15);
    return `
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="space-y-4">
          <input id="busquedaProd" type="text" placeholder="Buscar producto..." value="${this.state.busqueda}" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          <div class="max-h-48 overflow-y-auto space-y-1 border rounded-lg p-2 dark:border-gray-600">
            ${productosFiltrados.map(p => `
              <div class="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                <span>${p.nombre} <span class="text-gray-500">(${p.sku})</span></span>
                <button data-action="agregar" data-id="${p.id}" class="px-2 py-1 bg-blue-600 text-white rounded text-xs"><i class="fas fa-plus"></i></button>
              </div>`).join("")}
          </div>
          <select id="clientePresupuesto" class="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white">
            <option value="">Sin cliente</option>
            ${this.state.clientes.map(c => `<option value="${c.id}" ${this.state.cliente_id == c.id ? "selected" : ""}>${c.nombre} ${c.apellido || ""}</option>`).join("")}
          </select>
          <div class="flex items-center gap-2">
            <label class="text-sm font-medium dark:text-gray-300">Descuento %</label>
            <input id="descuentoPresupuesto" type="number" min="0" max="100" value="${this.state.descuento}" class="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
          </div>
        </div>
        <div class="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border dark:border-gray-600">
          <h3 class="font-bold mb-3 dark:text-white"><i class="fas fa-shopping-cart mr-1"></i> Items (${this.state.carrito.length})</h3>
          <div class="space-y-2 max-h-48 overflow-y-auto mb-4">
            ${this.state.carrito.length ? this.state.carrito.map((item, i) => `
              <div class="flex justify-between text-sm dark:text-gray-200">
                <span>${item.nombre} x${item.cantidad}</span>
                <div class="flex items-center gap-2">
                  <span>${fmtMoney(item.cantidad * item.precio_unitario)}</span>
                  <button data-action="quitar" data-index="${i}" class="text-red-500"><i class="fas fa-times"></i></button>
                </div>
              </div>`).join("") : `<p class="text-gray-500 text-sm">Carrito vacío</p>`}
          </div>
          <div class="border-t pt-3 space-y-1 text-sm dark:text-gray-200">
            <div class="flex justify-between"><span>Subtotal:</span><span>${fmtMoney(subtotal)}</span></div>
            <div class="flex justify-between"><span>Descuento (${this.state.descuento}%):</span><span>-${fmtMoney(subtotal - total)}</span></div>
            <div class="flex justify-between font-bold text-lg"><span>Total:</span><span class="text-green-600">${fmtMoney(total)}</span></div>
          </div>
          <button id="btnGuardarPresupuesto" class="w-full mt-4 px-4 py-3 bg-green-600 text-white rounded-lg font-bold" ${this.state.carrito.length === 0 ? "disabled" : ""}>
            <i class="fas fa-save mr-1"></i> Guardar Presupuesto
          </button>
        </div>
      </div>`;
  },

  calcularSubtotal() {
    return this.state.carrito.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);
  },

  attachEvents() {
    // Configurar cierre de modales con ESC si los hay
    const modalesIds = ['modalPresupuesto', 'modalProcesar'];
    modalesIds.forEach(id => {
      if (document.getElementById(id)) {
        this.setupModalClose(id);
      }
    });

    this.container.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.state.tab = e.target.closest("[data-tab]").dataset.tab;
        this.renderUI();
        this.attachEvents();
      });
    });

    document.getElementById("busquedaLista")?.addEventListener("input", (e) => {
      this.state.busqueda_lista = e.target.value;
      if (!e.isComposing) refreshWithFocus(this);
    });
    document.getElementById("filtroLista")?.addEventListener("change", (e) => {
      this.state.filtro_estado = e.target.value;
      this.renderUI();
      this.attachEvents();
    });

    document.getElementById("busquedaProd")?.addEventListener("input", (e) => {
      this.state.busqueda = e.target.value;
      if (!e.isComposing) refreshWithFocus(this);
    });

    // Limpiar automáticamente el "0" cuando el usuario escribe en descuentoPresupuesto
    const descuentoInput = document.getElementById('descuentoPresupuesto');
    if (descuentoInput) {
      descuentoInput.addEventListener('input', (e) => {
        if (e.target.value.startsWith('0') && e.target.value.length > 1) {
          e.target.value = e.target.value.substring(1);
        }
      });
    }

    document.getElementById("descuentoPresupuesto")?.addEventListener("change", (e) => {
      this.state.descuento = Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 0));
      this.renderUI();
      this.attachEvents();
    });
    document.getElementById("clientePresupuesto")?.addEventListener("change", (e) => {
      this.state.cliente_id = e.target.value ? parseInt(e.target.value) : null;
    });

    this.container.querySelectorAll("[data-action='agregar']").forEach(btn => {
      btn.addEventListener("click", (e) => this.agregarProducto(parseInt(e.currentTarget.dataset.id)));
    });
    this.container.querySelectorAll("[data-action='quitar']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.state.carrito.splice(parseInt(e.currentTarget.dataset.index), 1);
        this.renderUI();
        this.attachEvents();
      });
    });
    this.container.querySelectorAll("[data-action='ver']").forEach(btn => {
      btn.addEventListener("click", (e) => this.verDetalle(parseInt(e.currentTarget.dataset.id)));
    });
    this.container.querySelectorAll("[data-action='imprimir']").forEach(btn => {
      btn.addEventListener("click", (e) => this.imprimirPresupuesto(parseInt(e.currentTarget.dataset.id)));
    });

    document.getElementById("btnGuardarPresupuesto")?.addEventListener("click", () => this.guardarPresupuesto());
    document.getElementById("btnCerrarDetalle")?.addEventListener("click", () => {
      document.getElementById("modalDetalle").classList.add("hidden");
    });
    document.getElementById("btnImprimirDetalle")?.addEventListener("click", () => {
      if (this._detalleActual) this.imprimirHTML(this._detalleActual);
    });
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


  agregarProducto(id) {
    const p = this.state.productos.find(x => x.id === id);
    if (!p) return;
    const existente = this.state.carrito.find(i => i.producto_id === id);
    if (existente) existente.cantidad++;
    else this.state.carrito.push({ producto_id: id, nombre: p.nombre, cantidad: 1, precio_unitario: p.precio_venta });
    this.renderUI();
    this.attachEvents();
  },

  async guardarPresupuesto() {
    if (!this.state.carrito.length) return;
    try {
      const items = this.state.carrito.map(i => ({ producto_id: i.producto_id, cantidad: i.cantidad, precio_unitario: i.precio_unitario }));
      const res = await fetch("/api/presupuestos", {
        method: "POST",
        headers: api.getHeaders(),
        body: JSON.stringify({ cliente_id: this.state.cliente_id, items, descuento: this.state.descuento })
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error al guardar");
      const data = await res.json();
      alert(`Presupuesto guardado: ${data.numero_ticket}\nTotal: ${fmtMoney(data.total)}`);
      this.state.carrito = [];
      this.state.descuento = 0;
      await this.cargarPresupuestos();
      this.state.tab = "lista";
      this.renderUI();
      this.attachEvents();
    } catch (e) { alert(e.message); }
  },

  async verDetalle(id) {
    try {
      const res = await fetch(`/api/ventas/${id}`, { headers: api.getHeaders() });
      if (!res.ok) throw new Error("No se pudo cargar el detalle");
      const data = await res.json();
      this._detalleActual = data;
      document.getElementById("detalleContent").innerHTML = this.htmlDetalle(data);
      document.getElementById("modalDetalle").classList.remove("hidden");
    } catch (e) { alert(e.message); }
  },

  htmlDetalle(d) {
    return `
      <h2 class="text-xl font-bold mb-2 dark:text-white">Presupuesto ${d.numero_ticket || "#" + d.id}</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Cliente: ${d.cliente_nombre || "Sin cliente"} | Fecha: ${(d.fecha_venta || "").split("T")[0]}</p>
      <table class="w-full text-sm mb-4"><thead><tr class="border-b dark:border-gray-600">
        <th class="text-left py-2 dark:text-gray-300">Producto</th><th class="text-center dark:text-gray-300">Cant.</th>
        <th class="text-right dark:text-gray-300">Precio</th><th class="text-right dark:text-gray-300">Subtotal</th>
      </tr></thead><tbody>
        ${(d.items || []).map(i => `<tr class="border-b dark:border-gray-700">
          <td class="py-2 dark:text-gray-200">${i.producto_nombre} (${i.sku})</td>
          <td class="text-center dark:text-gray-200">${i.cantidad}</td>
          <td class="text-right dark:text-gray-200">${fmtMoney(i.precio_unitario)}</td>
          <td class="text-right dark:text-gray-200">${fmtMoney(i.subtotal)}</td>
        </tr>`).join("")}
      </tbody></table>
      <p class="text-right text-xl font-bold dark:text-white">Total: ${fmtMoney(d.total)}</p>`;
  },

  async imprimirPresupuesto(id) {
    try {
      const res = await fetch(`/api/ventas/${id}`, { headers: api.getHeaders() });
      if (!res.ok) throw new Error("Error al cargar");
      this.imprimirHTML(await res.json());
    } catch (e) { alert(e.message); }
  },

  imprimirHTML(d) {
    const body = `
      <div style="text-align:center;margin-bottom:16px"><img src="/assets/img/HIPERLIMPIO.png" style="height:60px" alt="Hiper Limpio"></div>
      <h1>PRESUPUESTO — Hiper Limpio</h1>
      <p class="meta">Ticket: ${d.numero_ticket || d.id} | Fecha: ${(d.fecha_venta || "").split("T")[0]} | Cliente: ${d.cliente_nombre || "Consumidor Final"}</p>
      <table><thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>
        ${(d.items || []).map(i => `<tr><td>${i.producto_nombre}</td><td>${i.cantidad}</td><td>${fmtMoney(i.precio_unitario)}</td><td>${fmtMoney(i.subtotal)}</td></tr>`).join("")}
      </tbody></table>
      <p class="total">TOTAL: ${fmtMoney(d.total)}</p>
      <p style="font-size:11px;color:#666;margin-top:24px">Válido por 15 días. Precios sujetos a cambio sin previo aviso.</p>`;
    imprimirComprobante(`Presupuesto ${d.numero_ticket}`, body);
  }
};

