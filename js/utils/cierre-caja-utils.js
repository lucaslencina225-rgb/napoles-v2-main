import { api } from '../api-client.js';

export const CierreCajaUtils = {
  /**
   * Obtiene el resumen de caja actual
   */
  async obtenerResumenCaja(cajaId) {
    try {
      const res = await fetch(`/api/cajas/${cajaId}/resumen`, { headers: api.getHeaders() });
      return res.ok ? await res.json() : null;
    } catch (error) {
      console.error('Error obteniendo resumen:', error);
      return null;
    }
  },

  /**
   * Carga las ventas del día
   */
  async cargarVentasHoy() {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const params = new URLSearchParams({
        fecha_inicio: hoy,
        fecha_fin: hoy,
        tipo: 'venta',
        limite: '1000'
      });
      const res = await fetch(`/api/ventas?${params}`, { headers: api.getHeaders() });
      return res.ok ? await res.json() : [];
    } catch (error) {
      console.error('Error cargando ventas:', error);
      return [];
    }
  },

  /**
   * Carga los egresos del día
   */
  async cargarEgresosHoy() {
    try {
      const hoy = new Date().toISOString().split('T')[0];
      const res = await fetch(`/api/egresos?fecha=${hoy}`, { headers: api.getHeaders() });
      return res.ok ? await res.json() : [];
    } catch (error) {
      console.error('Error cargando egresos:', error);
      return [];
    }
  },

  /**
   * Carga el historial de cierres de caja
   */
  async cargarHistorialCierres() {
    try {
      const res = await fetch('/api/cierre-caja/historial', { headers: api.getHeaders() });
      return res.ok ? await res.json() : [];
    } catch (error) {
      console.error('Error cargando historial:', error);
      return [];
    }
  },

  /**
   * Verifica si hay una caja abierta
   */
  async verificarCajaAbierta() {
    try {
      const res = await fetch('/api/cajas/actual', { headers: api.getHeaders() });
      return res.ok ? await res.json() : null;
    } catch (error) {
      console.log('No hay caja abierta');
      return null;
    }
  },

  /**
   * Calcula los totales de ventas y egresos
   */
  calcularTotales(ventas, egresos) {
    const totalVentas = ventas.reduce((sum, v) => sum + (v.total || 0), 0);
    const totalEgresos = egresos.reduce((sum, e) => sum + (e.monto || 0), 0);
    const diferencia = totalVentas - totalEgresos;
    return { totalVentas, totalEgresos, diferencia };
  },

  /**
   * Cierra la caja con los datos proporcionados
   */
  async cerrarCaja(cajaId, datos) {
    try {
      const response = await fetch('/api/cajas/cerrar', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify({
          caja_id: cajaId,
          ...datos
        })
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al cerrar caja');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Guarda el cierre en el historial
   */
  async guardarCierreHistorial(datos) {
    try {
      const response = await fetch('/api/cierre-caja', {
        method: 'POST',
        headers: api.getHeaders(),
        body: JSON.stringify(datos)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Error al guardar cierre');
      }

      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  /**
   * Descarga el PDF de un cierre
   */
  async descargarPDFCierre(cierreId) {
    try {
      const res = await fetch(`/api/cierre-caja/${cierreId}/pdf`, { headers: api.getHeaders() });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cierre_caja_${cierreId}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error descargando PDF:', error);
      return false;
    }
  },

  /**
   * Valida la diferencia de caja
   */
  validarDiferenciaCaja(totalEsperado, totalIngresado, permitirDiferencia = 1) {
    const diferencia = Math.abs(totalIngresado - totalEsperado);
    return diferencia <= permitirDiferencia;
  }
};

export default CierreCajaUtils;
