const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { createClient } = require('@libsql/client');
require('dotenv').config();

const dbPath = path.join(__dirname, '..', 'pos.db');

const TURSO_DEFAULT_URL = 'libsql://napolesv2-lucaslencina225-rgb.aws-us-west-2.turso.io';
const TURSO_DEFAULT_TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTQyNTQ0NzQsImlkIjoiMDFhMWMxZTUtYzQwMS03NzYxLWJiZWUtMmY5ZGE3OGViZjMyIiwia2lkIjoiNmJ1Z1pqV3M2OG5sYW9PQkVIaEZmZ2tuV0lMWmpMREtpVWR3bFI5eFpDUSIsInJpZCI6ImIyY2UwYzgxLTUyNDgtNDM1OC1hZjFmLWViMTM5ZGU4YzAyNSJ9.Cet2HlG27xuLSXRLmQVK42EC4oTYOQwUfCGgq7cv7k2anQstemNLrpN767NmJQwCn7jze08ZegEK72yPHiyZBQ';

const tursoUrl = process.env.TURSO_DATABASE_URL || TURSO_DEFAULT_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || TURSO_DEFAULT_TOKEN;

const useTurso = Boolean(
  tursoUrl &&
  tursoToken &&
  process.env.NODE_ENV !== 'test'
);

function normalizeParams(params) {
  if (params === undefined || params === null) return [];
  if (Array.isArray(params)) {
    return params.map(v => (v === undefined ? null : v));
  }
  return [params === undefined ? null : params];
}

let db;
let dbRun;
let dbGet;
let dbAll;
const isTurso = useTurso;

if (useTurso) {
  const turso = createClient({
    url: tursoUrl,
    authToken: tursoToken
  });

  dbRun = async (sql, params = []) => {
    const args = normalizeParams(params);
    const result = await turso.execute({ sql, args });
    return {
      id: (result.lastInsertRowid !== undefined && result.lastInsertRowid !== null)
        ? Number(result.lastInsertRowid)
        : undefined,
      changes: result.rowsAffected
    };
  };

  dbGet = async (sql, params = []) => {
    const args = normalizeParams(params);
    const result = await turso.execute({ sql, args });
    return result.rows && result.rows.length > 0 ? { ...result.rows[0] } : undefined;
  };

  dbAll = async (sql, params = []) => {
    const args = normalizeParams(params);
    const result = await turso.execute({ sql, args });
    return result.rows ? result.rows.map(r => ({ ...r })) : [];
  };

  // Cola secuencial para simular db.serialize() y llamadas basadas en callbacks
  let queue = Promise.resolve();
  const enqueue = (task) => {
    const p = queue.then(task, task);
    queue = p;
    return p;
  };

  db = {
    isTurso: true,
    client: turso,
    serialize: (fn) => {
      if (typeof fn === 'function') fn();
    },
    run: (sql, params, callback) => {
      let actualParams = params;
      let actualCb = callback;
      if (typeof params === 'function') {
        actualCb = params;
        actualParams = [];
      }
      enqueue(async () => {
        try {
          const res = await dbRun(sql, actualParams);
          if (typeof actualCb === 'function') {
            actualCb.call({ lastID: res.id, changes: res.changes }, null);
          }
        } catch (err) {
          if (typeof actualCb === 'function') {
            actualCb(err);
          } else {
            console.error('[TURSO ERROR]', err);
          }
        }
      });
    },
    get: (sql, params, callback) => {
      let actualParams = params;
      let actualCb = callback;
      if (typeof params === 'function') {
        actualCb = params;
        actualParams = [];
      }
      enqueue(async () => {
        try {
          const row = await dbGet(sql, actualParams);
          if (typeof actualCb === 'function') {
            actualCb(null, row);
          }
        } catch (err) {
          if (typeof actualCb === 'function') {
            actualCb(err);
          } else {
            console.error('[TURSO ERROR]', err);
          }
        }
      });
    },
    all: (sql, params, callback) => {
      let actualParams = params;
      let actualCb = callback;
      if (typeof params === 'function') {
        actualCb = params;
        actualParams = [];
      }
      enqueue(async () => {
        try {
          const rows = await dbAll(sql, actualParams);
          if (typeof actualCb === 'function') {
            actualCb(null, rows);
          }
        } catch (err) {
          if (typeof actualCb === 'function') {
            actualCb(err);
          } else {
            console.error('[TURSO ERROR]', err);
          }
        }
      });
    },
    close: (callback) => {
      turso.close();
      if (typeof callback === 'function') callback(null);
    }
  };

  console.log('[OK] Conectado a Turso (LibSQL Cloud)');
} else {
  const sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('[ERROR] Error al conectar BD SQLite:', err.message);
      process.exit(1);
    }
    console.log('[OK] Conectado a SQLite local:', dbPath);
  });

  sqliteDb.isTurso = false;

  dbRun = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.run(sql, normalizeParams(params), function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });

  dbGet = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.get(sql, normalizeParams(params), (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  dbAll = (sql, params = []) => new Promise((resolve, reject) => {
    sqliteDb.all(sql, normalizeParams(params), (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });

  db = sqliteDb;
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  isTurso,
  dbPath
};

