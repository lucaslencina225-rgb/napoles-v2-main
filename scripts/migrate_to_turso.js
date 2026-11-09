require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');

const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('Error: Debes configurar TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en el archivo .env');
  process.exit(1);
}

const turso = createClient({
  url: TURSO_URL,
  authToken: TURSO_TOKEN
});

const localDb = new sqlite3.Database('pos.db');

const getLocalData = (sql, params = []) => new Promise((resolve, reject) => {
  localDb.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

async function migrate() {
  console.log('🚀 Iniciando migración de pos.db a Turso...');

  // 1. Obtener DDL de todas las tablas en pos.db
  const schemaRows = await getLocalData(
    "SELECT type, name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );

  const tableOrder = [
    'usuarios',
    'sucursales',
    'categorias',
    'marcas',
    'proveedores',
    'barberos',
    'sesiones',
    'productos',
    'stock_sucursal',
    'clientes',
    'cajas',
    'ventas',
    'items_venta',
    'movimientos_stock',
    'ofertas',
    'movimientos_caja',
    'movimientos_puntos'
  ];

  const schemaMap = new Map();
  schemaRows.forEach(r => schemaMap.set(r.name, r.sql));

  // Ordenar según tableOrder
  const orderedTables = [
    ...tableOrder.filter(t => schemaMap.has(t)),
    ...schemaRows.map(r => r.name).filter(t => !tableOrder.includes(t))
  ];

  console.log('Tablas a crear y migrar:', orderedTables);

  // 2. Crear tablas en Turso
  for (const tableName of orderedTables) {
    const createSql = schemaMap.get(tableName);
    if (!createSql) continue;
    console.log(`Creando tabla en Turso: ${tableName}...`);
    // Asegurar IF NOT EXISTS
    const sqlWithIfNotExists = createSql.replace(/CREATE TABLE\s+(?!IF NOT EXISTS)/i, 'CREATE TABLE IF NOT EXISTS ');
    await turso.execute(sqlWithIfNotExists);
  }

  // 3. Migrar datos por tabla
  for (const tableName of orderedTables) {
    const rows = await getLocalData(`SELECT * FROM "${tableName}"`);
    console.log(`Tabla "${tableName}": ${rows.length} registros para insertar`);
    if (rows.length === 0) continue;

    // Insertar en lotes de 50 registros usando batch
    const BATCH_SIZE = 50;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      const statements = chunk.map(row => {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const colNames = columns.map(c => `"${c}"`).join(', ');
        const values = columns.map(c => row[c]);
        return {
          sql: `INSERT OR REPLACE INTO "${tableName}" (${colNames}) VALUES (${placeholders})`,
          args: values
        };
      });

      await turso.batch(statements, 'write');
    }
  }

  // 4. Migrar sqlite_sequence
  try {
    const sequences = await getLocalData('SELECT * FROM sqlite_sequence');
    console.log('Migrando sqlite_sequence...');
    const seqStatements = sequences.map(s => ({
      sql: `INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`,
      args: [s.name, s.seq]
    }));
    if (seqStatements.length > 0) {
      await turso.batch(seqStatements, 'write');
    }
  } catch (e) {
    console.warn('Advertencia en sqlite_sequence:', e.message);
  }

  // 5. Verificación final
  console.log('\n--- VERIFICACIÓN DE CONTEO EN TURSO VS LOCAL ---');
  let allMatch = true;
  for (const tableName of orderedTables) {
    const localCountRow = await getLocalData(`SELECT count(*) as c FROM "${tableName}"`);
    const tursoCountRes = await turso.execute(`SELECT count(*) as c FROM "${tableName}"`);
    const localCount = localCountRow[0].c;
    const tursoCount = Number(tursoCountRes.rows[0].c);

    const match = localCount === tursoCount;
    if (!match) allMatch = false;
    console.log(`- ${tableName.padEnd(20)}: Local = ${localCount}, Turso = ${tursoCount} ${match ? '✅' : '❌'}`);
  }

  if (allMatch) {
    console.log('\n🎉 ¡Migración completa exitosa! Todos los registros coinciden.');
  } else {
    console.warn('\n⚠️ Advertencia: Algunos conteos no coinciden.');
  }

  localDb.close();
}

migrate().catch(err => {
  console.error('Error durante la migración:', err);
  localDb.close();
  process.exit(1);
});

