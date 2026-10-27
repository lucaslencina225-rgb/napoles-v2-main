// Utilidades para formateo de fechas DD-MM-YYYY con zona horaria Argentina

export const dateUtils = {
  // Zona horaria por defecto: Argentina (America/Argentina/Buenos_Aires)
  TIMEZONE: 'America/Argentina/Buenos_Aires',

  toDate(value) {
    if (value instanceof Date) return value;
    let text = String(value).trim();
    // SQLite CURRENT_TIMESTAMP is UTC; date-only filters represent a calendar day.
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += 'T12:00:00Z';
    else if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(text)) text = text.replace(' ', 'T') + 'Z';
    return new Date(text);
  },

  /**
   * Formatea una fecha en formato DD-MM-YYYY con zona horaria Argentina
   * @param {Date|string} date - Fecha a formatear
   * @returns {string} - Fecha formateada como DD-MM-YYYY
   */
  formatDate(date) {
    if (!date) return '';
    const d = this.toDate(date);
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: this.TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    return formatter.format(d);
  },

  /**
   * Formatea una fecha completa con hora en DD-MM-YYYY HH:MM:SS
   * @param {Date|string} date - Fecha a formatear
   * @returns {string} - Fecha con hora formateada
   */
  formatDateTime(date) {
    if (!date) return '';
    const d = this.toDate(date);
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: this.TIMEZONE,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return formatter.format(d);
  },

  /**
   * Formatea solo la hora en HH:MM:SS
   * @param {Date|string} date - Fecha a formatear
   * @returns {string} - Hora formateada
   */
  formatTime(date) {
    if (!date) return '';
    const d = this.toDate(date);
    const formatter = new Intl.DateTimeFormat('es-AR', {
      timeZone: this.TIMEZONE,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    return formatter.format(d);
  },

  /**
   * Obtiene fecha actual en zona horaria Argentina
   * @returns {Date} - Fecha actual
   */
  now() {
    return new Date();
  },

  /**
   * Obtiene fecha actual formateada como DD-MM-YYYY
   * @returns {string} - Fecha formateada
   */
  todayFormatted() {
    return this.formatDate(this.now());
  },

  /**
   * Convierte string DD-MM-YYYY a Date
   * @param {string} dateStr - Fecha en formato DD-MM-YYYY
   * @returns {Date} - Objeto Date
   */
  parseDate(dateStr) {
    const [day, month, year] = dateStr.split('-');
    return new Date(year, month - 1, day);
  }
};

export default dateUtils;

