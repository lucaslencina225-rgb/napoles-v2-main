const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const { inflateRawSync } = require('node:zlib');
const crypto = require('node:crypto');
const sqlite3 = require('sqlite3');
const { JSDOM } = require('jsdom');
const { createBackup } = require('../lib/backup');
const root = path.resolve(__dirname, '..');
const open = file => new Promise((resolve, reject) => { const db = new sqlite3.Database(file, error => error ? reject(error) : resolve(db)); });
const run = (db, sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(error) { error ? reject(error) : resolve(this.lastID); }));
const all = (db, sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows)));
const close = db => new Promise((resolve, reject) => db.close(error => error ? reject(error) : resolve()));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

// Read the ZIP central directory and decompress entries for independent validation.
function unzip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, 'complete ZIP directory');
  let cursor = buffer.readUInt32LE(end + 16);
  const files = {};
  for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
    assert.equal(buffer.readUInt32LE(cursor), 0x02014b50);
    const method = buffer.readUInt16LE(cursor + 10);
    const size = buffer.readUInt32LE(cursor + 20);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const name = buffer.toString('utf8', cursor + 46, cursor + 46 + nameLength);
    const local = buffer.readUInt32LE(cursor + 42);
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const content = buffer.subarray(start, start + size);
    files[name] = method === 8 ? inflateRawSync(content) : content;
    cursor += 46 + nameLength + buffer.readUInt16LE(cursor + 30) + buffer.readUInt16LE(cursor + 32);
  }
  return files;
}

async function browserModules(fetcher = () => { throw new Error('Unexpected fetch'); }) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', { url: 'http://localhost', runScripts: 'outside-only' });
  const context = dom.getInternalVMContext();
  context.fetch = fetcher;
  context.console = console;
  context.URL.createObjectURL = () => 'blob:test';
  context.URL.revokeObjectURL = () => {};
  context.HTMLAnchorElement.prototype.click = () => {};
  const cache = new Map();
  const load = async filename => {
    filename = path.resolve(filename);
    if (cache.has(filename)) return cache.get(filename);
    const module = new vm.SourceTextModule(await fs.readFile(filename, 'utf8'), { context, identifier: filename });
    cache.set(filename, module);
    await module.link((specifier, source) => load(path.resolve(path.dirname(source.identifier), specifier)));
    return module;
  };
  return { dom, context, async get(file) { const module = await load(path.join(root, file)); if (module.status !== 'evaluated') await module.evaluate(); return module.namespace; } };
}

function type(dom, id, text) {
  for (const character of text) {
    const input = dom.window.document.getElementById(id);
    input.focus();
    input.value += character;
    input.setSelectionRange(input.value.length, input.value.length);
    input.dispatchEvent(new dom.window.InputEvent('input', { bubbles: true, data: character }));
    const current = dom.window.document.getElementById(id);
    assert.equal(dom.window.document.activeElement, current, 'search keeps focus after each key');
    assert.equal(current.selectionStart, current.value.length, 'caret remains at typed position');
  }
}

test('continuous search, table sorting, sale selector and report exports', async t => {
  const browser = await browserModules();
  t.after(() => browser.dom.window.close());
  const { document } = browser.dom.window;
  for (const [name, list, id] of [['Clientes', 'clientes', 'clientesBuscar'], ['Barberos', 'barberos', 'barberosBuscar']]) {
    await t.test(`${name}: full-name search and ascending/descending columns`, async () => {
      const component = (await browser.get(`js/components/${name}.js`)).default;
      component.container = document.getElementById('app');
      component.state[list] = [
        { id: 1, codigo_barbero: '002', nombre: 'Zoe', apellido: 'Perez', telefono: '900', email: 'z@test', creado_en: '2026-10-15 02:10:00' },
        { id: 2, codigo_barbero: '010', nombre: 'Martín', apellido: 'Gomez', telefono: '100', email: 'a@test', creado_en: '2026-09-15 04:10:00' }
      ];
      component.renderUI(); component.attachEvents();
      type(browser.dom, id, 'martin gom');
      assert.match(document.querySelector('tbody').textContent, /Martín/);
      assert.doesNotMatch(document.querySelector('tbody').textContent, /Zoe/);
      const input = document.getElementById(id); input.value = ''; input.dispatchEvent(new browser.dom.window.InputEvent('input'));
      const buttons = document.querySelectorAll('thead button');
      assert.equal(buttons.length, 5);
      buttons[1].click(); assert.match(document.querySelector('tbody tr').textContent, /Martín/);
      buttons[1].click(); assert.match(document.querySelector('tbody tr').textContent, /Zoe/);
      buttons[4].click(); assert.match(document.querySelector('tbody tr').textContent, /Martín/);
    });
  }
  await t.test('all client pages, including a match beyond the old 50/200 limits', async () => {
    const { api } = await browser.get('js/api-client.js');
    const calls = [];
    browser.context.fetch = async url => {
      calls.push(url);
      const offset = Number(new URL(url, 'http://localhost').searchParams.get('offset'));
      const rows = Array.from({ length: Math.min(500, 620 - offset) }, (_, i) => ({ id: offset + i + 1, nombre: offset + i === 619 ? 'María' : 'Otro', apellido: 'López', telefono: '351' }));
      return { ok: true, text: async () => JSON.stringify(rows) };
    };
    const component = (await browser.get('js/components/Ventas.js')).default;
    component.state.clientes = await api.getAll('/clientes');
    component.container = document.getElementById('app');
    component.renderUI(); component.attachEvents();
    type(browser.dom, 'buscarClienteVenta', 'maria lop');
    assert.equal(component.state.clientes.length, 620);
    assert.equal(calls.length, 2);
    assert.equal(document.querySelectorAll('#clienteSeleccionar option').length, 2);
    const select = document.getElementById('clienteSeleccionar'); select.value = '620'; select.dispatchEvent(new browser.dom.window.Event('change'));
    component.renderUI(); component.attachEvents();
    assert.equal(document.getElementById('clienteSeleccionar').value, '620');
  });
  await t.test('inventory search parameters and numeric column sorting cover the whole catalog', async () => {
    const inventory = (await browser.get('js/components/Inventario.js')).default;
    let requested;
    browser.context.fetch = async url => {
      requested = new URL(url, 'http://localhost');
      return { ok: true, json: async () => [{ id: 1, nombre: 'Pomada', sku: 'POM', precio_venta: 900, puntos: 2, minimo_stock: 0 }] };
    };
    inventory.container = document.getElementById('app');
    inventory.renderUI(); inventory.attachEvents();
    type(browser.dom, 'busqueda', 'pomada');
    clearTimeout(inventory._searchTimer);
    await inventory.buscar();
    assert.equal(requested.searchParams.get('buscar'), 'pomada');
    assert.equal(requested.searchParams.get('limite'), '50');
    assert.equal(document.activeElement.id, 'busqueda');
    await inventory.sortTable(0, 4, -1);
    assert.equal(requested.searchParams.get('ordenar'), 'precio_venta');
    assert.equal(requested.searchParams.get('direccion'), 'desc');
  });
  await t.test('Argentina timestamps, CSV content, PDF source and table columns agree', async () => {
    const { default: date } = await browser.get('js/utils/date-utils.js');
    assert.equal(date.formatTime('2026-10-17 02:15:30'), '23:15:30');
    assert.equal(date.formatDate('2026-10-17 02:15:30'), '16/10/2026');
    assert.equal(date.formatDate('2026-10-16'), '16/10/2026');
    const report = (await browser.get('js/components/Reportes.js')).default;
    report.container = document.getElementById('app');
    report.state.fecha_inicio = report.state.fecha_fin = '2026-10-16';
    report.state.reportes = [{ id: 5, numero_ticket: 'T-5', fecha_venta: '2026-10-17 02:15:30', total: 12000, estado: 'pagada', medio_pago: 'efectivo' }];
    report.renderUI(); report.attachEvents();
    assert.equal(document.querySelectorAll('thead th').length, 9);
    assert.match(document.querySelector('tbody').textContent, /23:15:30/);
    let blob;
    browser.context.Blob = class { constructor(parts) { blob = parts.join(''); } };
    report.exportar(); assert.match(blob, /Fecha,Hora/); assert.match(blob, /"16\/10\/2026","23:15:30"/);
    let pdf;
    browser.context.html2pdf = () => ({ set() { return this; }, from(el) { pdf = el; return this; }, save() {} });
    report.exportarPDF(); assert.match(pdf.textContent, /23:15:30/);
    assert.equal(pdf.querySelectorAll('thead th').length, 9);
    assert.equal(pdf.querySelector('tfoot td').colSpan, 8);
  });
});

test('complete backup includes WAL rows, unknown tables and all uploaded files', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'napoles-test-backup-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const db = await open(path.join(directory, 'pos.db'));
  t.after(() => close(db));
  await run(db, 'PRAGMA journal_mode=WAL');
  await run(db, 'CREATE TABLE custom_future_table (id INTEGER PRIMARY KEY, content BLOB)');
  await run(db, 'INSERT INTO custom_future_table VALUES (1, ?)', [Buffer.from([0, 255, 42])]);
  await fs.mkdir(path.join(directory, 'uploads', 'nested'), { recursive: true });
  await fs.writeFile(path.join(directory, 'uploads', 'nested', 'foto.png'), Buffer.from([0, 1, 255]));
  const result = await createBackup(db, directory);
  const archive = unzip(await fs.readFile(result.filename));
  const manifest = JSON.parse(archive['manifest.json']);
  assert.equal(manifest.tables.custom_future_table, 1);
  assert.ok(archive['RESTAURAR.txt']);
  for (const item of manifest.files) {
    assert.equal(archive[item.path].length, item.bytes);
    assert.equal(crypto.createHash('sha256').update(archive[item.path]).digest('hex'), item.sha256);
  }
  const restored = path.join(directory, 'restored.db'); await fs.writeFile(restored, archive['pos.db']);
  const copy = await open(restored);
  assert.equal((await all(copy, 'PRAGMA integrity_check'))[0].integrity_check, 'ok');
  assert.deepEqual((await all(copy, 'SELECT content FROM custom_future_table'))[0].content, Buffer.from([0, 255, 42]));
  await close(copy);
  await result.cleanup();
  await assert.rejects(fs.stat(result.filename), { code: 'ENOENT' });
});

test('server integration: service stock, complete lists, report dates, inventory sorting and authenticated backup', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'napoles-test-server-'));
  await fs.copyFile(path.join(root, 'server.js'), path.join(directory, 'server.js'));
  await fs.cp(path.join(root, 'lib'), path.join(directory, 'lib'), { recursive: true });
  await fs.copyFile(path.join(root, 'index.html'), path.join(directory, 'index.html'));
  await fs.symlink(path.join(root, 'node_modules'), path.join(directory, 'node_modules'), 'dir');
  const net = require('node:net');
  const port = await new Promise(resolve => { const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => { const value = socket.address().port; socket.close(() => resolve(value)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: directory, env: { ...process.env, PORT: String(port) }, stdio: 'pipe' });
  let logs = ''; server.stdout.on('data', b => logs += b); server.stderr.on('data', b => logs += b);
  t.after(async () => { server.kill(); await new Promise(resolve => server.once('exit', resolve)); await fs.rm(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base)).ok) break; } catch {}
    await pause(30);
  }
  assert.match(logs, /Sistema POS/);
  const db = await open(path.join(directory, 'pos.db'));
  t.after(() => close(db));
  for (let attempt = 0; attempt < 100; attempt++) {
    if ((await all(db, "SELECT name FROM sqlite_master WHERE name='movimientos_puntos'")).length) break;
    await pause(30);
  }
  await run(db, "INSERT INTO usuarios (id,usuario,password,rol) VALUES (1,'test','unused','admin'),(2,'seller','unused','vendedor')");
  await run(db, "INSERT INTO sesiones (usuario_id,token,expira_en) VALUES (1,'test-admin','2099-01-01'),(2,'test-seller','2099-01-01')");
  await run(db, "INSERT INTO sucursales (id,nombre) VALUES (1,'Central')");
  await run(db, "INSERT INTO cajas (id,usuario_id,sucursal_id,monto_inicial) VALUES (1,1,1,0)");
  await run(db, "INSERT INTO barberos (id,nombre,codigo_barbero) VALUES (1,'Martín','B1')");
  for (let i = 1; i <= 620; i++) await run(db, 'INSERT INTO clientes (nombre,apellido,telefono) VALUES (?,?,?)', [`Cliente ${i}`, 'Apellido', String(351000 + i)]);
  const request = (url, body, token = 'test-admin', method = body ? 'POST' : 'GET') => fetch(base + url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const create = async body => { const response = await request('/api/productos', body); assert.equal(response.status, 200, await response.clone().text()); return response.json(); };
  const service = await create({ sku: 'CORTE', nombre: 'Corte', precio_venta: 12000, es_servicio: 1 });
  const product = await create({ sku: 'POMADA', nombre: 'Pomada', precio_venta: 900, minimo_stock: 0 });
  assert.equal((await all(db, 'SELECT minimo_stock FROM productos WHERE id=?', [service.id]))[0].minimo_stock, -1);
  await run(db, 'UPDATE stock_sucursal SET cantidad=10 WHERE producto_id=?', [product.id]);
  const sale = await request('/api/ventas', { caja_id: 1, sucursal_id: 1, cliente_id: 620, barbero_id: 1, estado: 'pagada', total: 12900, subtotal: 12900, items: [{ producto_id: service.id, cantidad: 1, precio_unitario: 12000 }, { producto_id: product.id, cantidad: 1, precio_unitario: 900 }] });
  assert.equal(sale.status, 200, await sale.clone().text());
  assert.equal((await all(db, 'SELECT cantidad FROM stock_sucursal WHERE producto_id=?', [service.id]))[0].cantidad, 0);
  assert.equal((await all(db, 'SELECT cantidad FROM stock_sucursal WHERE producto_id=?', [product.id]))[0].cantidad, 9);
  await run(db, 'UPDATE stock_sucursal SET cantidad=-270 WHERE producto_id=?', [service.id]);
  assert.ok(!(await (await request('/api/reportes/stock-bajo')).json()).some(p => p.id === service.id));
  assert.equal((await request(`/api/stock/${service.id}/1`, { cantidad: 5 }, 'test-admin', 'PUT')).status, 400);
  assert.equal((await (await request('/api/clientes?limite=500&offset=500')).json()).length, 120);
  assert.equal((await (await request('/api/clientes?buscar=Cliente%20620%20Apellido')).json())[0].id, 620);
  const sorted = await (await request('/api/productos?ordenar=precio_venta&direccion=asc')).json();
  assert.equal(sorted[0].id, product.id);
  assert.equal((await (await request('/api/productos?buscar=Pomada')).json()).length, 1);
  await run(db, "UPDATE ventas SET fecha_venta='2026-10-17 02:15:30'");
  assert.equal((await (await request('/api/ventas?fecha_inicio=2026-10-16&fecha_fin=2026-10-16')).json()).length, 1);
  assert.equal((await (await request('/api/ventas?fecha_inicio=2026-10-17&fecha_fin=2026-10-17')).json()).length, 0);
  // More than a thousand sales and twenty customer/product groups must remain available.
  await run(db, `WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x<1051)
    INSERT INTO ventas (caja_id, usuario_id, sucursal_id, cliente_id, fecha_venta, subtotal, total, estado, medio_pago, numero_ticket)
    SELECT 1,1,1,(x%25)+1,'2026-09-10 15:00:00',100,100,'pagada','efectivo','TEST-'||x FROM n`);
  assert.equal((await (await request('/api/ventas?fecha_inicio=2026-09-10&fecha_fin=2026-09-10&limite=500&offset=1000')).json()).length, 51);
  assert.equal((await (await request('/api/reportes/clientes?fecha_inicio=2026-09-10&fecha_fin=2026-09-10')).json()).length, 25);
  assert.equal((await request('/api/backup', null, 'test-seller')).status, 403);
  assert.equal((await fetch(base + '/api/backup')).status, 401);
  assert.equal((await fetch(base + '/pos.db')).status, 404);
  const backup = await request('/api/backup'); assert.equal(backup.status, 200, await backup.clone().text());
  assert.match(backup.headers.get('content-type'), /zip/);
  const archive = unzip(Buffer.from(await backup.arrayBuffer()));
  const manifest = JSON.parse(archive['manifest.json']);
  assert.equal(manifest.tables.clientes, 620);
  assert.equal(manifest.tables.ventas, 1052);
  assert.equal(manifest.tables.items_venta, 2);
  assert.equal(manifest.tables.usuarios, 2);
  assert.ok(Object.keys(manifest.tables).length >= 15);
});
