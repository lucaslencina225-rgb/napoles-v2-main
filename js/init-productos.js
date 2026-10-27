/**
 * Script de inicialización: Carga productos de prueba CON CANTIDADES/STOCK
 * Ejecutar en la consola del navegador o incluir antes de montar la app
 */

/**function cargarProductosPrueba() {
  const KEY_PROD = "pos_inv_prod";
  const KEY_MOV = "pos_inv_mov";
  
  // Lista de productos del inventario
  const productos = [
    { nombre: "Perfuma Desinfectante 2L", marca: "Ale GumPro" },
    { nombre: "Perfuma Desinfectante 5L", marca: "Ale GumPro" },
    { nombre: "Perfuma Desinfectante 25L", marca: "Ale GumPro" },
    { nombre: "Cloro 10L 100%", marca: "CerroCior" },
    { nombre: "Cloro 10L 120%", marca: "CerroCior" },
    { nombre: "Lavandina 2L", marca: "CerroCior" },
    { nombre: "Lavandina 5L", marca: "CerroCior" },
    { nombre: "Lavandina en gel 1L", marca: "Ale GumPro" },
    { nombre: "Lavandina en gel 5L", marca: "Ale GumPro" },
    { nombre: "Detergente Industrial 1L", marca: "CerroCior" },
    { nombre: "Detergente Industrial 5L", marca: "CerroCior" },
    { nombre: "Detergente Magistral 1L", marca: "Ale GumPro" },
    { nombre: "Detergente Magistral 5L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Ariel (cl) 1L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Ariel (cl) 3L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Ariel (cl) 5L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Ariel super eco 5L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Skip 1L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Skip 3L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Skip 5L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Original 1L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Original 3L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido T/Original 5L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/Vivere (vvr) 1L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/Vivere (vvr) 5L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/Vivere (vvr) 3L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/Lavadero 1L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/Lavadero 3L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/Lavadero 5L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/downy 1L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/downy 3L", marca: "Ale GumPro" },
    { nombre: "Suavizante T/downy 5L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido Pimanos 1L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido Pimanos 5L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido Pimanos Dove 1L", marca: "Ale GumPro" },
    { nombre: "Jabón Líquido Pimanos Dove 5L", marca: "Ale GumPro" },
    { nombre: "Shampoo Ini. Ceramidas 500ml", marca: "ForQuim" },
  ];

  // Generar SKU aleatorio
  function generarSKU() {
    const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let sku = "SKU-";
    for (let i = 0; i < 8; i++) {
      sku += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return sku;
  }

  // Generar precio aleatorio entre 500 y 3500
  function generarPrecio() {
    return Math.floor(Math.random() * (3500 - 500 + 1)) + 500;
  }

  // Generar ID único
  function generarId() {
    return "prod_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  // Generar ID de movimiento
  function generarIdMov() {
    return "mov_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  // Transformar a formato de inventario
  const productosFormato = productos.map((p, idx) => ({
    id: generarId(),
    sku: generarSKU(),
    nombre: p.nombre,
    marca: p.marca,
    tipo: "productos",
    categoria: "Líquidos",
    descripcion: `Producto de limpieza - ${p.marca}`,
    costo: Math.floor(generarPrecio() * 0.6),
    precio: generarPrecio(),
    precioMayorista: Math.floor(generarPrecio() * 0.85), // 15% desc
    precioMenorista: generarPrecio(),
    minStock: 5,
    proveedor: p.marca,
    ubicacion: "Almacén Central",
    activo: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));

  // Crear movimientos de stock inicial (ajuste_in) para cada producto
  const movimientos = productosFormato.map((p) => {
    const cantidadInicial = Math.floor(Math.random() * (50 - 5 + 1)) + 5; // 5 a 50 unidades
    return {
      id: generarIdMov(),
      productId: p.id,
      tipo: "ajuste_in", // entrada de ajuste
      cantidad: cantidadInicial,
      sucursalId: "default",
      nota: `Stock inicial de ${cantidadInicial} unidades`,
      usuario: "admin",
      createdAt: new Date().toISOString(),
    };
  });

  // Guardar en localStorage
  try {
    localStorage.setItem(KEY_PROD, JSON.stringify(productosFormato));
    localStorage.setItem(KEY_MOV, JSON.stringify(movimientos));
    
    console.log(`[OK] ${productosFormato.length} productos cargados con cantidades`);
    console.log(`[OK] ${movimientos.length} movimientos de stock iniciales creados`);
    
    // Mostrar ejemplo
    console.table(productosFormato.slice(0, 5).map((p, i) => ({
      Nombre: p.nombre,
      SKU: p.sku,
      Precio: "$" + p.precio,
      "Stock Inicial": movimientos[i]?.cantidad || 0,
      Marca: p.marca,
    })));
    
    return { productosFormato, movimientos };
  } catch (e) {
    console.error("[ERROR] Error al cargar productos:", e);
    return null;
  }
}

// Exponer la función globalmente
window.cargarProductosPrueba = cargarProductosPrueba;

// Ejecutar automáticamente si no hay productos cargados
const KEY_PROD = "pos_inv_prod";
try {
  const productosExistentes = JSON.parse(localStorage.getItem(KEY_PROD) || "[]");
  if (productosExistentes.length === 0) {
    console.log("[INFO] Cargando productos de prueba...");
    cargarProductosPrueba();
  } else {
    console.log(`ℹ️ Ya hay ${productosExistentes.length} productos cargados`);
  }
} catch (e) {
  console.warn("No se pudo verificar productos existentes");
}
*/