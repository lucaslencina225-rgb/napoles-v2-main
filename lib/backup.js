const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const archiver = require('archiver');
const sqlite3 = require('sqlite3');

async function fileInventory(root, relative = '') {
  const directory = path.join(root, relative);
  let entries;
  try { entries = await fs.promises.readdir(directory, { withFileTypes: true }); }
  catch (error) { if (error.code === 'ENOENT' && !relative) return []; throw error; }
  const files = [];
  for (const entry of entries) {
    const name = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await fileInventory(root, name));
    else if (entry.isFile()) files.push(name);
    else throw new Error(`Archivo no respaldable: ${name}`);
  }
  return files.sort();
}

async function sha256(filename) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
  return hash.digest('hex');
}

async function inspectSnapshot(filename) {
  const snapshot = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(filename, sqlite3.OPEN_READONLY, error => error ? reject(error) : resolve(connection));
  });
  const all = sql => new Promise((resolve, reject) => snapshot.all(sql, (error, rows) => error ? reject(error) : resolve(rows)));
  try {
    const checks = await all('PRAGMA integrity_check');
    if (checks.length !== 1 || Object.values(checks[0])[0] !== 'ok') throw new Error('La copia SQLite no pasó la verificación de integridad');
    const tables = await all("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name");
    const counts = {};
    for (const { name } of tables) {
      const identifier = '"' + name.replace(/"/g, '""') + '"';
      counts[name] = (await all(`SELECT COUNT(*) AS count FROM ${identifier}`))[0].count;
    }
    return counts;
  } finally {
    await new Promise((resolve, reject) => snapshot.close(error => error ? reject(error) : resolve()));
  }
}

async function createBackup(db, applicationDir) {
  const staging = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'napoles-backup-'));
  const cleanup = () => fs.promises.rm(staging, { recursive: true, force: true });
  try {
    const snapshot = path.join(staging, 'pos.db');
    // VACUUM INTO produces a consistent database, including committed WAL data.
    // Never copy the live .db while it can be changing.
    await new Promise((resolve, reject) => db.run('VACUUM INTO ?', [snapshot], error => error ? reject(error) : resolve()));
    const tables = await inspectSnapshot(snapshot);
    const files = [{ name: 'pos.db', source: snapshot }];
    for (const folder of ['uploads', 'assets']) {
      const root = path.join(applicationDir, folder);
      for (const relative of await fileInventory(root)) {
        const name = path.join(folder, relative);
        const target = path.join(staging, name);
        await fs.promises.mkdir(path.dirname(target), { recursive: true });
        await fs.promises.copyFile(path.join(root, relative), target);
        files.push({ name: name.split(path.sep).join('/'), source: target });
      }
    }
    const manifest = {
      format: 'napoles-full-backup', version: 1, created_at: new Date().toISOString(),
      database: 'pos.db', integrity_check: 'ok', tables, files: []
    };
    for (const file of files) {
      manifest.files.push({ path: file.name, bytes: (await fs.promises.stat(file.source)).size, sha256: await sha256(file.source) });
    }
    const instructions = `RESPALDO COMPLETO DE NÁPOLES\n\nIncluye todas las tablas y registros de SQLite (usuarios, sesiones, clientes, barberos, ventas, detalles, puntos, cajas, movimientos, productos y configuración), además de uploads y assets.\n\nRestauración: detener el servidor; conservar una copia de la instalación actual; extraer pos.db en la carpeta de la aplicación y restaurar uploads/ y assets/. Con el servidor detenido, retirar los antiguos pos.db-wal y pos.db-shm antes de iniciar. Requiere una versión compatible de la aplicación.\n\nmanifest.json registra tablas, cantidades, tamaños y SHA-256. Las imágenes externas por URL no se descargan: se conserva su referencia en la base. El archivo contiene credenciales y sesiones: guardarlo en un lugar privado.\n`;
    const filename = path.join(staging, 'respaldo.zip');
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('warning', error => archive.destroy(error));
    const writing = pipeline(archive, fs.createWriteStream(filename, { mode: 0o600 }));
    // Attach rejection handling before finalization to avoid unhandled errors.
    writing.catch(() => {});
    files.forEach(file => archive.file(file.source, { name: file.name }));
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });
    archive.append(instructions, { name: 'RESTAURAR.txt' });
    await Promise.all([archive.finalize(), writing]);
    return { filename, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
module.exports = { createBackup };
