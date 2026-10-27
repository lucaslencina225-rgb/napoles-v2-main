const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'pos.db');
const db = new sqlite3.Database(dbPath);

async function crearUsuariosIniciales() {
  const salt = await bcrypt.genSalt(10);
  const passwordAdmin = await bcrypt.hash('admin123', salt);
  const passwordVendedor = await bcrypt.hash('vendedor123', salt);

  const usuarios = [
    {
      usuario: 'admin',
      email: 'admin@napolis-barber.com',
      password: passwordAdmin,
      nombre: 'Administrador',
      rol: 'admin'
    },
    {
      usuario: 'vendedor',
      email: 'vendedor@napolis-barber.com',
      password: passwordVendedor,
      nombre: 'Vendedor',
      rol: 'vendedor'
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO usuarios (usuario, email, password, nombre, rol, activo)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  usuarios.forEach(u => {
    stmt.run([u.usuario, u.email, u.password, u.nombre, u.rol], (err) => {
      if (err) {
        console.error(`Error al crear ${u.usuario}:`, err.message);
      } else {
        console.log(`✅ Usuario creado: ${u.usuario} (rol: ${u.rol})`);
      }
    });
  });

  stmt.finalize(() => {
    db.close();
    console.log('\nCredenciales listas para iniciar sesión:');
    console.log('• Admin: admin / admin123');
    console.log('• Vendedor: vendedor / vendedor123');
  });
}

crearUsuariosIniciales();