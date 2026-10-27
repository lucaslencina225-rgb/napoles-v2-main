const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const multer = require('multer');
const fs = require('fs');
const { createBackup } = require('./lib/backup');
const { isService, stockMinimum } = require('./lib/product-utils');

const app = express();
const dbPath = path.join(__dirname, 'pos.db');

// Crear carpeta de uploads
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar multer para carga de imágenes
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}${ext}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const mimetype = file.mimetype;
    if (/^image\/(jpeg|png|webp|gif)$/.test(mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes (JPEG, PNG, WebP, GIF)'), false);
    }
  }
});

// ===== CONFIGURACIÓN DE BD =====
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('[ERROR] Error al conectar BD:', err.message);
    process.exit(1);
  }
  console.log('[OK] Conectado a SQLite');
  inicializarBD();
});

// Promisificar db functions
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
    if (err) reject(err);
    else resolve({ id: this.lastID, changes: this.changes });
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

function inicializarBD() {
  db.serialize(() => {
    // 1. Usuarios
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password TEXT NOT NULL,
      nombre TEXT,
      rol TEXT DEFAULT 'vendedor',
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 2. Sesiones
    db.run(`CREATE TABLE IF NOT EXISTS sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      expira_en DATETIME NOT NULL,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    // 3. Sucursales
    db.run(`CREATE TABLE IF NOT EXISTS sucursales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      direccion TEXT,
      telefono TEXT,
      activa INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 4. Categorías
    db.run(`CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 5. Marcas
    db.run(`CREATE TABLE IF NOT EXISTS marcas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      descripcion TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 6. Proveedores
    db.run(`CREATE TABLE IF NOT EXISTS proveedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT UNIQUE NOT NULL,
      cuit TEXT,
      email TEXT,
      telefono TEXT,
      direccion TEXT,
      rubro TEXT,
      contacto TEXT,
      notas TEXT,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 7. Productos
    db.run(`CREATE TABLE IF NOT EXISTS productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sku TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id INTEGER,
      marca_id INTEGER,
      proveedor_id INTEGER,
      precio_costo REAL,
      precio_venta REAL NOT NULL,
      precio_venta_minorista REAL,
      puntos INTEGER DEFAULT 0,
      minimo_stock INTEGER DEFAULT 5,
      activo INTEGER DEFAULT 1,
      imagen_url TEXT,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (categoria_id) REFERENCES categorias(id),
      FOREIGN KEY (marca_id) REFERENCES marcas(id),
      FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
    )`);

    // 8. Stock por Sucursal
    db.run(`CREATE TABLE IF NOT EXISTS stock_sucursal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      cantidad INTEGER DEFAULT 0,
      actualizado_en DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(producto_id, sucursal_id),
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
    )`);

    // 9. Clientes
    db.run(`CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT,
      email TEXT,
      telefono TEXT,
      documento_tipo TEXT,
      documento_numero TEXT UNIQUE,
      direccion TEXT,
      ciudad TEXT,
      provincia TEXT,
      codigo_postal TEXT,
      razon_social TEXT,
      cuit TEXT UNIQUE,
      tipo_cliente TEXT DEFAULT 'minorista',
      puntos_acumulados INTEGER DEFAULT 0,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 9.1. Barberos
    db.run(`CREATE TABLE IF NOT EXISTS barberos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      apellido TEXT,
      email TEXT,
      telefono TEXT,
      documento_tipo TEXT,
      documento_numero TEXT UNIQUE,
      codigo_barbero TEXT UNIQUE NOT NULL,
      activo INTEGER DEFAULT 1,
      creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 10. Cajas
    db.run(`CREATE TABLE IF NOT EXISTS cajas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      fecha_apertura DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_cierre DATETIME,
      monto_inicial REAL NOT NULL,
      monto_final_esperado REAL,
      monto_retirado REAL,
      monto_en_caja REAL,
      transferencia_admin REAL DEFAULT 0,
      saldo_inicial_siguiente REAL DEFAULT 0,
      diferencia REAL,
      estado TEXT DEFAULT 'abierta',
      observaciones TEXT,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
    )`);

    // 11. Ventas
    db.run(`CREATE TABLE IF NOT EXISTS ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL,
      cliente_id INTEGER,
      barbero_id INTEGER,
      usuario_id INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      fecha_venta DATETIME DEFAULT CURRENT_TIMESTAMP,
      subtotal REAL NOT NULL,
      iva REAL DEFAULT 0,
      total REAL NOT NULL,
      medio_pago TEXT,
      numero_ticket TEXT UNIQUE,
      numero_factura TEXT,
      estado TEXT DEFAULT 'pendiente',
      observaciones TEXT,
      FOREIGN KEY (caja_id) REFERENCES cajas(id),
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (barbero_id) REFERENCES barberos(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (sucursal_id) REFERENCES sucursales(id)
    )`);

    // 12. Items de Venta
    db.run(`CREATE TABLE IF NOT EXISTS items_venta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad INTEGER NOT NULL,
      precio_unitario REAL NOT NULL,
      subtotal REAL NOT NULL,
      descuento REAL DEFAULT 0,
      FOREIGN KEY (venta_id) REFERENCES ventas(id),
      FOREIGN KEY (producto_id) REFERENCES productos(id)
    )`);

    // 13. Movimientos de Stock
    db.run(`CREATE TABLE IF NOT EXISTS movimientos_stock (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      sucursal_id INTEGER NOT NULL,
      tipo_movimiento TEXT,
      cantidad INTEGER,
      referencia_id INTEGER,
      referencia_tabla TEXT,
      observaciones TEXT,
      usuario_id INTEGER,
      fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (producto_id) REFERENCES productos(id),
      FOREIGN KEY (sucursal_id) REFERENCES sucursales(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS movimientos_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL,
      usuario_id INTEGER,
      tipo TEXT NOT NULL,
      categoria TEXT,
      monto REAL NOT NULL,
      descripcion TEXT,
      fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (caja_id) REFERENCES cajas(id),
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS ofertas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descuento INTEGER DEFAULT 0,
      fecha_inicio DATE,
      fecha_fin DATE,
      estado TEXT DEFAULT 'activa',
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Schema upgrade: add columns for next-day starting balance and admin transfer
    db.run(`ALTER TABLE cajas ADD COLUMN transferencia_admin REAL DEFAULT 0`, [], (err) => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('[WARN] No se pudo actualizar esquema de cajas (transferencia_admin):', err.message);
      }
    });
    db.run(`ALTER TABLE cajas ADD COLUMN saldo_inicial_siguiente REAL DEFAULT 0`, [], (err) => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('[WARN] No se pudo actualizar esquema de cajas (saldo_inicial_siguiente):', err.message);
      }
    });
    db.run(`ALTER TABLE ventas ADD COLUMN barbero_id INTEGER`, [], (err) => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('[WARN] No se pudo actualizar esquema de ventas (barbero_id):', err.message);
      }
    });

    // Schema upgrade: add puntos to productos
    db.run(`ALTER TABLE productos ADD COLUMN puntos INTEGER DEFAULT 0`, [], (err) => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('[WARN] No se pudo actualizar esquema de productos (puntos):', err.message);
      }
    });

    // Schema upgrade: add puntos_acumulados to clientes
    db.run(`ALTER TABLE clientes ADD COLUMN puntos_acumulados INTEGER DEFAULT 0`, [], (err) => {
      if (err && !/duplicate column/i.test(err.message)) {
        console.error('[WARN] No se pudo actualizar esquema de clientes (puntos_acumulados):', err.message);
      }
    });

    // Tabla de Movimientos de Puntos
    db.run(`CREATE TABLE IF NOT EXISTS movimientos_puntos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      puntos_cantidad INTEGER NOT NULL,
      puntos_nuevos INTEGER NOT NULL,
      descripcion TEXT,
      venta_id INTEGER,
      fecha_movimiento DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id),
      FOREIGN KEY (venta_id) REFERENCES ventas(id)
    )`);

    // Crear datos iniciales
    //crearDatosIniciales();
  });
}

function crearDatosIniciales() {
  // Usuarios
  db.get("SELECT id FROM usuarios WHERE usuario = 'admin'", [], (err, row) => {
    if (!row) {
      const passwordHash = bcrypt.hashSync('admin', 10);
      db.run(`INSERT INTO usuarios (usuario, email, password, nombre, rol)
        VALUES (?, ?, ?, ?, ?)`, 
        ['admin', 'admin@napolis-barber.com', passwordHash, 'Administrador', 'admin']);
      console.log('[OK] Usuario admin creado');
    }
  });

  ['vendedor1', 'vendedor2', 'gerente'].forEach(usr => {
    db.get("SELECT id FROM usuarios WHERE usuario = ?", [usr], (err, row) => {
      if (!row) {
        const passwordHash = bcrypt.hashSync('1234', 10);
        db.run(`INSERT INTO usuarios (usuario, email, password, nombre, rol)
          VALUES (?, ?, ?, ?, ?)`,
          [usr, `${usr}@napolis-barber.com`, passwordHash,
           usr.charAt(0).toUpperCase() + usr.slice(1),
           usr === 'gerente' ? 'gerente' : 'vendedor']);
      }
    });
  });

  // Sucursales
  const sucursales = [
    ['Centro', 'Avenida Principal 123', '011-2345-6789'],
    ['Shopping', 'Centro Comercial Sur 456', '011-3456-7890'],
    ['Zona Norte', 'Ruta 9 Km 35', '011-4567-8901']
  ];

  sucursales.forEach(([nombre, dir, tel]) => {
    db.get("SELECT id FROM sucursales WHERE nombre = ?", [nombre], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO sucursales (nombre, direccion, telefono) VALUES (?, ?, ?)`,
          [nombre, dir, tel]);
      }
    });
  });

  // Categorías
  const categorias = ['Higiene Personal', 'Limpieza', 'Desinfectantes', 'Papelería', 'Varios'];
  categorias.forEach(cat => {
    db.get("SELECT id FROM categorias WHERE nombre = ?", [cat], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO categorias (nombre) VALUES (?)`, [cat]);
      }
    });
  });

  // Marcas
  const marcas = ['Marca A', 'Marca B', 'Marca C', 'Marca D', 'Genérica'];
  marcas.forEach(marca => {
    db.get("SELECT id FROM marcas WHERE nombre = ?", [marca], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO marcas (nombre) VALUES (?)`, [marca]);
      }
    });
  });

  // Proveedores
  const proveedores = [
    ['Proveedor Limpio SA', '20-12345678-9', 'contacto@provlimpio.com', '011-1111-1111', 'Limpieza'],
    ['Distribuidora Premium', '20-98765432-1', 'info@distribprem.com', '011-2222-2222', 'Higiene'],
    ['Mayorista Nacional', '20-55555555-5', 'ventas@mayornac.com', '011-3333-3333', 'Papelería']
  ];

  proveedores.forEach(([nombre, cuit, email, tel, rubro]) => {
    db.get("SELECT id FROM proveedores WHERE nombre = ?", [nombre], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO proveedores (nombre, cuit, email, telefono, rubro)
          VALUES (?, ?, ?, ?, ?)`, [nombre, cuit, email, tel, rubro]);
      }
    });
  });

  // Clientes de prueba
  const clientes = [
    ['Juan', 'Pérez', 'juan@email.com', '011-1111-1111', 'DNI', '12345678'],
    ['María', 'García', 'maria@email.com', '011-2222-2222', 'DNI', '87654321'],
    ['Pedro', 'López', 'pedro@email.com', '011-3333-3333', 'DNI', '11111111']
  ];

  clientes.forEach(([nombre, apellido, email, tel, doc_tipo, doc_num]) => {
    db.get("SELECT id FROM clientes WHERE documento_numero = ?", [doc_num], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO clientes (nombre, apellido, email, telefono, documento_tipo, documento_numero)
          VALUES (?, ?, ?, ?, ?, ?)`, [nombre, apellido, email, tel, doc_tipo, doc_num]);
      }
    });
  });

  // Barberos de prueba
  // const barberos = [
  //   ['Carlos', 'Barbosa', 'carlos@email.com', '011-5555-5555', 'DNI', '11223344'],
  //   ['Diego', 'López', 'diego@email.com', '011-6666-6666', 'DNI', '55667788'],
  //   ['Fernando', 'García', 'fernando@email.com', '011-7777-7777', 'DNI', '99112233']
  // ];

/*
  function generarCodigoUnico() {
    return Math.floor(10000 + Math.random() * 90000).toString();
  }

  barberos.forEach(([nombre, apellido, email, tel, doc_tipo, doc_num]) => {
    db.get("SELECT id FROM barberos WHERE documento_numero = ?", [doc_num], (err, row) => {
      if (!row) {
        let codigo = generarCodigoUnico();
        // Asegurar unicidad
        const checkCodigo = (cb) => {
          db.get("SELECT id FROM barberos WHERE codigo_barbero = ?", [codigo], (err, row) => {
            if (row) {
              codigo = generarCodigoUnico();
              checkCodigo(cb);
            } else {
              cb();
            }
          });
        };
        checkCodigo(() => {
          db.run(`INSERT INTO barberos (nombre, apellido, email, telefono, documento_tipo, documento_numero, codigo_barbero)
            VALUES (?, ?, ?, ?, ?, ?, ?)`, [nombre, apellido, email, tel, doc_tipo, doc_num, codigo]);
        });
      }
    });
  });

  // Productos de prueba
  const productosEjemplo = [
    ['SKU001', 'Cloro Líquido 1L', 1, 1, 1, 300, 450, 10],
    ['SKU002', 'Detergente Polvo 500g', 2, 2, 1, 120, 200, 20],
    ['SKU003', 'Desinfectante Spray 500ml', 3, 3, 2, 250, 400, 15],
    ['SKU004', 'Papel Higiénico 4 Unidades', 4, 1, 3, 80, 150, 50],
    ['SKU005', 'Jabón Líquido Neutro 1L', 1, 2, 1, 200, 350, 12],
    ['SKU006', 'Alcohol 70% 1L', 3, 3, 2, 150, 250, 25],
    ['SKU007', 'Bolsas de Residuos 100u', 5, 1, 1, 50, 100, 100],
    ['SKU008', 'Escoba Clásica', 2, 4, 1, 200, 350, 8],
    ['SKU009', 'Trapo de Piso 50x50cm', 2, 1, 1, 40, 80, 30],
    ['SKU010', 'Lustrador de Pisos 1L', 2, 3, 2, 300, 500, 10]
  ];

  productosEjemplo.forEach(([sku, nombre, cat, marca, prov, costo, venta, minimo]) => {
    db.get("SELECT id FROM productos WHERE sku = ?", [sku], (err, row) => {
      if (!row) {
        db.run(`INSERT INTO productos (sku, nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta, minimo_stock)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
          [sku, nombre, cat, marca, prov, costo, venta, minimo]);
      }
    });
  });

  setTimeout(inicializarStockInicial, 800);
  console.log('[OK] Datos iniciales cargados');
}

function inicializarStockInicial() {
  db.all("SELECT id FROM productos", [], (err, productos) => {
    if (err || !productos?.length) return;
    db.all("SELECT id FROM sucursales WHERE activa = 1", [], (err2, sucursales) => {
      if (err2 || !sucursales?.length) return;
      productos.forEach((p) => {
        sucursales.forEach((s) => {
          const cantidad = Math.floor(Math.random() * 40) + 10;
          db.run(
            `INSERT OR IGNORE INTO stock_sucursal (producto_id, sucursal_id, cantidad) VALUES (?, ?, ?)`,
            [p.id, s.id, cantidad]
          );
        });
      });
      console.log('[OK] Stock inicial por sucursal');
    });
  });
*/  
}

// ===== MIDDLEWARE =====
app.use(bodyParser.json({
  limit: '50mb'
}));

app.use(bodyParser.urlencoded({
  extended: true,
  limit: '50mb'
}));

app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticación
async function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Sin autenticación' });

  try {
    const sesion = await dbGet(`
      SELECT s.*, u.usuario, u.rol, u.id as usuario_id, u.nombre
      FROM sesiones s
      JOIN usuarios u ON s.usuario_id = u.id
      WHERE s.token = ? AND s.expira_en > datetime('now')
    `, [token]);

    if (!sesion) return res.status(401).json({ error: 'Token inválido o expirado' });

    req.usuario = sesion;
    next();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// ===== RUTAS: AUTENTICACIÓN =====

app.post('/api/login', async (req, res) => {
  try {
    const { usuario, password } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }

    const user = await dbGet("SELECT * FROM usuarios WHERE usuario = ? AND activo = 1", [usuario]);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Usuario o contraseña inválidos' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expira_en = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await dbRun(
      "INSERT INTO sesiones (usuario_id, token, expira_en) VALUES (?, ?, ?)",
      [user.id, token, expira_en.toISOString()]
    );

    res.json({
      token,
      usuario: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        email: user.email,
        rol: user.rol
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/logout', verificarToken, async (req, res) => {
  try {
    const token = req.headers['authorization'].replace('Bearer ', '');
    await dbRun("DELETE FROM sesiones WHERE token = ?", [token]);
    res.json({ mensaje: 'Desconexión exitosa' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/me', verificarToken, (req, res) => {
  res.json({
    id: req.usuario.usuario_id,
    usuario: req.usuario.usuario,
    nombre: req.usuario.nombre,
    email: req.usuario.email,
    rol: req.usuario.rol
  });
});

// ===== RUTAS: PRODUCTOS =====

// GET /api/productos - Listar con búsqueda y filtros
app.get('/api/productos', verificarToken, async (req, res) => {
  try {
    const { buscar, categoria_id, marca_id, proveedor_id, limite = 100, offset = 0 } = req.query;
    
    let sql = `SELECT p.*, c.nombre as categoria, m.nombre as marca, pr.nombre as proveedor
               FROM productos p
               LEFT JOIN categorias c ON p.categoria_id = c.id
               LEFT JOIN marcas m ON p.marca_id = m.id
               LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
               WHERE p.activo = 1`;
    
    const params = [];

    if (buscar) {
      sql += ` AND (p.nombre LIKE ? OR p.sku LIKE ?)`;
      params.push(`%${buscar}%`, `%${buscar}%`);
    }
    if (categoria_id) {
      sql += ` AND p.categoria_id = ?`;
      params.push(categoria_id);
    }
    if (marca_id) {
      sql += ` AND p.marca_id = ?`;
      params.push(marca_id);
    }
    if (proveedor_id) {
      sql += ` AND p.proveedor_id = ?`;
      params.push(proveedor_id);
    }

    const columns = { id: 'p.id', sku: 'p.sku', nombre: 'p.nombre', marca: 'm.nombre', categoria: 'c.nombre', precio_venta: 'p.precio_venta', puntos: 'p.puntos' };
    const order = Object.hasOwn(columns, req.query.ordenar) ? columns[req.query.ordenar] : 'p.id';
    const direction = req.query.direccion === 'desc' ? 'DESC' : 'ASC';
    sql += ` ORDER BY ${order} COLLATE NOCASE ${direction}, p.id ASC LIMIT ? OFFSET ?`;
    params.push(limite, offset);

    const productos = await dbAll(sql, params);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/productos/:id - Obtener producto con stock por sucursal
app.get('/api/productos/:id', verificarToken, async (req, res) => {
  try {
    const producto = await dbGet(`
      SELECT p.*, c.nombre as categoria, m.nombre as marca, pr.nombre as proveedor
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN marcas m ON p.marca_id = m.id
      LEFT JOIN proveedores pr ON p.proveedor_id = pr.id
      WHERE p.id = ?
    `, [req.params.id]);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    // Obtener stock por sucursal
    const stocks = await dbAll(
      `SELECT s.nombre, ss.cantidad FROM stock_sucursal ss
       JOIN sucursales s ON ss.sucursal_id = s.id
       WHERE ss.producto_id = ?`,
      [req.params.id]
    );

    res.json({ ...producto, stocks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/productos - Crear producto
app.post('/api/productos', verificarToken, async (req, res) => {
  try {
    const { sku, nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta, minimo_stock } = req.body;

    if (!sku || !nombre || !precio_venta) {
      return res.status(400).json({ error: 'Campos requeridos: sku, nombre, precio_venta' });
    }

    const result = await dbRun(
      `INSERT INTO productos (sku, nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta, minimo_stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sku, nombre, categoria_id || null, marca_id || null, proveedor_id || null, precio_costo || 0, precio_venta, stockMinimum(req.body)]
    );

    // Crear stock inicial para cada sucursal
    const sucursales = await dbAll("SELECT id FROM sucursales WHERE activa = 1");
    for (const suc of sucursales) {
      await dbRun(
        "INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad) VALUES (?, ?, ?)",
        [result.id, suc.id, 0]
      );
    }

    res.json({ id: result.id, sku, nombre, mensaje: 'Producto creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/productos/:id - Actualizar producto
app.put('/api/productos/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta, minimo_stock, imagen_url } = req.body;

    const actualizables = [];
    const valores = [];

    if (nombre !== undefined) {
      actualizables.push('nombre = ?');
      valores.push(nombre);
    }
    if (categoria_id !== undefined) {
      actualizables.push('categoria_id = ?');
      valores.push(categoria_id);
    }
    if (marca_id !== undefined) {
      actualizables.push('marca_id = ?');
      valores.push(marca_id);
    }
    if (proveedor_id !== undefined) {
      actualizables.push('proveedor_id = ?');
      valores.push(proveedor_id);
    }
    if (precio_costo !== undefined) {
      actualizables.push('precio_costo = ?');
      valores.push(precio_costo);
    }
    if (precio_venta !== undefined) {
      actualizables.push('precio_venta = ?');
      valores.push(precio_venta);
    }
    if (minimo_stock !== undefined || req.body.es_servicio !== undefined) {
      actualizables.push('minimo_stock = ?');
      valores.push(stockMinimum(req.body));
    }
    if (imagen_url !== undefined) {
      actualizables.push('imagen_url = ?');
      valores.push(imagen_url);
    }
    if (req.body.puntos !== undefined) {
      actualizables.push('puntos = ?');
      valores.push(req.body.puntos);
    }

    if (actualizables.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    valores.push(req.params.id);
    await dbRun(`UPDATE productos SET ${actualizables.join(', ')} WHERE id = ?`, valores);

    res.json({ mensaje: 'Producto actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/productos/:id', verificarToken, async (req, res) => {
  try {
    await dbRun('UPDATE productos SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: CLIENTES =====

app.get('/api/clientes', verificarToken, async (req, res) => {
  try {
    const { buscar, limite = 50, offset = 0 } = req.query;
    let sql = "SELECT * FROM clientes WHERE activo = 1";
    const params = [];

    if (buscar) {
      sql += " AND (TRIM(nombre || ' ' || COALESCE(apellido, '')) LIKE ? OR telefono LIKE ? OR documento_numero LIKE ? OR email LIKE ?)";
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
    params.push(limite, offset);

    const clientes = await dbAll(sql, params);
    res.json(clientes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clientes', verificarToken, async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, documento_tipo, documento_numero, direccion, ciudad, provincia, codigo_postal, razon_social, cuit } = req.body;

    if (!nombre || !apellido || !telefono) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    const result = await dbRun(
      `INSERT INTO clientes (nombre, apellido, email, telefono, documento_tipo, documento_numero, direccion, ciudad, provincia, codigo_postal, razon_social, cuit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, email || null, telefono, documento_tipo || 'DNI', documento_numero || null, direccion || null, ciudad || null, provincia || null, codigo_postal || null, razon_social || null, cuit || null]
    );

    res.json({ id: result.id, mensaje: 'Cliente creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET detalle de cliente con historial de ventas
app.get('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    // Obtener datos del cliente
    const cliente = await dbGet('SELECT * FROM clientes WHERE id = ? AND activo = 1', [id]);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Obtener historial de ventas
    let sqlVentas = `
      SELECT 
        v.id, v.numero_ticket, v.fecha_venta, v.total, s.nombre as sucursal
      FROM ventas v
      LEFT JOIN sucursales s ON v.sucursal_id = s.id
      WHERE v.cliente_id = ?
    `;
    const paramsVentas = [id];

    if (fecha_inicio && fecha_fin) {
      sqlVentas += ` AND DATE(v.fecha_venta, '-3 hours') BETWEEN ? AND ?`;
      paramsVentas.push(fecha_inicio, fecha_fin);
    }

    sqlVentas += ` ORDER BY v.fecha_venta DESC`;

    const ventas = await dbAll(sqlVentas, paramsVentas);

    // Obtener items de cada venta
    for (let venta of ventas) {
      venta.items = await dbAll(
        `SELECT iv.id, iv.cantidad, iv.precio_unitario, p.nombre as producto_nombre, p.sku
         FROM items_venta iv
         JOIN productos p ON iv.producto_id = p.id
         WHERE iv.venta_id = ?`,
        [venta.id]
      );
    }

    // Obtener productos consumidos por el cliente
    let sqlProductos = `
      SELECT 
        p.id, p.sku, p.nombre,
        SUM(iv.cantidad) as cantidad_vendida,
        SUM(iv.cantidad * iv.precio_unitario) as total_gastado
      FROM items_venta iv
      JOIN productos p ON iv.producto_id = p.id
      JOIN ventas v ON iv.venta_id = v.id
      WHERE v.cliente_id = ?
    `;
    const paramsProductos = [id];

    if (fecha_inicio && fecha_fin) {
      sqlProductos += ` AND DATE(v.fecha_venta, '-3 hours') BETWEEN ? AND ?`;
      paramsProductos.push(fecha_inicio, fecha_fin);
    }

    sqlProductos += ` GROUP BY p.id ORDER BY total_gastado DESC`;

    const productos = await dbAll(sqlProductos, paramsProductos);

    // Obtener cantidad de visitas
    const visitasResult = await dbGet(
      `SELECT COUNT(DISTINCT DATE(fecha_venta)) as visitas FROM ventas WHERE cliente_id = ?`,
      [id]
    );

    cliente.visitas = visitasResult?.visitas || 0;

    res.json({
      cliente,
      ventas,
      productos
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT actualizar cliente
app.put('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, documento_tipo, documento_numero, direccion, ciudad, provincia, codigo_postal, razon_social, cuit } = req.body;

    if (!nombre || !apellido || !telefono) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    await dbRun(
      `UPDATE clientes 
       SET nombre = ?, apellido = ?, email = ?, telefono = ?, documento_tipo = ?, documento_numero = ?, 
           direccion = ?, ciudad = ?, provincia = ?, codigo_postal = ?, razon_social = ?, cuit = ?
       WHERE id = ?`,
      [nombre, apellido, email || null, telefono, documento_tipo || 'DNI', documento_numero || null, 
       direccion || null, ciudad || null, provincia || null, codigo_postal || null, razon_social || null, cuit || null, id]
    );

    res.json({ mensaje: 'Cliente actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE eliminar cliente (marcar como inactivo)
app.delete('/api/clientes/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const cliente = await dbGet('SELECT id FROM clientes WHERE id = ?', [id]);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    await dbRun('UPDATE clientes SET activo = 0 WHERE id = ?', [id]);

    res.json({ mensaje: 'Cliente eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ===== RUTAS: BARBEROS =====

// GET lista de barberos
app.get('/api/barberos', verificarToken, async (req, res) => {
  try {
    const { buscar, limite = 50, offset = 0 } = req.query;
    let sql = "SELECT * FROM barberos WHERE activo = 1";
    const params = [];

    if (buscar) {
      sql += " AND (nombre LIKE ? OR apellido LIKE ? OR documento_numero LIKE ? OR codigo_barbero LIKE ?)";
      params.push(`%${buscar}%`, `%${buscar}%`, `%${buscar}%`, `%${buscar}%`);
    }

    sql += ` ORDER BY id ASC LIMIT ? OFFSET ?`;
    params.push(limite, offset);

    const barberos = await dbAll(sql, params);
    res.json(barberos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST crear nuevo barbero
app.post('/api/barberos', verificarToken, async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, documento_tipo, documento_numero } = req.body;

    if (!nombre || !apellido || !telefono) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    // Generar código único de 5 dígitos
    let codigo = '';
    let codigoUnico = false;
    while (!codigoUnico) {
      codigo = Math.floor(10000 + Math.random() * 90000).toString();
      const existe = await dbGet('SELECT id FROM barberos WHERE codigo_barbero = ?', [codigo]);
      codigoUnico = !existe;
    }

    const result = await dbRun(
      `INSERT INTO barberos (nombre, apellido, email, telefono, documento_tipo, documento_numero, codigo_barbero)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nombre, apellido, email || null, telefono, documento_tipo || 'DNI', documento_numero || null, codigo]
    );

    res.json({ id: result.id, codigo_barbero: codigo, mensaje: 'Barbero creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET detalle de barbero con historial de ventas
app.get('/api/barberos/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    let { fecha_inicio, fecha_fin } = req.query;

    // Obtener datos del barbero
    const barbero = await dbGet('SELECT * FROM barberos WHERE id = ? AND activo = 1', [id]);
    if (!barbero) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    // Si no hay rango de fechas, usar el día actual
    if (!fecha_inicio || !fecha_fin) {
      const hoy = new Date();
      const hoyStr = hoy.toISOString().split('T')[0];
      fecha_inicio = hoyStr;
      fecha_fin = hoyStr;
    }

    // Obtener historial de ventas del rango especificado
    let sqlVentas = `
      SELECT 
        v.id, v.numero_ticket, v.fecha_venta, v.total, v.cliente_id,
        c.nombre as cliente_nombre, c.apellido as cliente_apellido,
        s.nombre as sucursal
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      LEFT JOIN sucursales s ON v.sucursal_id = s.id
      WHERE v.barbero_id = ? AND DATE(v.fecha_venta, '-3 hours') BETWEEN ? AND ?
      ORDER BY v.fecha_venta DESC
    `;
    const paramsVentas = [id, fecha_inicio, fecha_fin];

    const ventas = await dbAll(sqlVentas, paramsVentas);

    // Obtener items de cada venta
    for (let venta of ventas) {
      venta.items = await dbAll(
        `SELECT iv.id, iv.cantidad, iv.precio_unitario, p.nombre as producto_nombre, p.sku
         FROM items_venta iv
         JOIN productos p ON iv.producto_id = p.id
         WHERE iv.venta_id = ?`,
        [venta.id]
      );
    }

    // Calcular estadísticas del rango de fechas
    const stats = await dbGet(
      `SELECT 
        COUNT(DISTINCT v.id) as total_ventas,
        SUM(v.total) as total_acumulado
      FROM ventas v
      WHERE v.barbero_id = ? AND DATE(v.fecha_venta, '-3 hours') BETWEEN ? AND ?`,
      [id, fecha_inicio, fecha_fin]
    );

    // Calcular totales generales (todos los tiempos)
    const statsGenerales = await dbGet(
      `SELECT 
        COUNT(DISTINCT v.id) as total_ventas_gral,
        SUM(v.total) as total_acumulado_gral
      FROM ventas v
      WHERE v.barbero_id = ?`,
      [id]
    );

    res.json({
      barbero,
      ventas,
      stats: stats || { total_ventas: 0, total_acumulado: 0 },
      statsGenerales: statsGenerales || { total_ventas_gral: 0, total_acumulado_gral: 0 },
      fecha_inicio,
      fecha_fin
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT actualizar barbero
app.put('/api/barberos/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, apellido, email, telefono, documento_tipo, documento_numero } = req.body;

    if (!nombre || !apellido || !telefono) {
      return res.status(400).json({ error: 'Nombre, apellido y teléfono son requeridos' });
    }

    await dbRun(
      `UPDATE barberos 
       SET nombre = ?, apellido = ?, email = ?, telefono = ?, documento_tipo = ?, documento_numero = ?
       WHERE id = ?`,
      [nombre, apellido, email || null, telefono, documento_tipo || 'DNI', documento_numero || null, id]
    );

    res.json({ mensaje: 'Barbero actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE eliminar barbero (marcar como inactivo)
app.delete('/api/barberos/:id', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;

    const barbero = await dbGet('SELECT id FROM barberos WHERE id = ?', [id]);
    if (!barbero) {
      return res.status(404).json({ error: 'Barbero no encontrado' });
    }

    await dbRun('UPDATE barberos SET activo = 0 WHERE id = ?', [id]);

    res.json({ mensaje: 'Barbero eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ===== RUTAS: DATOS MAESTROS =====

app.get('/api/sucursales', verificarToken, async (req, res) => {
  try {
    const sucursales = await dbAll("SELECT * FROM sucursales WHERE activa = 1");
    res.json(sucursales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/categorias', verificarToken, async (req, res) => {
  try {
    const categorias = await dbAll("SELECT * FROM categorias");
    res.json(categorias);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/marcas', verificarToken, async (req, res) => {
  try {
    const marcas = await dbAll("SELECT * FROM marcas");
    res.json(marcas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/proveedores', verificarToken, async (req, res) => {
  try {
    const proveedores = await dbAll("SELECT * FROM proveedores WHERE activo = 1");
    res.json(proveedores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: DATOS MAESTROS (CRUD) =====

app.post('/api/categorias', verificarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const result = await dbRun('INSERT INTO categorias (nombre) VALUES (?)', [nombre.trim()]);
    res.json({ id: result.id, nombre: nombre.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categorias/:id', verificarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    await dbRun('UPDATE categorias SET nombre = ? WHERE id = ?', [nombre.trim(), req.params.id]);
    res.json({ mensaje: 'Categoría actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categorias/:id', verificarToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM categorias WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/marcas', verificarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const result = await dbRun('INSERT INTO marcas (nombre) VALUES (?)', [nombre.trim()]);
    res.json({ id: result.id, nombre: nombre.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/marcas/:id', verificarToken, async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    await dbRun('UPDATE marcas SET nombre = ? WHERE id = ?', [nombre.trim(), req.params.id]);
    res.json({ mensaje: 'Marca actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/marcas/:id', verificarToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM marcas WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Marca eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PROVEEDORES =====
app.post('/api/proveedores', verificarToken, async (req, res) => {
  try {
    const { nombre, contacto, email, telefono, direccion, ciudad } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const result = await dbRun(
      `INSERT INTO proveedores (nombre, contacto, email, telefono, direccion, ciudad)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [nombre.trim(), contacto || '', email || '', telefono || '', direccion || '', ciudad || '']
    );
    res.json({ id: result.id, nombre, mensaje: 'Proveedor creado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/proveedores/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, contacto, email, telefono, direccion, ciudad } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    await dbRun(
      `UPDATE proveedores SET nombre = ?, contacto = ?, email = ?, telefono = ?, direccion = ?, ciudad = ?
       WHERE id = ?`,
      [nombre.trim(), contacto || '', email || '', telefono || '', direccion || '', ciudad || '', req.params.id]
    );
    res.json({ mensaje: 'Proveedor actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/proveedores/:id', verificarToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM proveedores WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Proveedor eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/sucursales', verificarToken, async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const result = await dbRun(
      'INSERT INTO sucursales (nombre, direccion, telefono) VALUES (?, ?, ?)',
      [nombre.trim(), direccion || '', telefono || '']
    );
    res.json({ id: result.id, nombre: nombre.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/sucursales/:id', verificarToken, async (req, res) => {
  try {
    const { nombre, direccion, telefono } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    await dbRun(
      'UPDATE sucursales SET nombre = ?, direccion = ?, telefono = ? WHERE id = ?',
      [nombre.trim(), direccion || '', telefono || '', req.params.id]
    );
    res.json({ mensaje: 'Sucursal actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/sucursales/:id', verificarToken, async (req, res) => {
  try {
    await dbRun('UPDATE sucursales SET activa = 0 WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Sucursal desactivada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: STOCK =====

app.get('/api/stock/:producto_id/:sucursal_id', verificarToken, async (req, res) => {
  try {
    const stock = await dbGet(
      "SELECT cantidad FROM stock_sucursal WHERE producto_id = ? AND sucursal_id = ?",
      [req.params.producto_id, req.params.sucursal_id]
    );
    res.json({ cantidad: stock?.cantidad || 0 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/stock/:producto_id/:sucursal_id', verificarToken, async (req, res) => {
  try {
    const { cantidad, tipo_movimiento = 'ajuste' } = req.body;
    const producto = await dbGet('SELECT minimo_stock FROM productos WHERE id = ?', [req.params.producto_id]);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });
    if (isService(producto)) return res.status(400).json({ error: 'Los servicios no utilizan stock' });

    await dbRun(
      `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad, actualizado_en)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(producto_id, sucursal_id) DO UPDATE SET
         cantidad = excluded.cantidad,
         actualizado_en = datetime('now')`,
      [req.params.producto_id, req.params.sucursal_id, cantidad]
    );

    await dbRun(
      `INSERT INTO movimientos_stock (producto_id, sucursal_id, tipo_movimiento, cantidad, usuario_id)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.producto_id, req.params.sucursal_id, tipo_movimiento, cantidad, req.usuario.usuario_id]
    );

    res.json({ mensaje: 'Stock actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cajas/:caja_id/movimientos', verificarToken, async (req, res) => {
  try {
    const movimientos = await dbAll(
      `SELECT mc.*, u.usuario, u.nombre as usuario_nombre
       FROM movimientos_caja mc
       LEFT JOIN usuarios u ON mc.usuario_id = u.id
       WHERE mc.caja_id = ?
       ORDER BY mc.fecha_movimiento DESC`,
      [req.params.caja_id]
    );
    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cajas/:caja_id/movimientos', verificarToken, async (req, res) => {
  try {
    const { tipo, categoria, monto, descripcion } = req.body;
    if (!tipo || !monto || isNaN(Number(monto))) {
      return res.status(400).json({ error: 'Tipo y monto válidos son requeridos' });
    }
    const caja = await dbGet('SELECT id FROM cajas WHERE id = ?', [req.params.caja_id]);
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });

    const result = await dbRun(
      `INSERT INTO movimientos_caja (caja_id, usuario_id, tipo, categoria, monto, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.caja_id, req.usuario.usuario_id, tipo, categoria || '', monto, descripcion || '']
    );
    res.json({ id: result.id, mensaje: 'Movimiento registrado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cajas/:caja_id/resumen', verificarToken, async (req, res) => {
  try {
    const cajaId = req.params.caja_id;
    const ventasPorPago = await dbAll(
      `SELECT medio_pago, COALESCE(SUM(total),0) as total, COUNT(*) as cantidad
       FROM ventas
       WHERE caja_id = ? AND estado IN ('pagada','entregada','completada')
       GROUP BY medio_pago`,
      [cajaId]
    );
    const egresos = await dbGet(
      `SELECT COALESCE(SUM(monto),0) as total FROM movimientos_caja
       WHERE caja_id = ? AND tipo = 'egreso'`,
      [cajaId]
    );
    const ingresosMov = await dbGet(
      `SELECT COALESCE(SUM(monto),0) as total FROM movimientos_caja
       WHERE caja_id = ? AND tipo = 'ingreso'`,
      [cajaId]
    );
    const caja = await dbGet('SELECT * FROM cajas WHERE id = ?', [cajaId]);
    if (!caja) return res.status(404).json({ error: 'Caja no encontrada' });

    const resumen = {
      caja_id: cajaId,
      monto_inicial: caja.monto_inicial || 0,
      total_ventas: ventasPorPago.reduce((sum, r) => sum + r.total, 0),
      pagos: ventasPorPago.reduce((acc, r) => ({ ...acc, [r.medio_pago || 'otros']: Number(r.total) }), {}),
      total_egresos: egresos.total || 0,
      total_ingresos_movimientos: ingresosMov.total || 0,
      expected_cash: (caja.monto_inicial || 0) + (ventasPorPago.find(r => r.medio_pago === 'efectivo')?.total || 0) - (egresos.total || 0)
    };
    res.json(resumen);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: CAJAS =====

app.get('/api/cajas', verificarToken, async (req, res) => {
  try {
    const filtro = req.query.filtro || 'todas';
    let sql = `
      SELECT c.*, s.nombre as sucursal_nombre, u.nombre as usuario_nombre
      FROM cajas c
      JOIN sucursales s ON c.sucursal_id = s.id
      JOIN usuarios u ON c.usuario_id = u.id
    `;
    if (filtro === 'hoy') {
      sql += " WHERE DATE(c.fecha_apertura) = DATE('now')";
    } else if (filtro === 'abierta') {
      sql += " WHERE c.estado = 'abierta'";
    }
    sql += " ORDER BY c.fecha_apertura DESC";
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cajas/actual', verificarToken, async (req, res) => {
  try {
    const caja = await dbGet(
      `SELECT c.*, s.nombre as sucursal_nombre
       FROM cajas c
       JOIN sucursales s ON c.sucursal_id = s.id
       WHERE c.usuario_id = ? AND c.estado = 'abierta'
       ORDER BY c.fecha_apertura DESC LIMIT 1`,
      [req.usuario.usuario_id]
    );

    if (!caja) {
      return res.status(404).json({ error: 'No hay caja abierta' });
    }

    res.json(caja);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cajas/abrir', verificarToken, async (req, res) => {
  try {
    const { sucursal_id, monto_inicial } = req.body;

    if (!sucursal_id) {
      return res.status(400).json({ error: 'sucursal_id requerido' });
    }

    const caja_abierta = await dbGet(
      "SELECT id FROM cajas WHERE usuario_id = ? AND sucursal_id = ? AND estado = 'abierta' AND DATE(fecha_apertura) = DATE('now')",
      [req.usuario.usuario_id, sucursal_id]
    );

    if (caja_abierta) {
      return res.status(400).json({ error: 'Ya hay una caja abierta para esta sucursal hoy' });
    }

    // Buscar el último cierre anterior para obtener el monto_en_caja que será el monto_inicial de la nueva caja
    let monto_inicial_final = monto_inicial || 0;
    const cierre_anterior = await dbGet(
      `SELECT monto_en_caja, monto_retirado, transferencia_admin, saldo_inicial_siguiente
       FROM cajas 
       WHERE sucursal_id = ? AND estado = 'cerrada' AND usuario_id = ?
       ORDER BY fecha_cierre DESC LIMIT 1`,
      [sucursal_id, req.usuario.usuario_id]
    );

    if (cierre_anterior) {
      // saldo_inicial_siguiente is the amount explicitly set by the user at close time; ?? respects 0
      monto_inicial_final = cierre_anterior.saldo_inicial_siguiente ?? cierre_anterior.monto_en_caja ?? monto_inicial ?? 0;
    }

    const result = await dbRun(
      "INSERT INTO cajas (usuario_id, sucursal_id, monto_inicial, estado) VALUES (?, ?, ?, 'abierta')",
      [req.usuario.usuario_id, sucursal_id, monto_inicial_final]
    );

    res.json({ 
      caja_id: result.id, 
      monto_inicial: monto_inicial_final,
      monto_anterior: cierre_anterior?.monto_en_caja || 0,
      saldo_anterior: cierre_anterior?.saldo_inicial_siguiente || 0,
      mensaje: 'Caja abierta' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cajas/monto-sugerido', verificarToken, async (req, res) => {
  try {
    const sucursal_id = req.query.sucursal_id || 1; // Por defecto sucursal 1
    const cierre_anterior = await dbGet(
      `SELECT monto_en_caja, saldo_inicial_siguiente
       FROM cajas 
       WHERE sucursal_id = ? AND estado = 'cerrada'
       ORDER BY fecha_cierre DESC LIMIT 1`,
      [sucursal_id]
    );
    
    const monto_anterior = cierre_anterior?.saldo_inicial_siguiente ?? cierre_anterior?.monto_en_caja ?? 0;
    res.json({ 
      monto_anterior,
      ultimo_cierre: cierre_anterior || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.post('/api/cajas/cerrar', verificarToken, async (req, res) => {
  try {
    const { caja_id, monto_retirado, monto_en_caja, transferencia_admin = 0, saldo_inicial_siguiente = 0, observaciones = '' } = req.body;

    if (!caja_id || monto_retirado === undefined || monto_en_caja === undefined) {
      return res.status(400).json({ error: 'caja_id, monto_retirado y monto_en_caja requeridos' });
    }

    const caja = await dbGet('SELECT * FROM cajas WHERE id = ?', [caja_id]);
    if (!caja) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }

    const ventas = await dbGet(
      `SELECT COALESCE(SUM(total), 0) as total,
              SUM(CASE WHEN medio_pago = 'efectivo' THEN total ELSE 0 END) as efectivo,
              SUM(CASE WHEN medio_pago = 'tarjeta' THEN total ELSE 0 END) as tarjeta,
              SUM(CASE WHEN medio_pago = 'transferencia' THEN total ELSE 0 END) as transferencia
       FROM ventas
       WHERE caja_id = ? AND estado IN ('pagada', 'entregada', 'completada')`,
      [caja_id]
    );

    const monto_final_esperado = (caja.monto_inicial || 0) + (ventas.total || 0);
    const diferencia = (monto_retirado + monto_en_caja + Number(transferencia_admin || 0) - monto_final_esperado);

    await dbRun(
      `UPDATE cajas SET estado = 'cerrada', fecha_cierre = datetime('now'),
       monto_final_esperado = ?, monto_retirado = ?, monto_en_caja = ?, transferencia_admin = ?, saldo_inicial_siguiente = ?, diferencia = ?, observaciones = ?
       WHERE id = ?`,
      [monto_final_esperado, monto_retirado, monto_en_caja, transferencia_admin || 0, saldo_inicial_siguiente || 0, diferencia, observaciones || '', caja_id]
    );

    if (transferencia_admin && Number(transferencia_admin) > 0) {
      await dbRun(
        `INSERT INTO movimientos_caja (caja_id, usuario_id, tipo, categoria, monto, descripcion)
         VALUES (?, ?, 'transferencia', 'administrador', ?, ?)`,
        [caja_id, req.usuario.usuario_id, transferencia_admin, 'Transferencia a caja admin']
      );
    }

    const saldo_final_real = (monto_retirado || 0) + (monto_en_caja || 0) + Number(transferencia_admin || 0);
    res.json({
      mensaje: 'Caja cerrada',
      monto_esperado: monto_final_esperado,
      monto_real: saldo_final_real,
      diferencia,
      estado: diferencia === 0 ? 'OK' : (diferencia > 0 ? 'SOBRANTE' : 'FALTANTE'),
      efectivo: ventas.efectivo || 0,
      tarjeta: ventas.tarjeta || 0,
      transferencia: ventas.transferencia || 0,
      transferencia_admin: transferencia_admin || 0,
      saldo_inicial_siguiente: saldo_inicial_siguiente || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cajas/:caja_id', verificarToken, async (req, res) => {
  try {
    const caja = await dbGet("SELECT * FROM cajas WHERE id = ?", [req.params.caja_id]);
    if (!caja) {
      return res.status(404).json({ error: 'Caja no encontrada' });
    }
    res.json(caja);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: VENTAS =====

app.get('/api/ventas', verificarToken, async (req, res) => {
  try {
    const { limite = 100, offset = 0, fecha_inicio, fecha_fin } = req.query;
    let sql = `
      SELECT v.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido, u.nombre as usuario_nombre, s.nombre as sucursal_nombre,
             b.nombre as barbero_nombre, b.apellido as barbero_apellido, b.codigo_barbero
      FROM ventas v
      LEFT JOIN clientes c ON v.cliente_id = c.id
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN sucursales s ON v.sucursal_id = s.id
      LEFT JOIN barberos b ON v.barbero_id = b.id
      WHERE 1 = 1
    `;
    const params = [];

    if (fecha_inicio) {
      sql += " AND DATE(v.fecha_venta, '-3 hours') >= DATE(?)";
      params.push(fecha_inicio);
    }

    if (fecha_fin) {
      sql += " AND DATE(v.fecha_venta, '-3 hours') <= DATE(?)";
      params.push(fecha_fin);
    }

    if (req.query.tipo === 'presupuesto') {
      sql += " AND (v.medio_pago = 'presupuesto' OR v.numero_ticket LIKE 'PRE-%')";
    } else if (req.query.tipo === 'venta') {
      sql += " AND v.medio_pago != 'presupuesto'";
    }

    sql += " ORDER BY v.fecha_venta DESC, v.id DESC LIMIT ? OFFSET ?";
    params.push(Number(limite), Number(offset));

    res.json(await dbAll(sql, params));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ventas', verificarToken, async (req, res) => {
  try {
    const { caja_id, cliente_id, barbero_id, sucursal_id, items, medio_pago = 'efectivo', estado = 'pendiente', subtotal, iva, total } = req.body;

    if (!caja_id || !sucursal_id || !items || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    // Usar los valores enviados por el cliente (que ya tienen IVA correctamente calculado o no aplicado)
    const finalSubtotal = subtotal || 0;
    const finalIVA = iva || 0;
    const finalTotal = total || finalSubtotal + finalIVA;

    // Crear venta
    const ticket = `TKT-${Date.now()}`;
    const result = await dbRun(
      `INSERT INTO ventas (caja_id, cliente_id, barbero_id, usuario_id, sucursal_id, subtotal, iva, total, medio_pago, estado, numero_ticket)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [caja_id, cliente_id || null, barbero_id || null, req.usuario.usuario_id, sucursal_id, finalSubtotal, finalIVA, finalTotal, medio_pago, estado, ticket]
    );

    const venta_id = result.id;

    // Crear items y actualizar stock
    let totalPuntos = 0;
    for (const item of items) {
      await dbRun(
        `INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [venta_id, item.producto_id, item.cantidad, item.precio_unitario, item.precio_unitario * item.cantidad]
      );

      // Obtener puntos del producto
      const producto = await dbGet("SELECT puntos, minimo_stock FROM productos WHERE id = ?", [item.producto_id]);
      if (producto && producto.puntos > 0) {
        totalPuntos += producto.puntos * item.cantidad;
      }

      if (estado === 'pagada' && producto && !isService(producto)) {
        await dbRun(
          `INSERT INTO stock_sucursal (producto_id, sucursal_id, cantidad, actualizado_en)
           VALUES (?, ?, 0, datetime('now'))
           ON CONFLICT(producto_id, sucursal_id) DO NOTHING`,
          [item.producto_id, sucursal_id]
        );

        const stock = await dbGet(
          "SELECT cantidad FROM stock_sucursal WHERE producto_id = ? AND sucursal_id = ?",
          [item.producto_id, sucursal_id]
        );

        const nueva_cantidad = (stock?.cantidad || 0) - item.cantidad;
        await dbRun(
          "UPDATE stock_sucursal SET cantidad = ? WHERE producto_id = ? AND sucursal_id = ?",
          [nueva_cantidad, item.producto_id, sucursal_id]
        );

        await dbRun(
          `INSERT INTO movimientos_stock (producto_id, sucursal_id, tipo_movimiento, cantidad, usuario_id)
           VALUES (?, ?, 'venta', ?, ?)`,
          [item.producto_id, sucursal_id, -item.cantidad, req.usuario.usuario_id]
        );
      }
    }

    // Sumar puntos al cliente si existe
    if (cliente_id && totalPuntos > 0) {
      const cliente = await dbGet("SELECT puntos_acumulados FROM clientes WHERE id = ?", [cliente_id]);
      const puntosNuevos = (cliente?.puntos_acumulados || 0) + totalPuntos;
      
      await dbRun("UPDATE clientes SET puntos_acumulados = ? WHERE id = ?", [puntosNuevos, cliente_id]);
      
      // Registrar movimiento de puntos
      await dbRun(
        `INSERT INTO movimientos_puntos (cliente_id, tipo, puntos_cantidad, puntos_nuevos, descripcion, venta_id)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [cliente_id, 'suma', totalPuntos, puntosNuevos, 'Puntos por compra', venta_id]
      );
    }

    res.json({ venta_id, numero_ticket: ticket, total: finalTotal, mensaje: 'Venta creada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/caja/:caja_id', verificarToken, async (req, res) => {
  try {
    const ventas = await dbAll(
      `SELECT v.id, v.caja_id, v.cliente_id, v.barbero_id, v.usuario_id, v.sucursal_id,
              v.fecha_venta, v.subtotal, v.iva, v.total, v.medio_pago, v.numero_ticket,
              v.numero_factura, v.estado, v.observaciones,
              c.nombre as cliente_nombre, c.apellido as cliente_apellido,
              u.nombre as usuario_nombre,
              b.nombre as barbero_nombre, b.apellido as barbero_apellido, b.codigo_barbero
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       LEFT JOIN usuarios u ON v.usuario_id = u.id
       LEFT JOIN barberos b ON v.barbero_id = b.id
       WHERE v.caja_id = ?
       ORDER BY v.fecha_venta DESC`,
      [req.params.caja_id]
    );
    res.json(ventas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET barberos activos del día por caja
app.get('/api/cajas/:caja_id/barberos-dia', verificarToken, async (req, res) => {
  try {
    const cajaId = req.params.caja_id;

    // Obtener barberos activos (con al menos una venta en la caja actual)
    const barberosDia = await dbAll(
      `SELECT 
        b.id, b.nombre, b.apellido, b.codigo_barbero,
        COUNT(DISTINCT v.id) as total_ventas,
        COALESCE(SUM(iv_agg.total_items), 0) as total_productos,
        SUM(v.total) as total_acumulado,
        COUNT(DISTINCT v.cliente_id) as clientes_distintos
      FROM barberos b
      JOIN ventas v ON b.id = v.barbero_id
      LEFT JOIN (
        SELECT venta_id, SUM(cantidad) as total_items
        FROM items_venta
        GROUP BY venta_id
      ) iv_agg ON v.id = iv_agg.venta_id
      WHERE v.caja_id = ?
      GROUP BY b.id
      ORDER BY total_acumulado DESC`,
      [cajaId]
    );

    res.json(barberosDia);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/ventas/:id', verificarToken, async (req, res) => {
  try {
    const venta = await dbGet(
      `SELECT v.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido,
              u.nombre as usuario_nombre, s.nombre as sucursal_nombre
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       JOIN usuarios u ON v.usuario_id = u.id
       JOIN sucursales s ON v.sucursal_id = s.id
       WHERE v.id = ?`,
      [req.params.id]
    );
    if (!venta) return res.status(404).json({ error: 'Venta no encontrada' });

    const items = await dbAll(
      `SELECT iv.*, p.nombre as producto_nombre, p.sku
       FROM items_venta iv
       JOIN productos p ON iv.producto_id = p.id
       WHERE iv.venta_id = ?`,
      [req.params.id]
    );
    res.json({ ...venta, items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/ventas/:id/estado', verificarToken, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!estado) return res.status(400).json({ error: 'Estado requerido' });
    await dbRun('UPDATE ventas SET estado = ? WHERE id = ?', [estado, req.params.id]);
    res.json({ mensaje: 'Estado actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: UPLOAD DE IMÁGENES =====
app.post('/api/upload/imagen', verificarToken, upload.single('imagen'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No se subió imagen' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ url: imageUrl, filename: req.file.filename });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== RUTAS: IMPORTAR EXCEL =====
function valorFilaImport(fila, ...claves) {
  const mapa = {};
  for (const [k, v] of Object.entries(fila || {})) {
    mapa[k.toLowerCase().trim()] = v;
  }
  for (const c of claves) {
    const val = mapa[c.toLowerCase()];
    if (val !== undefined && val !== null && String(val).trim() !== '') return val;
  }
  return '';
}

function redondearPrecio(val) {
  const n = parseFloat(String(val ?? '').replace(',', '.'));
  if (Number.isNaN(n)) return 0;
  return Math.round(n);
}

function generarSkuDesdeNombre(nombre, idx) {
  const base = String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toUpperCase()
    .slice(0, 24);
  return base ? `${base}-${idx + 1}` : `PROD-${idx + 1}`;
}

async function skuUnico(skuBase, idx) {
  let sku = skuBase;
  let intento = 0;
  while (intento < 50) {
    const existe = await dbGet('SELECT id FROM productos WHERE sku = ?', [sku]);
    if (!existe) return sku;
    intento++;
    sku = `${skuBase}-${intento}`;
  }
  return `${skuBase}-${Date.now()}`;
}

async function obtenerOCrearPorNombre(tabla, nombre) {
  if (!nombre) return null;
  const row = await dbGet(`SELECT id FROM ${tabla} WHERE nombre = ?`, [nombre]);
  if (row) return row.id;
  const result = await dbRun(`INSERT INTO ${tabla} (nombre) VALUES (?)`, [nombre]);
  return result.id;
}

async function importarFilaProducto(fila, idx) {
  const nombre = String(valorFilaImport(fila, 'Nombre', 'nombre', 'NOMBRE', 'Producto', 'producto')).trim();
  if (!nombre) {
    throw new Error('Nombre es requerido');
  }

  let sku = String(valorFilaImport(fila, 'SKU', 'sku', 'Código', 'codigo', 'Codigo')).trim();
  if (!sku) {
    sku = await skuUnico(generarSkuDesdeNombre(nombre, idx), idx);
  }

  const categoria = String(valorFilaImport(fila, 'Categoría', 'Categoria', 'categoria', 'Tipo', 'tipo')).trim();
  const marca = String(valorFilaImport(fila, 'Marca', 'marca', 'MARCA')).trim();
  const proveedor = String(valorFilaImport(fila, 'Proveedor', 'proveedor', 'PROVEEDOR')).trim();
  const precio_venta = redondearPrecio(valorFilaImport(
    fila, 'Precio Venta', 'precio_venta', 'Precio', 'precio', 'PVP', 'Precio Venta Minorista'
  ));
  const precio_costo = redondearPrecio(valorFilaImport(
    fila, 'Precio Costo', 'precio_costo', 'Costo', 'costo', 'Precio Compra'
  ));

  const categoria_id = await obtenerOCrearPorNombre('categorias', categoria);
  const marca_id = await obtenerOCrearPorNombre('marcas', marca);
  const proveedor_id = await obtenerOCrearPorNombre('proveedores', proveedor);

  const existente = await dbGet('SELECT id FROM productos WHERE sku = ?', [sku]);
  if (existente) {
    await dbRun(
      `UPDATE productos SET nombre = ?, categoria_id = ?, marca_id = ?, proveedor_id = ?,
       precio_costo = ?, precio_venta = ? WHERE sku = ?`,
      [nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta, sku]
    );
  } else {
    const result = await dbRun(
      `INSERT INTO productos (sku, nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku, nombre, categoria_id, marca_id, proveedor_id, precio_costo, precio_venta || 0]
    );
    const sucursales = await dbAll('SELECT id FROM sucursales WHERE activa = 1');
    for (const suc of sucursales) {
      await dbRun(
        'INSERT OR IGNORE INTO stock_sucursal (producto_id, sucursal_id, cantidad) VALUES (?, ?, 0)',
        [result.id, suc.id]
      );
    }
  }
}

app.post('/api/import/productos', verificarToken, async (req, res) => {
  try {
    const datos = req.body?.datos || req.body?.productos;

    if (!Array.isArray(datos) || datos.length === 0) {
      return res.status(400).json({
        error: 'No hay datos para importar. El Excel debe tener al menos la columna Nombre con filas válidas.'
      });
    }

    let importados = 0;
    const errores = [];

    for (let idx = 0; idx < datos.length; idx++) {
      try {
        await importarFilaProducto(datos[idx], idx);
        importados++;
      } catch (e) {
        errores.push(`Fila ${idx + 1}: ${e.message}`);
      }
    }

    res.json({
      importados,
      errores,
      mensaje: `Se importaron ${importados} productos`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/import/inventario-doc', verificarToken, async (req, res) => {
  try {
    const inventarioPath = path.join(__dirname, 'assets', 'docs', 'Inventario.xlsx');
    if (!fs.existsSync(inventarioPath)) {
      return res.status(404).json({
        error: 'No se encontró el archivo assets/docs/Inventario.xlsx. Colocá el Excel en esa ruta.'
      });
    }

    let XLSX;
    try {
      XLSX = require('xlsx');
    } catch {
      return res.status(500).json({
        error: 'Falta el paquete xlsx en el servidor. Ejecutá: npm install xlsx'
      });
    }

    const workbook = XLSX.readFile(inventarioPath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const datos = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!datos.length) {
      return res.status(400).json({ error: 'El archivo Inventario.xlsx está vacío' });
    }

    let importados = 0;
    const errores = [];

    for (let idx = 0; idx < datos.length; idx++) {
      try {
        await importarFilaProducto(datos[idx], idx);
        importados++;
      } catch (e) {
        errores.push(`Fila ${idx + 1}: ${e.message}`);
      }
    }

    res.json({
      importados,
      errores,
      mensaje: `Inventario.xlsx: ${importados} productos importados`,
      total_filas: datos.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ENDPOINTS PRESUPUESTOS Y FACTURAS =====
app.get('/api/presupuestos', verificarToken, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT v.*, c.nombre as cliente_nombre, c.apellido as cliente_apellido
       FROM ventas v
       LEFT JOIN clientes c ON v.cliente_id = c.id
       WHERE v.medio_pago = 'presupuesto' OR v.numero_ticket LIKE 'PRE-%'
       ORDER BY v.fecha_venta DESC LIMIT 100`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/presupuestos', verificarToken, async (req, res) => {
  try {
    const { cliente_id, items = [], descuento = 0, sucursal_id } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items requeridos' });
    }

    const caja = await dbGet(
      "SELECT * FROM cajas WHERE usuario_id = ? AND estado = 'abierta' ORDER BY fecha_apertura DESC LIMIT 1",
      [req.usuario.usuario_id]
    );
    const sucursal = sucursal_id || caja?.sucursal_id || (await dbGet("SELECT id FROM sucursales WHERE activa = 1 ORDER BY id LIMIT 1"))?.id;
    if (!sucursal) {
      return res.status(400).json({ error: 'No hay sucursal disponible' });
    }

    const subtotal = items.reduce((s, i) => s + ((i.precio || i.precio_unitario || 0) * (i.cantidad || 0)), 0);
    const total = subtotal * (1 - descuento / 100);
    const ticket = `PRE-${Date.now()}`;
    const result = await dbRun(
      `INSERT INTO ventas (caja_id, cliente_id, usuario_id, sucursal_id, subtotal, iva, total, medio_pago, estado, numero_ticket)
       VALUES (?, ?, ?, ?, ?, 0, ?, 'presupuesto', 'pendiente', ?)`,
      [caja?.id || 1, cliente_id || null, req.usuario.usuario_id, sucursal, subtotal, total, ticket]
    );

    for (const item of items) {
      const precio = item.precio || item.precio_unitario || 0;
      const cantidad = item.cantidad || 0;
      await dbRun(
        `INSERT INTO items_venta (venta_id, producto_id, cantidad, precio_unitario, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [result.id, item.producto_id, cantidad, precio, precio * cantidad]
      );
    }

    res.json({ id: result.id, numero_ticket: ticket, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ENDPOINTS REPORTES =====
app.get('/api/reportes/ventas', verificarToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const rows = await dbAll(
      `SELECT * FROM ventas WHERE DATE(fecha_venta, '-3 hours') BETWEEN DATE(?) AND DATE(?)
       AND medio_pago != 'presupuesto' ORDER BY fecha_venta DESC`,
      [fecha_inicio || '2026-01-01', fecha_fin || '2026-12-31']
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/productos', verificarToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const rows = await dbAll(
      `SELECT p.id, p.sku, p.nombre, SUM(iv.cantidad) as cantidad_vendida,
              SUM(iv.subtotal) as total_facturado
       FROM items_venta iv
       JOIN productos p ON iv.producto_id = p.id
       JOIN ventas v ON iv.venta_id = v.id
       WHERE DATE(v.fecha_venta, '-3 hours') BETWEEN DATE(?) AND DATE(?)
         AND v.estado IN ('pagada', 'entregada', 'completada')
       GROUP BY p.id
       ORDER BY cantidad_vendida DESC
       `,
      [fecha_inicio || '2026-01-01', fecha_fin || '2026-12-31']
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/clientes', verificarToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const rows = await dbAll(
      `SELECT c.id, c.nombre, c.apellido, COUNT(v.id) as compras, SUM(v.total) as total_gastado
       FROM ventas v
       JOIN clientes c ON v.cliente_id = c.id
       WHERE DATE(v.fecha_venta, '-3 hours') BETWEEN DATE(?) AND DATE(?)
         AND v.estado IN ('pagada', 'entregada', 'completada')
       GROUP BY c.id
       ORDER BY total_gastado DESC
       `,
      [fecha_inicio || '2026-01-01', fecha_fin || '2026-12-31']
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/barberos', verificarToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    const fi = fecha_inicio || '2026-01-01';
    const ff = fecha_fin || '2026-12-31';

    // All active barbers
    const barberos = await dbAll(`SELECT id, nombre, apellido, codigo_barbero FROM barberos WHERE activo = 1 ORDER BY nombre`);

    const result = [];
    for (const bar of barberos) {
      const stats = await dbGet(
        `SELECT COUNT(DISTINCT v.id) as total_ventas, COALESCE(SUM(v.total),0) as total_acumulado
         FROM ventas v
         WHERE v.barbero_id = ? AND DATE(v.fecha_venta, '-3 hours') BETWEEN DATE(?) AND DATE(?)
           AND v.estado IN ('pagada','entregada','completada','pendiente')`,
        [bar.id, fi, ff]
      );

      const items = await dbAll(
        `SELECT p.nombre as producto_nombre, p.sku, SUM(iv.cantidad) as cantidad, SUM(iv.subtotal) as subtotal
         FROM items_venta iv
         JOIN ventas v ON iv.venta_id = v.id
         JOIN productos p ON iv.producto_id = p.id
         WHERE v.barbero_id = ? AND DATE(v.fecha_venta, '-3 hours') BETWEEN DATE(?) AND DATE(?)
           AND v.estado IN ('pagada','entregada','completada','pendiente')
         GROUP BY p.id
         ORDER BY cantidad DESC`,
        [bar.id, fi, ff]
      );

      result.push({
        ...bar,
        total_ventas: stats.total_ventas || 0,
        total_acumulado: stats.total_acumulado || 0,
        items
      });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/reportes/stock-bajo', verificarToken, async (req, res) => {
  try {
    const rows = await dbAll(
      `SELECT p.id, p.sku, p.nombre, p.minimo_stock,
              COALESCE(SUM(ss.cantidad), 0) as stock_total
       FROM productos p
       LEFT JOIN stock_sucursal ss ON p.id = ss.producto_id
       WHERE p.activo = 1 AND p.minimo_stock IS NOT NULL AND p.minimo_stock >= 0
       GROUP BY p.id
       HAVING stock_total <= p.minimo_stock
       ORDER BY stock_total ASC
       LIMIT 20`
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ENDPOINTS OFERTAS =====
app.get('/api/ofertas', verificarToken, async (req, res) => {
  try {
    const sql = `SELECT * FROM ofertas ORDER BY fecha_creacion DESC LIMIT 50`;
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ofertas', verificarToken, async (req, res) => {
  try {
    const { nombre, descuento, fecha_inicio, fecha_fin } = req.body;
    const sql = `INSERT INTO ofertas (nombre, descuento, fecha_inicio, fecha_fin, estado) VALUES (?, ?, ?, ?, 'activa')`;
    db.run(sql, [nombre, descuento, fecha_inicio, fecha_fin], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, nombre, descuento });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/ofertas/:id', verificarToken, async (req, res) => {
  try {
    await dbRun('DELETE FROM ofertas WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Oferta eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ENDPOINT USUARIOS =====
app.get('/api/usuarios', verificarToken, async (req, res) => {
  try {
    const sql = `SELECT id, usuario, nombre, rol, email FROM usuarios WHERE activo = 1 ORDER BY usuario`;
    db.all(sql, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/usuarios', verificarToken, async (req, res) => {
  try {
    const { usuario, password, email, nombre, rol = 'vendedor' } = req.body;
    if (!usuario || !password) {
      return res.status(400).json({ error: 'Usuario y contraseña requeridos' });
    }
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await dbRun(
      `INSERT INTO usuarios (usuario, email, password, nombre, rol) VALUES (?, ?, ?, ?, ?)`,
      [usuario.trim(), email || '', passwordHash, nombre || usuario.trim(), rol]
    );
    res.json({ id: result.id, usuario: usuario.trim() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/usuarios/:id', verificarToken, async (req, res) => {
  try {
    const { email, nombre, rol, password } = req.body;
    const actualizables = [];
    const valores = [];

    if (email !== undefined) { actualizables.push('email = ?'); valores.push(email); }
    if (nombre !== undefined) { actualizables.push('nombre = ?'); valores.push(nombre); }
    if (rol !== undefined) { actualizables.push('rol = ?'); valores.push(rol); }
    if (password) {
      actualizables.push('password = ?');
      valores.push(bcrypt.hashSync(password, 10));
    }

    if (actualizables.length === 0) {
      return res.status(400).json({ error: 'Nada que actualizar' });
    }

    valores.push(req.params.id);
    await dbRun(`UPDATE usuarios SET ${actualizables.join(', ')} WHERE id = ?`, valores);
    res.json({ mensaje: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/usuarios/:id', verificarToken, async (req, res) => {
  try {
    if (Number(req.params.id) === Number(req.usuario.usuario_id)) {
      return res.status(400).json({ error: 'No puedes eliminar tu propio usuario' });
    }
    await dbRun('UPDATE usuarios SET activo = 0 WHERE id = ?', [req.params.id]);
    res.json({ mensaje: 'Usuario desactivado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/me/password', verificarToken, async (req, res) => {
  try {
    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: 'Contraseñas requeridas' });
    }
    const user = await dbGet('SELECT * FROM usuarios WHERE id = ?', [req.usuario.usuario_id]);
    if (!user || !bcrypt.compareSync(password_actual, user.password)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }
    const hash = bcrypt.hashSync(password_nueva, 10);
    await dbRun('UPDATE usuarios SET password = ? WHERE id = ?', [hash, user.id]);
    res.json({ mensaje: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

let backupInProgress = false;
app.get('/api/backup', verificarToken, async (req, res) => {
  if (!['admin', 'administrador'].includes(String(req.usuario.rol).toLowerCase())) {
    return res.status(403).json({ error: 'Solo un administrador puede descargar el respaldo completo' });
  }
  if (backupInProgress) return res.status(409).json({ error: 'Ya se está generando un respaldo. Intenta nuevamente en unos momentos.' });
  backupInProgress = true;
  let backup;
  try {
    backup = await createBackup(db, __dirname);
    res.setHeader('Cache-Control', 'no-store');
    await new Promise((resolve, reject) => {
      res.download(backup.filename, `napoles-respaldo-${new Date().toISOString().replace(/[:.]/g, '-')}.zip`, error => error ? reject(error) : resolve());
    });
  } catch (error) {
    console.error('Error generando respaldo:', error);
    if (!res.headersSent && !res.destroyed) res.status(500).json({ error: 'No se pudo completar el respaldo. Intenta nuevamente.' });
  } finally {
    try { if (backup) await backup.cleanup(); }
    catch (error) { console.error('Error limpiando respaldo temporal:', error); }
    finally { backupInProgress = false; }
  }
});

// ===== SERVIR ESTÁTICOS Y UPLOADS =====
// Ruta específica para componentes JS (ANTES de express.static)
app.get('/js/components/:file', (req, res) => {
  const file = req.params.file;
  if (!file.endsWith('.js')) {
    return res.status(404).send('Not found');
  }
  res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
  res.sendFile(path.join(__dirname, 'js', 'components', file), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

// ===== RUTAS: PUNTOS =====

// GET puntos actuales del cliente
app.get('/api/clientes/:id/puntos', verificarToken, async (req, res) => {
  try {
    const cliente = await dbGet('SELECT id, puntos_acumulados FROM clientes WHERE id = ?', [req.params.id]);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ puntos_acumulados: cliente.puntos_acumulados });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET historial de movimientos de puntos
app.get('/api/clientes/:id/historial-puntos', verificarToken, async (req, res) => {
  try {
    const { fecha_inicio, fecha_fin } = req.query;
    
    let sql = `SELECT mp.*, v.numero_ticket FROM movimientos_puntos mp
               LEFT JOIN ventas v ON mp.venta_id = v.id
               WHERE mp.cliente_id = ?`;
    const params = [req.params.id];
    
    if (fecha_inicio && fecha_fin) {
      sql += ` AND DATE(mp.fecha_movimiento) BETWEEN ? AND ?`;
      params.push(fecha_inicio, fecha_fin);
    }
    
    sql += ` ORDER BY mp.fecha_movimiento DESC`;
    
    const movimientos = await dbAll(sql, params);
    res.json(movimientos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST consumir puntos del cliente
app.post('/api/clientes/:id/consumir-puntos', verificarToken, async (req, res) => {
  try {
    const { puntos, descripcion } = req.body;
    
    if (!puntos || puntos <= 0 || !Number.isInteger(puntos)) {
      return res.status(400).json({ error: 'Cantidad de puntos inválida' });
    }
    
    const cliente = await dbGet('SELECT puntos_acumulados FROM clientes WHERE id = ?', [req.params.id]);
    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    
    if (cliente.puntos_acumulados < puntos) {
      return res.status(400).json({ error: 'Puntos insuficientes' });
    }
    
    const puntosNuevos = cliente.puntos_acumulados - puntos;
    
    // Actualizar puntos del cliente
    await dbRun('UPDATE clientes SET puntos_acumulados = ? WHERE id = ?', [puntosNuevos, req.params.id]);
    
    // Registrar movimiento de consumo
    await dbRun(
      `INSERT INTO movimientos_puntos (cliente_id, tipo, puntos_cantidad, puntos_nuevos, descripcion)
       VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, 'consumo', puntos, puntosNuevos, descripcion || 'Consumo de puntos']
    );
    
    res.json({ 
      puntos_restados: puntos, 
      puntos_nuevos: puntosNuevos, 
      mensaje: 'Puntos consumidos exitosamente' 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/dist', express.static(path.join(__dirname, 'dist')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.get(['/pos.db', '/pos.db-wal', '/pos.db-shm', '/database.db', '/server.js', '/package-lock.json', '/package.json', '/lib/*', '/node_modules/*'], (req, res) => res.sendStatus(404));
app.use('/uploads', express.static(uploadsDir));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'Error en el servidor' });
  }
  next();
});

const PORT = process.env.PORT || 3000;

function iniciarServidor(port) {
  const servidor = app.listen(port, () => {
    console.log(`\n[OK] Sistema POS funcionando en http://localhost:${port}\n`);
    console.log(`[INFO] Credenciales:\n   admin/admin, vendedor1/1234, vendedor2/1234, gerente/1234\n`);
  });

  servidor.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const siguientePuerto = port + 1;
      console.warn(`[WARN] Puerto ${port} ocupado. Intentando iniciar en http://localhost:${siguientePuerto}`);
      iniciarServidor(siguientePuerto);
    } else {
      console.error('[ERROR] No se pudo iniciar el servidor:', err);
      process.exit(1);
    }
  });
}

iniciarServidor(PORT);

