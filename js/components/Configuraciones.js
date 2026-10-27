import { api } from "../api-client.js";

export default {
  state: {
    usuarios: [],
    sucursales: [],
    categorias: [],
    marcas: [],
    proveedores: [],
    tab: "usuarios",
    usuario_actual: null,
    roles: [
      { id: "admin", nombre: "Administrador", icon: "fa-crown", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300", descripcion: "Acceso completo a ventas, inventario, reportes y configuracion." },
      { id: "gerente", nombre: "Gerente", icon: "fa-briefcase", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300", descripcion: "Gestion operativa, reportes, ofertas e inventario." },
      { id: "supervisor", nombre: "Supervisor", icon: "fa-user-tie", color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300", descripcion: "Control de cajas, stock y seguimiento de ventas." },
      { id: "contador", nombre: "Contador", icon: "fa-calculator", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300", descripcion: "Acceso a reportes, facturacion y cierres de caja." },
      { id: "vendedor", nombre: "Vendedor", icon: "fa-tag", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300", descripcion: "Ventas, clientes y consulta basica de productos." }
    ]
  },

  _confirmCallback: null,
  _toastTimer: null,
  _overlayRoot: null,
  OVERLAY_IDS: ["cfgToast", "modalUsuario", "modalCategoria", "modalMarca", "modalSucursal", "modalProveedor", "modalPassword", "modalConfirm", "modalInfo"],

  async render(c) {
    this.cleanupOverlays();
    this.container = c;
    try {
      await Promise.all([
        this.cargarUsuarios(),
        this.cargarSucursales(),
        this.cargarCategorias(),
        this.cargarMarcas(),
        this.cargarProveedores(),
        this.cargarUsuarioActual()
      ]);
    } catch (e) { /* datos parciales ok */ }
    this.renderUI();
    this.attachEvents();
  },

  esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },

  async cargarUsuarios() {
    try {
      this.state.usuarios = await fetch("/api/usuarios", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch (e) {
      this.state.usuarios = [];
    }
  },

  async cargarSucursales() {
    try {
      this.state.sucursales = await fetch("/api/sucursales", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch (e) { /* noop */ }
  },

  async cargarCategorias() {
    try {
      this.state.categorias = await fetch("/api/categorias", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch (e) { /* noop */ }
  },

  async cargarMarcas() {
    try {
      this.state.marcas = await fetch("/api/marcas", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch (e) { /* noop */ }
  },

  async cargarProveedores() {
    try {
      this.state.proveedores = await fetch("/api/proveedores", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : []);
    } catch (e) { /* noop */ }
  },

  async cargarUsuarioActual() {
    try {
      this.state.usuario_actual = await fetch("/api/me", { headers: api.getHeaders() }).then(r => r.ok ? r.json() : null);
    } catch (e) { /* noop */ }
  },

  getRolIcon(rol) {
    return this.state.roles.find(r => r.id === rol)?.icon || "fa-user";
  },

  getRolColor(rol) {
    return this.state.roles.find(r => r.id === rol)?.color || "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
  },

  getRolLabel(rol) {
    return this.state.roles.find(r => r.id === rol)?.nombre || rol || "Sin rol";
  },

  renderEmptyState(icon, text) {
    return `
      <div class="border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/20">
        <i class="fas ${icon} text-3xl mb-3 block"></i>
        <p class="font-medium">${text}</p>
      </div>
    `;
  },

  renderRolOptions(selected = "vendedor") {
    return this.state.roles.map(r =>
      `<option value="${r.id}" ${r.id === selected ? "selected" : ""}>${this.esc(r.nombre)}</option>`
    ).join("");
  },

  getOverlay(id) {
    return document.getElementById(id);
  },

  mountOverlays() {
    if (!this._overlayRoot) {
      this._overlayRoot = document.createElement("div");
      this._overlayRoot.id = "cfg-overlay-root";
      document.body.appendChild(this._overlayRoot);
    }
    for (const id of this.OVERLAY_IDS) {
      const el = this.container?.querySelector(`#${id}`) || document.getElementById(id);
      if (el && el.parentElement !== this._overlayRoot) {
        this._overlayRoot.appendChild(el);
      }
    }
  },

  cleanupOverlays() {
    if (this._overlayRoot) {
      this._overlayRoot.remove();
      this._overlayRoot = null;
    }
  },

  showToast(message, type = "success") {
    const toast = this.getOverlay("cfgToast");
    if (!toast) return;
    const colors = {
      success: "bg-green-600",
      error: "bg-red-600",
      info: "bg-blue-600"
    };
    const icons = {
      success: "fa-check-circle",
      error: "fa-exclamation-circle",
      info: "fa-info-circle"
    };
    toast.className = `fixed bottom-6 right-6 z-[60] flex items-center gap-3 px-5 py-3 rounded-lg shadow-lg text-white text-sm font-medium transition-all ${colors[type] || colors.info}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${this.esc(message)}</span>`;
    toast.classList.remove("hidden", "opacity-0", "translate-y-2");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => toast.classList.add("hidden"), 300);
    }, 3500);
  },

  showModal(id) {
    this.getOverlay(id)?.classList.remove("hidden");
    document.body.classList.add("overflow-hidden");
  },

  hideModal(id) {
    this.getOverlay(id)?.classList.add("hidden");
    const anyOpen = this.OVERLAY_IDS.some(oid => {
      const el = this.getOverlay(oid);
      return el && oid !== "cfgToast" && !el.classList.contains("hidden");
    });
    if (!anyOpen) document.body.classList.remove("overflow-hidden");
  },

  openConfirm(message, onConfirm, title = "Confirmar acción") {
    this._confirmCallback = onConfirm;
    const msg = this.getOverlay("confirmMessage");
    const ttl = this.getOverlay("confirmTitle");
    if (msg) msg.textContent = message;
    if (ttl) ttl.textContent = title;
    this.showModal("modalConfirm");
  },

  openUsuarioModal(mode, user = null) {
    const isEdit = mode === "edit";
    const title = this.getOverlay("modalUsuarioTitle");
    const hint = this.getOverlay("usuarioPasswordHint");
    const req = this.getOverlay("usuarioPasswordRequired");
    const usuarioInput = this.getOverlay("formUsuario");
    const nombreInput = this.getOverlay("formNombre");
    const emailInput = this.getOverlay("formEmail");
    const rolInput = this.getOverlay("formRol");
    const passInput = this.getOverlay("formPassword");

    if (title) title.textContent = isEdit ? "Editar Usuario" : "Nuevo Usuario";
    if (hint) hint.textContent = isEdit ? "Dejar vacío para mantener la contraseña actual" : "Mínimo 4 caracteres";
    if (req) req.classList.toggle("hidden", isEdit);
    if (usuarioInput) {
      usuarioInput.value = user?.usuario || "";
      usuarioInput.disabled = isEdit;
    }
    if (nombreInput) nombreInput.value = user?.nombre || user?.usuario || "";
    if (emailInput) emailInput.value = user?.email || "";
    if (rolInput) rolInput.value = user?.rol || "vendedor";
    if (passInput) passInput.value = "";

    this.getOverlay("modalUsuario")?.setAttribute("data-mode", mode);
    this.getOverlay("modalUsuario")?.setAttribute("data-id", user?.id || "");
    this.showModal("modalUsuario");
  },

  openCategoriaModal(mode, item = null) {
    const title = this.getOverlay("modalCategoriaTitle");
    if (title) title.textContent = mode === "edit" ? "Editar Categoría" : "Nueva Categoría";
    const input = this.getOverlay("formCategoriaNombre");
    if (input) input.value = item?.nombre || "";
    this.getOverlay("modalCategoria")?.setAttribute("data-mode", mode);
    this.getOverlay("modalCategoria")?.setAttribute("data-id", item?.id || "");
    this.showModal("modalCategoria");
  },

  openMarcaModal(mode, item = null) {
    const title = this.getOverlay("modalMarcaTitle");
    if (title) title.textContent = mode === "edit" ? "Editar Marca" : "Nueva Marca";
    const input = this.getOverlay("formMarcaNombre");
    if (input) input.value = item?.nombre || "";
    this.getOverlay("modalMarca")?.setAttribute("data-mode", mode);
    this.getOverlay("modalMarca")?.setAttribute("data-id", item?.id || "");
    this.showModal("modalMarca");
  },

  openSucursalModal(mode, item = null) {
    const title = this.getOverlay("modalSucursalTitle");
    if (title) title.textContent = mode === "edit" ? "Editar Sucursal" : "Nueva Sucursal";
    const nom = this.getOverlay("formSucursalNombre");
    const dir = this.getOverlay("formSucursalDireccion");
    const tel = this.getOverlay("formSucursalTelefono");
    if (nom) nom.value = item?.nombre || "";
    if (dir) dir.value = item?.direccion || "";
    if (tel) tel.value = item?.telefono || "";
    this.getOverlay("modalSucursal")?.setAttribute("data-mode", mode);
    this.getOverlay("modalSucursal")?.setAttribute("data-id", item?.id || "");
    this.showModal("modalSucursal");
  },

  openProveedorModal(mode, item = null) {
    const title = this.getOverlay("modalProveedorTitle");
    if (title) title.textContent = mode === "edit" ? "Editar Proveedor" : "Nuevo Proveedor";
    const nom = this.getOverlay("formProveedorNombre");
    const contacto = this.getOverlay("formProveedorContacto");
    const email = this.getOverlay("formProveedorEmail");
    const tel = this.getOverlay("formProveedorTelefono");
    const dir = this.getOverlay("formProveedorDireccion");
    const ciudad = this.getOverlay("formProveedorCiudad");
    if (nom) nom.value = item?.nombre || "";
    if (contacto) contacto.value = item?.contacto || "";
    if (email) email.value = item?.email || "";
    if (tel) tel.value = item?.telefono || "";
    if (dir) dir.value = item?.direccion || "";
    if (ciudad) ciudad.value = item?.ciudad || "";
    this.getOverlay("modalProveedor")?.setAttribute("data-mode", mode);
    this.getOverlay("modalProveedor")?.setAttribute("data-id", item?.id || "");
    this.showModal("modalProveedor");
  },

  openPasswordModal() {
    ["#formPassActual", "#formPassNueva", "#formPassConfirmar"].forEach(sel => {
      const el = this.getOverlay(sel.slice(1));
      if (el) el.value = "";
    });
    this.showModal("modalPassword");
  },

  openInfoModal() {
    this.showModal("modalInfo");
  },

  renderModals() {
    return `
      <div id="cfgToast" class="hidden fixed bottom-6 right-6 z-[60] opacity-0 translate-y-2"></div>

      <!-- Modal Usuario -->
      <div id="modalUsuario" data-mode="create" data-id="" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalUsuario"></div>
        <div class="pos-dialog pos-dialog--wide" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--primary">
            <span id="modalUsuarioTitle">Nuevo Usuario</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalUsuario" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <label>Usuario <span class="text-red-500">*</span></label>
            <input id="formUsuario" type="text" autocomplete="off" placeholder="nombre.usuario" />
            <label>Nombre completo</label>
            <input id="formNombre" type="text" />
            <label>Email</label>
            <input id="formEmail" type="email" placeholder="usuario@napolis-barber.com" />
            <label>Rol</label>
            <select id="formRol">${this.renderRolOptions()}</select>
            <label>Contraseña <span id="usuarioPasswordRequired" class="text-red-500">*</span></label>
            <input id="formPassword" type="password" autocomplete="new-password" />
            <p id="usuarioPasswordHint" class="text-xs text-gray-500 dark:text-gray-400 -mt-2 mb-2">Mínimo 4 caracteres</p>
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalUsuario">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--primary" data-modal-save="usuario">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Categoría -->
      <div id="modalCategoria" data-mode="create" data-id="" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalCategoria"></div>
        <div class="pos-dialog" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--primary">
            <span id="modalCategoriaTitle">Nueva Categoría</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalCategoria" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <label>Nombre <span class="text-red-500">*</span></label>
            <input id="formCategoriaNombre" type="text" />
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalCategoria">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--primary" data-modal-save="categoria">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Marca -->
      <div id="modalMarca" data-mode="create" data-id="" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalMarca"></div>
        <div class="pos-dialog" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--primary">
            <span id="modalMarcaTitle">Nueva Marca</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalMarca" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <label>Nombre <span class="text-red-500">*</span></label>
            <input id="formMarcaNombre" type="text" />
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalMarca">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--primary" data-modal-save="marca">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Sucursal -->
      <div id="modalSucursal" data-mode="create" data-id="" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalSucursal"></div>
        <div class="pos-dialog pos-dialog--wide" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--primary">
            <span id="modalSucursalTitle">Nueva Sucursal</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalSucursal" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <label>Nombre <span class="text-red-500">*</span></label>
            <input id="formSucursalNombre" type="text" />
            <label>Dirección</label>
            <input id="formSucursalDireccion" type="text" />
            <label>Teléfono</label>
            <input id="formSucursalTelefono" type="text" />
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalSucursal">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--primary" data-modal-save="sucursal">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Proveedor -->
      <div id="modalProveedor" data-mode="create" data-id="" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalProveedor"></div>
        <div class="pos-dialog pos-dialog--wide" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--primary">
            <span id="modalProveedorTitle">Nuevo Proveedor</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalProveedor" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <label>Nombre <span class="text-red-500">*</span></label>
            <input id="formProveedorNombre" type="text" />
            <label>Contacto</label>
            <input id="formProveedorContacto" type="text" />
            <label>Email</label>
            <input id="formProveedorEmail" type="email" />
            <label>Teléfono</label>
            <input id="formProveedorTelefono" type="text" />
            <label>Dirección</label>
            <input id="formProveedorDireccion" type="text" />
            <label>Ciudad</label>
            <input id="formProveedorCiudad" type="text" />
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalProveedor">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--primary" data-modal-save="proveedor">Guardar</button>
          </div>
        </div>
      </div>

      <!-- Modal Contraseña -->
      <div id="modalPassword" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalPassword"></div>
        <div class="pos-dialog pos-dialog--wide" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--danger">
            <span>Cambiar Contraseña</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalPassword" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <label>Contraseña actual <span class="text-red-500">*</span></label>
            <input id="formPassActual" type="password" autocomplete="current-password" />
            <label>Nueva contraseña <span class="text-red-500">*</span></label>
            <input id="formPassNueva" type="password" autocomplete="new-password" />
            <label>Confirmar nueva contraseña <span class="text-red-500">*</span></label>
            <input id="formPassConfirmar" type="password" autocomplete="new-password" />
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalPassword">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--danger" data-modal-save="password">Actualizar</button>
          </div>
        </div>
      </div>

      <!-- Modal Confirmación -->
      <div id="modalConfirm" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalConfirm"></div>
        <div class="pos-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmTitle" aria-describedby="confirmMessage">
          <div class="pos-dialog-header pos-dialog-header--danger">
            <span id="confirmTitle">Confirmar acción</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalConfirm" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body">
            <p id="confirmMessage"></p>
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--ghost" data-modal-close="modalConfirm">Cancelar</button>
            <button type="button" class="pos-dialog-btn pos-dialog-btn--danger" data-modal-confirm="yes">Confirmar</button>
          </div>
        </div>
      </div>

      <!-- Modal Info -->
      <div id="modalInfo" class="hidden pos-dialog-overlay">
        <div class="pos-dialog-backdrop" data-modal-close="modalInfo"></div>
        <div class="pos-dialog pos-dialog--wide" role="dialog" aria-modal="true">
          <div class="pos-dialog-header pos-dialog-header--info">
            <span>Logs del Sistema</span>
            <button type="button" class="pos-dialog-close" data-modal-close="modalInfo" aria-label="Cerrar">&times;</button>
          </div>
          <div class="pos-dialog-body space-y-2 text-sm">
            <p class="flex items-center gap-2"><i class="fas fa-check-circle text-green-500 w-5"></i> Napoles Barbería POS v1.0 — operativo</p>
            <p class="flex items-center gap-2"><i class="fas fa-database text-blue-500 w-5"></i> SQLite con respaldo disponible</p>
            <p class="flex items-center gap-2"><i class="fas fa-server text-purple-500 w-5"></i> Node.js + Express</p>
            <p class="flex items-center gap-2"><i class="fas fa-shield-alt text-amber-500 w-5"></i> Autenticación Bearer Token</p>
            <p class="flex items-center gap-2"><i class="fas fa-boxes text-indigo-500 w-5"></i> Módulos: Ventas, Inventario, Presupuestos, Ofertas, Reportes</p>
          </div>
          <div class="pos-dialog-footer">
            <button type="button" class="pos-dialog-btn pos-dialog-btn--primary" data-modal-close="modalInfo">Cerrar</button>
          </div>
        </div>
      </div>
    `;
  },

  renderUI() {
    this.container.innerHTML = `
      <div class="space-y-6">
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div class="flex flex-wrap border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <button data-tab="usuarios" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "usuarios" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-users"></i>Usuarios</button>
            <button data-tab="roles" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "roles" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-user-shield"></i>Roles</button>
            <button data-tab="sucursales" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "sucursales" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-store"></i>Sucursales</button>
            <button data-tab="categorias" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "categorias" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-boxes"></i>Categorías</button>
            <button data-tab="marcas" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "marcas" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-tag"></i>Marcas</button>
            <button data-tab="proveedores" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "proveedores" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-truck"></i>Proveedores</button>
            <button data-tab="sistema" class="flex-1 min-w-[120px] px-4 py-4 font-medium border-b-2 transition flex items-center justify-center gap-2 ${this.state.tab === "sistema" ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20" : "border-transparent text-gray-700 dark:text-gray-300 hover:text-gray-900"}"><i class="fas fa-cog"></i>Sistema</button>
          </div>
          <div class="p-6">${this.renderTabContent()}</div>
        </div>
      </div>
      ${this.renderModals()}
    `;
    this.mountOverlays();
  },

  renderTabContent() {
    switch (this.state.tab) {
      case "usuarios":
        return `
          <div>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-users mr-2"></i>Gestión de Usuarios</h3>
              <button data-action="nuevo-usuario" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><i class="fas fa-user-plus mr-1"></i>Nuevo Usuario</button>
            </div>
            <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Usuario</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Nombre</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Rol</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Email</th>
                    <th class="px-6 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">Estado</th>
                    <th class="px-6 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  ${this.state.usuarios.map(u => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td class="px-6 py-4 font-medium text-gray-900 dark:text-gray-100"><i class="fas fa-user mr-2 text-gray-400"></i>${this.esc(u.usuario)}</td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${this.esc(u.nombre || u.usuario)}</td>
                      <td class="px-6 py-4"><span class="px-3 py-1 rounded text-xs font-semibold inline-flex items-center gap-1 ${this.getRolColor(u.rol)}"><i class="fas ${this.getRolIcon(u.rol)}"></i>${this.getRolLabel(u.rol)}</span></td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${this.esc(u.email || "—")}</td>
                      <td class="px-6 py-4 text-center"><span class="px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"><i class="fas fa-circle-check"></i>Activo</span></td>
                      <td class="px-6 py-4 text-center space-x-1">
                        <button data-action="editar-usuario" data-id="${u.id}" title="Editar" class="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"><i class="fas fa-pencil-alt"></i></button>
                        <button data-action="eliminar-usuario" data-id="${u.id}" data-nombre="${this.esc(u.usuario)}" title="Desactivar" class="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition"><i class="fas fa-trash-alt"></i></button>
                      </td>
                    </tr>
                  `).join("") || `<tr><td colspan="6" class="px-6 py-8">${this.renderEmptyState("fa-users-slash", "No hay usuarios registrados")}</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

      case "roles":
        return `
          <div>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-user-shield mr-2"></i>Roles y Permisos</h3>
              <span class="px-3 py-1 rounded bg-gray-100 dark:bg-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300">${this.state.roles.length} roles activos</span>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              ${this.state.roles.map(r => `
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/30">
                  <div class="flex items-center justify-between gap-3 mb-3">
                    <span class="px-3 py-1 rounded text-xs font-semibold inline-flex items-center gap-2 ${r.color}">
                      <i class="fas ${r.icon}"></i>${r.nombre}
                    </span>
                    <span class="text-xs text-gray-500 dark:text-gray-400 font-mono">${r.id}</span>
                  </div>
                  <p class="text-sm text-gray-600 dark:text-gray-300">${r.descripcion}</p>
                </div>
              `).join("")}
            </div>
          </div>
        `;

      case "sucursales":
        return `
          <div>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-store mr-2"></i>Sucursales</h3>
              <button data-action="nueva-sucursal" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><i class="fas fa-plus-circle mr-1"></i>Nueva Sucursal</button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              ${this.state.sucursales.map(s => `
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition bg-gray-50 dark:bg-gray-700/30">
                  <h4 class="font-bold text-gray-900 dark:text-white mb-2"><i class="fas fa-location-dot mr-2 text-blue-600"></i>${this.esc(s.nombre)}</h4>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-1"><i class="fas fa-map-marker-alt mr-1"></i>${this.esc(s.direccion || "Sin dirección")}</p>
                  <p class="text-sm text-gray-600 dark:text-gray-400 mb-3"><i class="fas fa-phone mr-1"></i>${this.esc(s.telefono || "Sin teléfono")}</p>
                  <div class="flex gap-2">
                    <button data-action="editar-sucursal" data-id="${s.id}" class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 rounded text-xs font-medium"><i class="fas fa-pencil-alt mr-1"></i>Editar</button>
                    <button data-action="eliminar-sucursal" data-id="${s.id}" data-nombre="${this.esc(s.nombre)}" class="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 rounded text-xs font-medium"><i class="fas fa-trash-alt mr-1"></i>Eliminar</button>
                  </div>
                </div>
              `).join("") || this.renderEmptyState("fa-store-slash", "No hay sucursales configuradas")}
            </div>
          </div>
        `;

      case "categorias":
        return `
          <div>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-boxes mr-2"></i>Categorías de Productos</h3>
              <button data-action="nueva-categoria" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><i class="fas fa-plus-circle mr-1"></i>Nueva Categoría</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              ${this.state.categorias.map(c => `
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition flex justify-between items-center bg-gray-50 dark:bg-gray-700/30">
                  <span class="text-gray-900 dark:text-gray-100 font-medium truncate mr-2"><i class="fas fa-folder mr-1 text-amber-600"></i>${this.esc(c.nombre)}</span>
                  <div class="flex gap-1 shrink-0">
                    <button data-action="editar-categoria" data-id="${c.id}" class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"><i class="fas fa-pencil-alt"></i></button>
                    <button data-action="eliminar-categoria" data-id="${c.id}" data-nombre="${this.esc(c.nombre)}" class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded"><i class="fas fa-trash-alt"></i></button>
                  </div>
                </div>
              `).join("") || this.renderEmptyState("fa-folder-open", "No hay categorias configuradas")}
            </div>
          </div>
        `;

      case "marcas":
        return `
          <div>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-tag mr-2"></i>Marcas</h3>
              <button data-action="nueva-marca" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><i class="fas fa-plus-circle mr-1"></i>Nueva Marca</button>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
              ${this.state.marcas.map(m => `
                <div class="border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition flex justify-between items-center bg-gray-50 dark:bg-gray-700/30">
                  <span class="text-gray-900 dark:text-gray-100 font-medium truncate mr-2"><i class="fas fa-trademark mr-1 text-purple-600"></i>${this.esc(m.nombre)}</span>
                  <div class="flex gap-1 shrink-0">
                    <button data-action="editar-marca" data-id="${m.id}" class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded"><i class="fas fa-pencil-alt"></i></button>
                    <button data-action="eliminar-marca" data-id="${m.id}" data-nombre="${this.esc(m.nombre)}" class="px-2 py-1 text-xs bg-red-100 text-red-700 rounded"><i class="fas fa-trash-alt"></i></button>
                  </div>
                </div>
              `).join("") || this.renderEmptyState("fa-tags", "No hay marcas configuradas")}
            </div>
          </div>
        `;

      case "sistema":
        return `
          <div class="space-y-6">
            <div class="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h4 class="font-bold text-blue-900 dark:text-blue-100 mb-3"><i class="fas fa-info-circle mr-2"></i>Información del Sistema</h4>
              <p class="text-sm text-blue-800 dark:text-blue-300 mb-2"><i class="fas fa-building mr-2"></i>Napoles Barbería POS v1.0</p>
              <p class="text-sm text-blue-800 dark:text-blue-300 mb-2"><i class="fas fa-database mr-2"></i>SQLite | Bearer Token Auth</p>
              <p class="text-sm text-blue-800 dark:text-blue-300"><i class="fas fa-user-circle mr-2"></i>Usuario: ${this.esc(this.state.usuario_actual?.usuario || "admin")} | Rol: ${this.getRolLabel(this.state.usuario_actual?.rol || "admin")}</p>
            </div>
            <div class="space-y-3">
              <button data-action="backup" class="w-full px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium text-left transition"><i class="fas fa-database mr-2"></i>Respaldar Base de Datos</button>
              <button data-action="ver-logs" class="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium text-left transition"><i class="fas fa-scroll mr-2"></i>Ver Logs del Sistema</button>
              <button data-action="cambiar-password" class="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-left transition"><i class="fas fa-lock mr-2"></i>Cambiar Contraseña</button>
            </div>
          </div>
        `;

      case "proveedores":
        return `
          <div>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white"><i class="fas fa-truck mr-2"></i>Gestión de Proveedores</h3>
              <button data-action="nuevo-proveedor" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"><i class="fas fa-plus-circle mr-1"></i>Nuevo Proveedor</button>
            </div>
            <div class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Nombre</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Contacto</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Email</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Teléfono</th>
                    <th class="px-6 py-3 text-left text-gray-700 dark:text-gray-300 font-semibold">Ciudad</th>
                    <th class="px-6 py-3 text-center text-gray-700 dark:text-gray-300 font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  ${this.state.proveedores.map(p => `
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                      <td class="px-6 py-4 font-medium text-gray-900 dark:text-gray-100"><i class="fas fa-building mr-2 text-gray-400"></i>${this.esc(p.nombre)}</td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${this.esc(p.contacto || "—")}</td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${this.esc(p.email || "—")}</td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${this.esc(p.telefono || "—")}</td>
                      <td class="px-6 py-4 text-gray-600 dark:text-gray-400">${this.esc(p.ciudad || "—")}</td>
                      <td class="px-6 py-4 text-center space-x-1">
                        <button data-action="editar-proveedor" data-id="${p.id}" title="Editar" class="px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"><i class="fas fa-pencil-alt"></i></button>
                        <button data-action="eliminar-proveedor" data-id="${p.id}" data-nombre="${this.esc(p.nombre)}" title="Eliminar" class="px-3 py-1.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition"><i class="fas fa-trash-alt"></i></button>
                      </td>
                    </tr>
                  `).join("") || `<tr><td colspan="6" class="px-6 py-8">${this.renderEmptyState("fa-inbox", "No hay proveedores registrados")}</td></tr>`}
                </tbody>
              </table>
            </div>
          </div>
        `;

      default:
        return "";
    }
  },

  async guardarUsuario() {
    const modal = this.getOverlay("modalUsuario");
    const mode = modal.getAttribute("data-mode");
    const id = modal.getAttribute("data-id");
    const usuario = this.getOverlay("formUsuario").value.trim();
    const nombre = this.getOverlay("formNombre").value.trim();
    const email = this.getOverlay("formEmail").value.trim();
    const rol = this.getOverlay("formRol").value;
    const password = this.getOverlay("formPassword").value;

    if (mode === "create") {
      if (!usuario || !password) {
        this.showToast("Usuario y contraseña son obligatorios", "error");
        return;
      }
      if (password.length < 4) {
        this.showToast("La contraseña debe tener al menos 4 caracteres", "error");
        return;
      }
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: api.getHeaders(),
        body: JSON.stringify({ usuario, password, email, nombre: nombre || usuario, rol })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.showToast(err.error || "Error al crear usuario", "error");
        return;
      }
      this.showToast("Usuario creado correctamente");
    } else {
      const body = { email, nombre: nombre || usuario, rol };
      if (password) {
        if (password.length < 4) {
          this.showToast("La contraseña debe tener al menos 4 caracteres", "error");
          return;
        }
        body.password = password;
      }
      const res = await fetch(`/api/usuarios/${id}`, {
        method: "PUT",
        headers: api.getHeaders(),
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.showToast(err.error || "Error al actualizar usuario", "error");
        return;
      }
      this.showToast("Usuario actualizado correctamente");
    }

    this.hideModal("modalUsuario");
    await this.cargarUsuarios();
    this.renderUI();
    this.attachEvents();
  },

  async guardarCategoria() {
    const modal = this.getOverlay("modalCategoria");
    const mode = modal.getAttribute("data-mode");
    const id = modal.getAttribute("data-id");
    const nombre = this.getOverlay("formCategoriaNombre").value.trim();
    if (!nombre) {
      this.showToast("El nombre es obligatorio", "error");
      return;
    }
    const url = mode === "edit" ? `/api/categorias/${id}` : "/api/categorias";
    const res = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: api.getHeaders(),
      body: JSON.stringify({ nombre })
    });
    if (!res.ok) {
      this.showToast("Error al guardar categoría", "error");
      return;
    }
    this.hideModal("modalCategoria");
    this.showToast(mode === "edit" ? "Categoría actualizada" : "Categoría creada");
    await this.cargarCategorias();
    this.renderUI();
    this.attachEvents();
  },

  async guardarMarca() {
    const modal = this.getOverlay("modalMarca");
    const mode = modal.getAttribute("data-mode");
    const id = modal.getAttribute("data-id");
    const nombre = this.getOverlay("formMarcaNombre").value.trim();
    if (!nombre) {
      this.showToast("El nombre es obligatorio", "error");
      return;
    }
    const url = mode === "edit" ? `/api/marcas/${id}` : "/api/marcas";
    const res = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: api.getHeaders(),
      body: JSON.stringify({ nombre })
    });
    if (!res.ok) {
      this.showToast("Error al guardar marca", "error");
      return;
    }
    this.hideModal("modalMarca");
    this.showToast(mode === "edit" ? "Marca actualizada" : "Marca creada");
    await this.cargarMarcas();
    this.renderUI();
    this.attachEvents();
  },

  async guardarSucursal() {
    const modal = this.getOverlay("modalSucursal");
    const mode = modal.getAttribute("data-mode");
    const id = modal.getAttribute("data-id");
    const nombre = this.getOverlay("formSucursalNombre").value.trim();
    const direccion = this.getOverlay("formSucursalDireccion").value.trim();
    const telefono = this.getOverlay("formSucursalTelefono").value.trim();
    if (!nombre) {
      this.showToast("El nombre es obligatorio", "error");
      return;
    }
    const url = mode === "edit" ? `/api/sucursales/${id}` : "/api/sucursales";
    const res = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: api.getHeaders(),
      body: JSON.stringify({ nombre, direccion, telefono })
    });
    if (!res.ok) {
      this.showToast("Error al guardar sucursal", "error");
      return;
    }
    this.hideModal("modalSucursal");
    this.showToast(mode === "edit" ? "Sucursal actualizada" : "Sucursal creada");
    await this.cargarSucursales();
    this.renderUI();
    this.attachEvents();
  },

  async guardarProveedor() {
    const modal = this.getOverlay("modalProveedor");
    const mode = modal.getAttribute("data-mode");
    const id = modal.getAttribute("data-id");
    const nombre = this.getOverlay("formProveedorNombre").value.trim();
    const contacto = this.getOverlay("formProveedorContacto").value.trim();
    const email = this.getOverlay("formProveedorEmail").value.trim();
    const telefono = this.getOverlay("formProveedorTelefono").value.trim();
    const direccion = this.getOverlay("formProveedorDireccion").value.trim();
    const ciudad = this.getOverlay("formProveedorCiudad").value.trim();
    if (!nombre) {
      this.showToast("El nombre es obligatorio", "error");
      return;
    }
    const url = mode === "edit" ? `/api/proveedores/${id}` : "/api/proveedores";
    const res = await fetch(url, {
      method: mode === "edit" ? "PUT" : "POST",
      headers: api.getHeaders(),
      body: JSON.stringify({ nombre, contacto, email, telefono, direccion, ciudad })
    });
    if (!res.ok) {
      this.showToast("Error al guardar proveedor", "error");
      return;
    }
    this.hideModal("modalProveedor");
    this.showToast(mode === "edit" ? "Proveedor actualizado" : "Proveedor creado");
    await this.cargarProveedores();
    this.renderUI();
    this.attachEvents();
  },

  async guardarPassword() {
    const password_actual = this.getOverlay("formPassActual").value;
    const password_nueva = this.getOverlay("formPassNueva").value;
    const password_confirmar = this.getOverlay("formPassConfirmar").value;

    if (!password_actual || !password_nueva) {
      this.showToast("Complete todos los campos", "error");
      return;
    }
    if (password_nueva !== password_confirmar) {
      this.showToast("Las contraseñas nuevas no coinciden", "error");
      return;
    }
    if (password_nueva.length < 4) {
      this.showToast("La nueva contraseña debe tener al menos 4 caracteres", "error");
      return;
    }

    const res = await fetch("/api/me/password", {
      method: "POST",
      headers: api.getHeaders(),
      body: JSON.stringify({ password_actual, password_nueva })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      this.showToast(err.error || "Error al cambiar contraseña", "error");
      return;
    }
    this.hideModal("modalPassword");
    this.showToast("Contraseña actualizada correctamente");
  },

  async ejecutarBackup() {
    if (this._backupInProgress) return;
    this._backupInProgress = true;
    const button = this.container.querySelector('[data-action="backup"]');
    const original = button?.innerHTML;
    if (button) { button.disabled = true; button.textContent = 'Generando respaldo completo…'; }
    let url;
    try {
      const res = await fetch("/api/backup", { headers: api.getHeaders() });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Error al generar el respaldo");
      }
      const blob = await res.blob();
      if (!blob.size || !/zip/i.test(res.headers.get('Content-Type') || '')) throw new Error('El servidor no entregó un respaldo ZIP válido');
      const link = document.createElement("a");
      url = URL.createObjectURL(blob);
      link.href = url;
      link.download = res.headers.get('Content-Disposition')?.match(/filename="([^"\r\n]+)"/)?.[1] || `napoles-respaldo-${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      this.showToast("Respaldo completo descargado: base de datos y archivos");
    } catch (err) {
      this.showToast(err.message, "error");
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url), 60000);
      if (button) { button.disabled = false; button.innerHTML = original; }
      this._backupInProgress = false;
    }
  },

  attachEvents() {
    if (!this._docClickBound) {
      this._docClickBound = true;
      document.addEventListener("click", this._onDocClick = async (e) => {
        if (!this.container?.isConnected) return;

        const inOverlay = this._overlayRoot?.contains(e.target);

        if (inOverlay) {
          const closeBtn = e.target.closest("[data-modal-close]");
          if (closeBtn) {
            this.hideModal(closeBtn.dataset.modalClose);
            return;
          }

          const saveBtn = e.target.closest("[data-modal-save]");
          if (saveBtn) {
            const type = saveBtn.dataset.modalSave;
            if (type === "usuario") await this.guardarUsuario();
            if (type === "categoria") await this.guardarCategoria();
            if (type === "marca") await this.guardarMarca();
            if (type === "sucursal") await this.guardarSucursal();
            if (type === "proveedor") await this.guardarProveedor();
            if (type === "password") await this.guardarPassword();
            return;
          }

          if (e.target.closest("[data-modal-confirm]")) {
            this.hideModal("modalConfirm");
            if (this._confirmCallback) {
              const cb = this._confirmCallback;
              this._confirmCallback = null;
              await cb();
            }
            return;
          }
        }

        if (!this.container.contains(e.target)) return;

        const tabBtn = e.target.closest("[data-tab]");
        if (tabBtn) {
          this.state.tab = tabBtn.dataset.tab;
          this.renderUI();
          this.attachEvents();
          return;
        }

        const btn = e.target.closest("[data-action]");
        if (!btn) return;
        const action = btn.dataset.action;

        if (action === "nuevo-usuario") {
          this.openUsuarioModal("create");
        }

        if (action === "editar-usuario") {
          const user = this.state.usuarios.find(u => String(u.id) === String(btn.dataset.id));
          if (user) this.openUsuarioModal("edit", user);
        }

        if (action === "eliminar-usuario") {
          const nombre = btn.dataset.nombre || "este usuario";
          this.openConfirm(
            "El usuario no podrá iniciar sesión hasta que sea reactivado.",
            async () => {
              const res = await fetch(`/api/usuarios/${btn.dataset.id}`, { method: "DELETE", headers: api.getHeaders() });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                this.showToast(err.error || "Error al eliminar usuario", "error");
                return;
              }
              this.showToast("Usuario desactivado");
              await this.cargarUsuarios();
              this.renderUI();
              this.attachEvents();
            },
            `Desactivar a "${nombre}"`
          );
        }

        if (action === "nueva-categoria") this.openCategoriaModal("create");

        if (action === "editar-categoria") {
          const item = this.state.categorias.find(c => String(c.id) === String(btn.dataset.id));
          if (item) this.openCategoriaModal("edit", item);
        }

        if (action === "eliminar-categoria") {
          const nombre = btn.dataset.nombre || "";
          this.openConfirm("Esta acción no se puede deshacer.", async () => {
            await fetch(`/api/categorias/${btn.dataset.id}`, { method: "DELETE", headers: api.getHeaders() });
            this.showToast("Categoría eliminada");
            await this.cargarCategorias();
            this.renderUI();
            this.attachEvents();
          }, `Eliminar categoría "${nombre}"`);
        }

        if (action === "nueva-marca") this.openMarcaModal("create");

        if (action === "editar-marca") {
          const item = this.state.marcas.find(m => String(m.id) === String(btn.dataset.id));
          if (item) this.openMarcaModal("edit", item);
        }

        if (action === "eliminar-marca") {
          const nombre = btn.dataset.nombre || "";
          this.openConfirm("Esta acción no se puede deshacer.", async () => {
            await fetch(`/api/marcas/${btn.dataset.id}`, { method: "DELETE", headers: api.getHeaders() });
            this.showToast("Marca eliminada");
            await this.cargarMarcas();
            this.renderUI();
            this.attachEvents();
          }, `Eliminar marca "${nombre}"`);
        }

        if (action === "nueva-sucursal") this.openSucursalModal("create");

        if (action === "editar-sucursal") {
          const item = this.state.sucursales.find(s => String(s.id) === String(btn.dataset.id));
          if (item) this.openSucursalModal("edit", item);
        }

        if (action === "eliminar-sucursal") {
          const nombre = btn.dataset.nombre || "";
          this.openConfirm("La sucursal quedará inactiva en el sistema.", async () => {
            await fetch(`/api/sucursales/${btn.dataset.id}`, { method: "DELETE", headers: api.getHeaders() });
            this.showToast("Sucursal desactivada");
            await this.cargarSucursales();
            this.renderUI();
            this.attachEvents();
          }, `Desactivar sucursal "${nombre}"`);
        }

        if (action === "nuevo-proveedor") this.openProveedorModal("create");

        if (action === "editar-proveedor") {
          const item = this.state.proveedores.find(p => String(p.id) === String(btn.dataset.id));
          if (item) this.openProveedorModal("edit", item);
        }

        if (action === "eliminar-proveedor") {
          const nombre = btn.dataset.nombre || "";
          this.openConfirm("Esta acción no se puede deshacer.", async () => {
            await fetch(`/api/proveedores/${btn.dataset.id}`, { method: "DELETE", headers: api.getHeaders() });
            this.showToast("Proveedor eliminado");
            await this.cargarProveedores();
            this.renderUI();
            this.attachEvents();
          }, `Eliminar proveedor "${nombre}"`);
        }

        if (action === "backup") await this.ejecutarBackup();
        if (action === "ver-logs") this.openInfoModal();
        if (action === "cambiar-password") this.openPasswordModal();
      });
    }
  }
};

