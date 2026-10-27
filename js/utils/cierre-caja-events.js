/**
 * Servicio de Eventos para sincronizar el Cierre de Caja entre componentes
 * Permite que Ventas y CierreCaja compartan estado e información en tiempo real
 */

class CierreCajaEventEmitter {
  constructor() {
    this.listeners = {};
  }

  /**
   * Escuchar evento
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remover listener
   */
  off(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }
  }

  /**
   * Emitir evento
   */
  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error en listener de evento ${event}:`, error);
        }
      });
    }
  }

  /**
   * Notificar que se cerró una caja
   */
  notificarCierreCaja(datos) {
    this.emit('cierre-caja:cerrada', datos);
  }

  /**
   * Notificar que se abrió una caja
   */
  notificarAperturaCaja(datos) {
    this.emit('cierre-caja:abierta', datos);
  }

  /**
   * Notificar actualización de datos
   */
  notificarActualizacion(datos) {
    this.emit('cierre-caja:actualizado', datos);
  }

  /**
   * Limpiar todos los listeners
   */
  limpiar() {
    this.listeners = {};
  }
}

// Instancia global del emisor de eventos
export const cierreCajaEmitter = new CierreCajaEventEmitter();

export default cierreCajaEmitter;
