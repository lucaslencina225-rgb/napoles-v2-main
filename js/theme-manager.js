/**
 * Theme Manager - Gestión de modo claro/oscuro
 * - Detección automática de preferencia del sistema
 * - Persistencia en localStorage
 * - Sin flash de carga
 */

const THEME_STORAGE_KEY = 'pos_theme_preference';

export const ThemeManager = {
  /**
   * Inicializa el tema al cargar la página
   * Se ejecuta lo antes posible para evitar flash
   */
  init() {
    const savedTheme = this.getSavedTheme();
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    this.setTheme(initialTheme, false);
  },

  /**
   * Obtiene el tema guardado en localStorage
   */
  getSavedTheme() {
    try {
      return localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Obtiene el tema actual (light o dark)
   */
  getCurrentTheme() {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  },

  /**
   * Cambia el tema
   * @param {string} theme - 'light' o 'dark'
   * @param {boolean} save - Guardar en localStorage
   */
  setTheme(theme, save = true) {
    if (!['light', 'dark'].includes(theme)) {
      console.warn(`Invalid theme: ${theme}. Using 'light'.`);
      theme = 'light';
    }

    const html = document.documentElement;
    
    if (theme === 'dark') {
      html.classList.add('dark');
      document.body.style.colorScheme = 'dark';
    } else {
      html.classList.remove('dark');
      document.body.style.colorScheme = 'light';
    }

    if (save) {
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch (e) {
        console.warn('Could not save theme preference:', e);
      }
    }

    // Disparar evento personalizado
    window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
  },

  /**
   * Alterna entre light y dark
   */
  toggle() {
    const current = this.getCurrentTheme();
    const next = current === 'light' ? 'dark' : 'light';
    this.setTheme(next, true);
  },

  /**
   * Detecta si el usuario prefiere dark mode
   */
  getSystemPreference() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  /**
   * Escucha cambios del sistema operativo
   */
  onSystemPreferenceChange(callback) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addListener((e) => {
      const newTheme = e.matches ? 'dark' : 'light';
      callback(newTheme);
    });
  },

  /**
   * Sincroniza con la preferencia del sistema
   */
  syncWithSystem() {
    const systemTheme = this.getSystemPreference();
    this.setTheme(systemTheme, false);
  },
};

// Inicializar el tema inmediatamente
ThemeManager.init();

export default ThemeManager;
