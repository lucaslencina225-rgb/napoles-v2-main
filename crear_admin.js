const bcrypt = require('bcryptjs');
const { dbRun, isTurso } = require('./lib/db');

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

  for (const u of usuarios) {
    try {
      await dbRun(
        `INSERT OR REPLACE INTO usuarios (usuario, email, password, nombre, rol, activo) VALUES (?, ?, ?, ?, ?, 1)`,
        [u.usuario, u.email, u.password, u.nombre, u.rol]
      );
      console.log(`✅ Usuario creado/actualizado: ${u.usuario} (rol: ${u.rol})`);
    } catch (err) {
      console.error(`Error al crear ${u.usuario}:`, err.message);
    }
  }

  console.log('\nCredenciales listas para iniciar sesión:');
  console.log('• Admin: admin / admin123');
  console.log('• Vendedor: vendedor / vendedor123');
  process.exit(0);
}

crearUsuariosIniciales();