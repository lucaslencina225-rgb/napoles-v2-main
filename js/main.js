import { ThemeManager } from './theme-manager.js';
import { api } from './api-client.js';

const STORAGE_KEY = "pos_auth_token";

const COMPONENTES = [
    { id: "dashboard", nombre: "Dashboard", file: "Dashboard.js", icon: "fa-home" },
    { id: "ventas", nombre: "Ventas", file: "Ventas.js", icon: "fa-shopping-cart" },
    { id: "clientes", nombre: "Clientes", file: "Clientes.js", icon: "fa-users" },
    { id: "barberos", nombre: "Barberos", file: "Barberos.js", icon: "fa-scissors" },
    { id: "inventario", nombre: "Inventario", file: "Inventario.js", icon: "fa-boxes-stacked" },
    { id: "reportes", nombre: "Reportes", file: "Reportes.js", icon: "fa-chart-bar" },
    { id: "config", nombre: "Configuraciones", file: "Configuraciones.js", icon: "fa-gears" },
];

const app = document.getElementById("app");
let asideAbierto = false;

function isAutenticado() {
    return api.isAutenticado();
}

async function logout() {
    await api.logout();
    location.hash = "#/login";
    render();
}

function rutaActual() {
    const hash = location.hash || "#/dashboard";
    const partes = hash.replace(/^#\//, "").split("/");
    return { id: (partes[0] || "dashboard").toLowerCase(), params: partes.slice(1) };
}

const RUTAS_COMPONENTES = [
    "/js/components/",
];

async function importarComponente(file) {
    if (typeof file !== "string" || !file.endsWith(".js")) {
        throw new Error(`Archivo inválido: ${file}`);
    }
    try {
        const url = `/js/components/${file}`;
        return await import(url);
    } catch (e) {
        throw new Error(`No se pudo resolver el módulo: ${file} - ${e.message}`);
    }
}

function render() {
    if (!isAutenticado() && rutaActual().id !== "login") {
        location.hash = "#/login";
    }
    const { id } = rutaActual();
    if (id === "login") return renderLogin();
    return renderShell();
}

function renderLogin() {
    app.innerHTML = `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div class="w-full max-w-md">
        <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-slate-200 dark:border-gray-700">
          <!-- Logo -->
          <div class="flex items-center justify-center mb-8">
            <img src="./assets/img/NAPOLES.jpeg" alt="Napoles Barbería" class="h-16 w-auto object-contain" />
          </div>

          <!-- Title -->
          <h1 class="text-center text-3xl font-bold mb-2 text-gray-900 dark:text-white">
            <span style="color: #dec389">Napoles</span>
            <span style="color: #dec389">Barbería</span>
          </h1>
          <p class="text-center text-gray-600 dark:text-gray-400 mb-8">Sistema de Gestión POS</p>

          <!-- Form -->
          <form id="formLogin" class="space-y-5">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Usuario</label>
              <input id="usuario" name="usuario" required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400
                       text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="admin" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contraseña</label>
              <input id="password" name="password" type="password" required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 
                       focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:focus:ring-blue-400
                       text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="••••••••" />
            </div>

            <div id="mensajeError" class="hidden rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-4">
              <p class="text-sm text-red-700 dark:text-red-300 flex items-center gap-2">
                <i class="fas fa-exclamation-circle"></i>
                <span id="textoError"></span>
              </p>
            </div>

            <button type="submit"
              class="w-full py-3 rounded-lg font-medium transition duration-200
                     bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800
                     text-white shadow-lg hover:shadow-xl active:scale-95">
              <i class="fas fa-arrow-right mr-2"></i> Ingresar
            </button>
          </form>
        </div>

        <!-- Footer -->
        <p class="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
          Render + Turso | GitHub Deployment
        </p>
      </div>
    </div>
  `;

    const form = document.getElementById("formLogin");
    const usuarioInput = document.getElementById("usuario");
    const passwordInput = document.getElementById("password");
    const mensajeError = document.getElementById("mensajeError");
    const textoError = document.getElementById("textoError");
    const btnSubmit = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const usuario = usuarioInput.value.trim();
        const password = passwordInput.value.trim();

        if (!usuario || !password) return;

        btnSubmit.disabled = true;
        btnSubmit.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Ingresando...';
        mensajeError.classList.add("hidden");

        try {
            await api.login(usuario, password);
            location.hash = "#/dashboard";
            render();
        } catch (error) {
            textoError.textContent = error.message;
            mensajeError.classList.remove("hidden");
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = '<i class="fas fa-arrow-right mr-2"></i> Ingresar';
            passwordInput.value = "";
        }
    });
}

function renderShell() {
    const { id } = rutaActual();

    app.innerHTML = `
    <div class="min-h-screen flex bg-gray-50 dark:bg-gray-950">
      <!-- Aside -->
      <aside id="aside" class="fixed md:static inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300
                               ${asideAbierto ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                               bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-2xl">
        <!-- Header -->
        <div class="h-16 flex items-center gap-3 px-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
          <img src="./assets/img/NAPOLES.jpeg" alt="Napoles Barbería" class="h-10 w-auto object-contain" />
          <div class="font-bold text-sm min-w-0">
            <div style="color: #dec389"">Napoles Barbería</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">Sistema POS</div>
          </div>
        </div>

        <!-- Navigation -->
        <nav class="p-3 overflow-y-auto" style="height: calc(100vh - 7rem);">
          <p class="px-3 py-2 text-xs uppercase tracking-widest text-gray-500 dark:text-gray-400 font-semibold">Módulos</p>
          
          <ul id="listaComponentes" class="mt-2 space-y-1"></ul>

          <!-- Divider -->
          <div class="my-6 border-t border-gray-200 dark:border-gray-700"></div>

          <!-- Tools -->
          <div class="space-y-1">
            <button id="btnToggleTheme" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                                            text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800
                                            transition duration-200">
              <i class="fas fa-sun text-gray-600 dark:text-gray-400 w-5"></i>
              <span>Cambiar tema</span>
            </button>

            <button id="btnLogout" class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
                                        text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30
                                        transition duration-200">
              <i class="fas fa-sign-out-alt w-5"></i>
              <span>Cerrar sesión</span>
            </button>
          </div>
        </nav>
      </aside>

      <!-- Overlay mobile -->
      <div id="overlay" class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden ${asideAbierto ? "" : "hidden"}"></div>

      <!-- Main -->
      <div class="flex-1 min-w-0 flex flex-col">
        <!-- Header -->
        <header class="h-14 sm:h-16 flex items-center justify-between px-3 sm:px-6 border-b border-gray-200 dark:border-gray-700
                        bg-white dark:bg-gray-900 shadow-sm dark:shadow-none sticky top-0 z-30">
          <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button id="btnToggleAside" class="md:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition shrink-0" aria-label="Menú">
              <i class="fas fa-bars text-gray-700 dark:text-gray-300"></i>
            </button>
            <h1 class="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">${tituloRuta(id)}</h1>
          </div>
          <div class="hidden xs:block text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap shrink-0 ml-2">
            <i class="fas fa-calendar mr-1"></i> ${new Date().toLocaleDateString()}
          </div>
        </header>

        <!-- Content -->
        <main id="viewport" class="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto overflow-x-hidden"></main>
      </div>
    </div>
  `;

    // Populate menu
    const ul = document.getElementById("listaComponentes");
    ul.innerHTML = COMPONENTES.map(c => `
    <li>
      <a href="#/${c.id}" data-nav-link class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
         transition duration-200 ${c.id === id 
           ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700/50" 
           : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}">
        <i class="fas ${c.icon} w-5 text-center flex-shrink-0"></i>
        <span class="truncate">${c.nombre}</span>
      </a>
    </li>
  `).join("");

    // Events
    document.getElementById("btnToggleTheme").addEventListener("click", () => ThemeManager.toggle());
    document.getElementById("btnLogout").addEventListener("click", logout);
    document.getElementById("btnToggleAside").addEventListener("click", () => {
        asideAbierto = !asideAbierto;
        renderShell();
    });
    document.getElementById("overlay").addEventListener("click", () => {
        asideAbierto = false;
        renderShell();
    });
    ul.querySelectorAll("[data-nav-link]").forEach(link => {
        link.addEventListener("click", () => {
            if (window.innerWidth < 768) {
                asideAbierto = false;
            }
        });
    });

    montarComponente(id);
}

function tituloRuta(id) {
    return (COMPONENTES.find(c => c.id === id) || { nombre: "Módulo" }).nombre;
}

async function montarComponente(id) {
    const comp = COMPONENTES.find(c => c.id === id) || COMPONENTES[0];
    const viewport = document.getElementById("viewport");
    viewport.innerHTML = `
    <div class="animate-pulse flex items-center justify-center h-96">
      <div class="text-center">
        <i class="fas fa-spinner fa-spin text-4xl text-blue-500 dark:text-blue-400 mb-4"></i>
        <p class="text-gray-600 dark:text-gray-400">Cargando ${comp.nombre}...</p>
      </div>
    </div>`;

    try {
        const modulo = await importarComponente(comp.file);
        const contenedor = document.createElement("div");
        viewport.innerHTML = "";
        viewport.appendChild(contenedor);
        await modulo.default.render(contenedor, { params: rutaActual().params });
    } catch (error) {
        console.error("Error cargando módulo:", error);
        viewport.innerHTML = `
        <div class="rounded-xl border border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20 p-6">
          <div class="flex gap-4">
            <i class="fas fa-exclamation-triangle text-red-600 dark:text-red-400 text-2xl flex-shrink-0 mt-0.5"></i>
            <div>
              <h3 class="font-semibold text-red-900 dark:text-red-300 mb-1">Error al cargar ${comp.nombre}</h3>
              <p class="text-red-700 dark:text-red-200 text-sm">${error.message}</p>
            </div>
          </div>
        </div>`;
    }
}

// Routing
window.addEventListener("hashchange", render);
document.addEventListener("DOMContentLoaded", render);
