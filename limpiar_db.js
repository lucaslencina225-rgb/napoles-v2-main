const { dbRun, isTurso, db } = require('./lib/db');

const tables = [
  'movimientos_puntos',
  'movimientos_stock',
  'movimientos_caja',
  'items_venta',
  'ventas',
  'cajas',
  'barberos',
  'clientes',
  'stock_sucursal',
  'productos',
  'sucursales',
  'proveedores',
  'marcas',
  'categorias',
  'sesiones',
  'usuarios',
  'ofertas'
];

async function limpiar() {
  console.log(`Iniciando limpieza en ${isTurso ? 'Turso' : 'SQLite local'}...`);
  try {
    for (const table of tables) {
      await dbRun(`DELETE FROM "${table}"`);
    }
    try {
      await dbRun('DELETE FROM sqlite_sequence');
    } catch (e) {}

    console.log('✅ Base de datos limpiada exitosamente. Todas las tablas quedaron vacías y los autoincrementables reseteados a 0.');
    process.exit(0);
  } catch (err) {
    console.error('Error al limpiar la base de datos:', err.message);
    process.exit(1);
  }
}

limpiar();