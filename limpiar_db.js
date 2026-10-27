const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error abriendo pos.db:', err.message);
    process.exit(1);
  }
});

const sqlLimpieza = `
  PRAGMA foreign_keys = OFF;
  
  DELETE FROM movimientos_puntos;
  DELETE FROM movimientos_stock;
  DELETE FROM movimientos_caja;
  DELETE FROM items_venta;
  DELETE FROM ventas;
  DELETE FROM cajas;
  DELETE FROM barberos;
  DELETE FROM clientes;
  DELETE FROM stock_sucursal;
  DELETE FROM productos;
  DELETE FROM sucursales;
  DELETE FROM proveedores;
  DELETE FROM marcas;
  DELETE FROM categorias;
  DELETE FROM sesiones;
  DELETE FROM usuarios;
  DELETE FROM ofertas;
  
  DELETE FROM sqlite_sequence;
  VACUUM;
  
  PRAGMA foreign_keys = ON;
`;

db.exec(sqlLimpieza, (err) => {
  if (err) {
    console.error('Error al limpiar la base de datos:', err.message);
  } else {
    console.log('✅ pos.db limpiada exitosamente. Todas las tablas quedaron vacías y los autoincrementables reseteados a 0.');
  }
  db.close();
});