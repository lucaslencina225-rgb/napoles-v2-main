import { api } from "../api-client.js";
import { imprimirComprobante } from "../utils/print-utils.js";

export default {
  state: { ofertas: [], productos: [], tab: "lista", ofertaSeleccionada: null },

  async render(c, p) {
    this.container = c;
    try {
      await Promise.all([this.cargarOfertas(), this.cargarProductos()]);
    } catch (e) { }
    this.renderUI();
    this.attachEvents();
  },

  async cargarOfertas() {
    try { this.state.ofertas = await fetch("/api/ofertas", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []); }
    catch (e) { this.state.ofertas = []; }
  },

  async cargarProductos() {
    try { this.state.productos = await fetch("/api/productos?limite=100", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []); }
    catch (e) { this.state.productos = []; }
  },

  renderUI() {
    if (this.state.tab === "etiquetas") {
      this.container.innerHTML = this.renderEtiquetas();
      return;
    }
    this.container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
          <div class="flex border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <button data-tab="lista" class="flex-1 px-6 py-4 font-medium border-b-2 transition ${this.state.tab === "lista" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300"}"><i class="fas fa-list mr-2"></i>Lista de Ofertas</button>
            <button data-tab="crear" class="flex-1 px-6 py-4 font-medium border-b-2 transition ${this.state.tab === "crear" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300"}"><i class="fas fa-plus-circle mr-2"></i>Nueva Oferta</button>
          </div>
          <div class="p-6">${this.state.tab === "crear" ? this.renderCrear() : this.renderLista()}</div>
        </div>
      </div>`;
  },

  renderLista() {
    return `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 dark:bg-gray-700/50"><tr>
            <th class="px-6 py-3 text-left font-semibold">Nombre</th>
            <th class="px-6 py-3 text-center font-semibold">Descuento</th>
            <th class="px-6 py-3 text-center font-semibold">Vigencia</th>
            <th class="px-6 py-3 text-center font-semibold">Acciones</th>
          </tr></thead>
          <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
            ${this.state.ofertas.length ? this.state.ofertas.map(o => `
              <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                <td class="px-6 py-4 font-semibold">${o.nombre}</td>
                <td class="px-6 py-4 text-center text-red-600 font-bold">${o.descuento}%</td>
                <td class="px-6 py-4 text-center text-xs text-gray-500">${o.fecha_inicio || "—"} → ${o.fecha_fin || "—"}</td>
                <td class="px-6 py-4 text-center space-x-1">
                  <button data-action="etiquetas" data-id="${o.id}" class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs"><i class="fas fa-tag mr-1"></i>Etiquetas</button>
                  <button data-action="pdf" data-id="${o.id}" class="px-3 py-1 bg-red-100 text-red-700 rounded text-xs"><i class="fas fa-file-pdf mr-1"></i>PDF</button>
                  <button data-action="eliminar" data-id="${o.id}" class="px-3 py-1 bg-gray-100 text-gray-700 rounded text-xs"><i class="fas fa-trash"></i></button>
                </td>
              </tr>`).join("") : `<tr><td colspan="4" class="px-6 py-8 text-center text-gray-500"><i class="fas fa-inbox mr-1"></i>Sin ofertas</td></tr>`}
          </tbody>
        </table>
      </div>`;
  },

  renderCrear() {
    const hoy = new Date().toISOString().split("T")[0];
    return `
      <div class="max-w-lg space-y-4">
        <div><label class="block text-sm font-medium mb-2 dark:text-gray-300">Nombre de Oferta</label>
          <input id="ofertaNombre" type="text" placeholder="Ej: Descuento Especial" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div>
        <div><label class="block text-sm font-medium mb-2 dark:text-gray-300">Descuento (%)</label>
          <input id="ofertaDescuento" type="number" min="1" max="100" placeholder="10" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div>
        <div><label class="block text-sm font-medium mb-2 dark:text-gray-300">Fecha Inicio</label>
          <input id="ofertaInicio" type="date" value="${hoy}" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div>
        <div><label class="block text-sm font-medium mb-2 dark:text-gray-300">Fecha Fin</label>
          <input id="ofertaFin" type="date" class="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"></div>
        <button id="btnCrearOferta" class="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold"><i class="fas fa-save mr-2"></i>Crear Oferta</button>
      </div>`;
  },

  renderEtiquetas() {
    const oferta = this.state.ofertaSeleccionada;
    const productos = this.state.productos.slice(0, 12);
    const desc = oferta?.descuento || 10;
    return `
      <div class="space-y-6">
        <div class="flex justify-between items-center">
          <h2 class="text-xl font-bold dark:text-white"><i class="fas fa-tags mr-2"></i>Etiquetas: ${oferta?.nombre || "Oferta"}</h2>
          <div class="flex gap-2">
            <button data-action="volver" class="px-4 py-2 bg-gray-600 text-white rounded-lg"><i class="fas fa-arrow-left mr-1"></i>Volver</button>
            <button data-action="imprimir-etiquetas" class="px-4 py-2 bg-blue-600 text-white rounded-lg"><i class="fas fa-download mr-1"></i>Imprimir PDF</button>
          </div>
        </div>
        <div id="gridEtiquetas" class="grid grid-cols-2 md:grid-cols-4 gap-4">
          ${productos.map(p => {
            const precioOrig = p.precio_venta;
            const precioDto = precioOrig * (1 - desc / 100);
            return `<div class="bg-yellow-300 rounded border-2 border-yellow-500 p-3 text-center shadow-md">
              <img src="/assets/img/HIPERLIMPIO.png" class="h-8 mx-auto mb-1 object-contain" alt="Logo">
              <p class="text-xs font-bold text-yellow-900 truncate">${p.nombre}</p>
              <p class="text-xs line-through text-yellow-800">$${precioOrig.toFixed(0)}</p>
              <p class="text-lg font-black text-yellow-900">$${precioDto.toFixed(0)}</p>
              <p class="text-xs font-bold text-red-700 bg-red-100 rounded px-1">-${desc}% OFF</p>
            </div>`;
          }).join("")}
        </div>
      </div>`;
  },

  attachEvents() {
    // Limpiar automáticamente el "0" cuando el usuario escribe en ofertaDescuento
    const descuentoInput = document.getElementById('ofertaDescuento');
    if (descuentoInput) {
      descuentoInput.addEventListener('input', (e) => {
        if (e.target.value.startsWith('0') && e.target.value.length > 1) {
          e.target.value = e.target.value.substring(1);
        }
      });
    }

    this.container.querySelectorAll("[data-tab]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.state.tab = e.target.closest("[data-tab]").dataset.tab;
        this.renderUI();
        this.attachEvents();
      });
    });
    this.container.querySelectorAll("[data-action='etiquetas']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        this.state.ofertaSeleccionada = this.state.ofertas.find(o => o.id === id);
        this.state.tab = "etiquetas";
        this.renderUI();
        this.attachEvents();
      });
    });
    this.container.querySelectorAll("[data-action='pdf']").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const id = parseInt(e.currentTarget.dataset.id);
        this.state.ofertaSeleccionada = this.state.ofertas.find(o => o.id === id);
        this.state.tab = "etiquetas";
        this.renderUI();
        this.attachEvents();
        setTimeout(() => this.imprimirEtiquetas(), 300);
      });
    });
    this.container.querySelectorAll("[data-action='eliminar']").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        if (!confirm("¿Eliminar esta oferta?")) return;
        const id = e.currentTarget.dataset.id;
        await fetch(`/api/ofertas/${id}`, { method: "DELETE", headers: api.getHeaders() });
        await this.cargarOfertas();
        this.renderUI();
        this.attachEvents();
      });
    });
    this.container.querySelector("[data-action='volver']")?.addEventListener("click", () => {
      this.state.tab = "lista";
      this.renderUI();
      this.attachEvents();
    });
    this.container.querySelector("[data-action='imprimir-etiquetas']")?.addEventListener("click", () => this.imprimirEtiquetas());
    document.getElementById("btnCrearOferta")?.addEventListener("click", () => this.crearOferta());
  },

  async crearOferta() {
    const nombre = document.getElementById("ofertaNombre")?.value?.trim();
    const descuento = parseInt(document.getElementById("ofertaDescuento")?.value || "0", 10);
    const fecha_inicio = document.getElementById("ofertaInicio")?.value || null;
    const fecha_fin = document.getElementById("ofertaFin")?.value || null;
    if (!nombre || !descuento) { alert("Nombre y descuento son requeridos"); return; }
    try {
      const res = await fetch("/api/ofertas", { method: "POST", headers: api.getHeaders(), body: JSON.stringify({ nombre, descuento, fecha_inicio, fecha_fin }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Error");
      await this.cargarOfertas();
      this.state.tab = "lista";
      this.renderUI();
      this.attachEvents();
    } catch (e) { alert(e.message); }
  },

  imprimirEtiquetas() {
    const html = document.getElementById("gridEtiquetas")?.innerHTML || "";
    imprimirComprobante(`Etiquetas - ${this.state.ofertaSeleccionada?.nombre || "Oferta"}`, `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${html}</div>`);
  }
};
