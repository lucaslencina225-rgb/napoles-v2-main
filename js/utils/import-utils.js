/**
 * Utilidades para importación de datos desde Excel, CSV y OCR de facturas
 * Requiere: xlsx (XLSX), Tesseract (OCR)
 */

export const ImportUtils = {
  /**
   * Importa productos desde archivo Excel (.xlsx)
   * Columnas esperadas: sku, nombre, tipo, categoria, proveedor, costo, precio, minStock, ubicacion, stock
   */
  async importarProductosExcel(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);
            
            if (!rows.length) {
              reject(new Error('El archivo Excel está vacío'));
              return;
            }

            // Validar que tenga las columnas mínimas
            const requiredCols = ['sku', 'nombre'];
            const firstRow = rows[0];
            const missingCols = requiredCols.filter(col => !(col.toLowerCase() in firstRow));
            
            if (missingCols.length > 0) {
              reject(new Error(`Faltan columnas requeridas: ${missingCols.join(', ')}`));
              return;
            }

            // Normalizar y validar datos
            const productos = rows
              .filter(r => r.sku && r.nombre) // Filtrar filas vacías
              .map(r => ({
                sku: String(r.sku || '').trim(),
                nombre: String(r.nombre || '').trim(),
                tipo: (String(r.tipo || 'productos').trim().toLowerCase()),
                categoria: (String(r.categoria || '').trim()),
                proveedor: (String(r.proveedor || '').trim()),
                costo: Number(r.costo) || 0,
                precio: Number(r.precio) || 0,
                minStock: Number(r.minStock || r['Min Stock'] || r['min_stock']) || 0,
                ubicacion: (String(r.ubicacion || r.location || '').trim()),
                stock: Number(r.stock) || 0,
              }));

            resolve(productos);
          } catch (error) {
            reject(new Error(`Error al procesar Excel: ${error.message}`));
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Importa proveedores desde archivo Excel (.xlsx)
   * Columnas esperadas: nombre, cuit, email, telefono, direccion, rubro, notas
   */
  async importarProveedoresExcel(file) {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const workbook = XLSX.read(e.target.result, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet);

            if (!rows.length) {
              reject(new Error('El archivo Excel está vacío'));
              return;
            }

            // Validar que tenga al menos nombre
            if (!rows[0].nombre) {
              reject(new Error('Falta columna requerida: nombre'));
              return;
            }

            // Normalizar datos
            const proveedores = rows
              .filter(r => r.nombre) // Filtrar filas sin nombre
              .map(r => ({
                nombre: String(r.nombre || '').trim(),
                cuit: String(r.cuit || r.CUIT || '').trim(),
                email: String(r.email || r.Email || '').trim(),
                telefono: String(r.telefono || r.phone || r.tel || '').trim(),
                direccion: String(r.direccion || r.address || r.dirección || '').trim(),
                rubro: String(r.rubro || r.industry || r.sector || '').trim(),
                notas: String(r.notas || r.notes || '').trim(),
                activo: true,
              }));

            resolve(proveedores);
          } catch (error) {
            reject(new Error(`Error al procesar Excel: ${error.message}`));
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Extrae texto de una imagen de factura usando OCR (Tesseract)
   * Retorna objeto con datos extraídos
   */
  async extraerDatosFacturaOCR(file) {
    return new Promise(async (resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const imageData = e.target.result;

            // Usar Tesseract para OCR
            const worker = await Tesseract.createWorker('spa'); // español
            const result = await worker.recognize(imageData);
            const texto = result.data.text;
            await worker.terminate();

            // Extraer datos de la factura
            const datosFactura = {
              textoCompleto: texto,
              items: [],
              total: 0,
              proveedor: '',
              fecha: '',
              numero: '',
            };

            // Expresiones regulares para extrae datos
            const lineas = texto.split('\n').filter(l => l.trim());
            
            // Intentar extraer número de factura
            const regexNumero = /(?:factura|invoice|nº|no\.?)\s*:?\s*([A-Z0-9\-\/]+)/i;
            const matchNum = texto.match(regexNumero);
            if (matchNum) datosFactura.numero = matchNum[1].trim();

            // Intentar extraer fecha
            const regexFecha = /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/;
            const matchFecha = texto.match(regexFecha);
            if (matchFecha) datosFactura.fecha = matchFecha[1].trim();

            // Intentar extraer total
            const regexTotal = /(?:total|subtotal|grand total)\s*:?\s*\$?\s*([\d,\.\s]+)/i;
            const matchTotal = texto.match(regexTotal);
            if (matchTotal) {
              const valor = matchTotal[1].trim().replace(/[\s\.]/g, '').replace(',', '.');
              datosFactura.total = parseFloat(valor) || 0;
            }

            // Extraer posibles líneas de items (líneas con cantidad y precio)
            const regexItems = /(\d+)\s+(.+?)\s+(\$?[\d,\.]+)\s+(\$?[\d,\.]+)/g;
            let match;
            while ((match = regexItems.exec(texto)) !== null) {
              datosFactura.items.push({
                cantidad: parseInt(match[1]),
                descripcion: match[2].trim(),
                precioUnitario: parseFloat(match[3].replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
                subtotal: parseFloat(match[4].replace(/[^\d.,]/g, '').replace(',', '.')) || 0,
              });
            }

            resolve(datosFactura);
          } catch (error) {
            reject(new Error(`Error en OCR: ${error.message}`));
          }
        };
        reader.onerror = () => reject(new Error('Error al leer la imagen'));
        reader.readAsDataURL(file);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Genera plantilla Excel para productos
   */
  descargarPlantillaProductos() {
    const data = [
      {
        sku: 'SKU-001',
        nombre: 'Producto Ejemplo',
        tipo: 'productos',
        categoria: 'Categoria',
        proveedor: 'Proveedor',
        costo: 100,
        precio: 200,
        minStock: 5,
        ubicacion: 'Estante A1',
        stock: 10,
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    ws['!cols'] = [
      { wch: 12 }, // sku
      { wch: 25 }, // nombre
      { wch: 12 }, // tipo
      { wch: 15 }, // categoria
      { wch: 15 }, // proveedor
      { wch: 10 }, // costo
      { wch: 10 }, // precio
      { wch: 10 }, // minStock
      { wch: 15 }, // ubicacion
      { wch: 8 },  // stock
    ];
    XLSX.writeFile(wb, 'plantilla_productos.xlsx');
  },

  /**
   * Genera plantilla Excel para proveedores
   */
  descargarPlantillaProveedores() {
    const data = [
      {
        nombre: 'Proveedor Ejemplo',
        cuit: '20-12345678-9',
        email: 'contacto@proveedor.com',
        telefono: '1234567890',
        direccion: 'Calle Principal 123',
        rubro: 'Importaciones',
        notas: 'Ofertas disponibles',
      }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Proveedores');
    ws['!cols'] = [
      { wch: 20 }, // nombre
      { wch: 15 }, // cuit
      { wch: 25 }, // email
      { wch: 15 }, // telefono
      { wch: 30 }, // direccion
      { wch: 15 }, // rubro
      { wch: 25 }, // notas
    ];
    XLSX.writeFile(wb, 'plantilla_proveedores.xlsx');
  },

  /**
   * Validar y mostrar resumen de datos antes de importar
   */
  crearResumenImportacion(datos, tipo) {
    let html = `
      <div class="p-4">
        <h3 class="text-lg font-semibold mb-3">Resumen de importación - ${tipo}</h3>
        <p class="text-sm text-gray-600 mb-4">Se van a importar <strong>${datos.length}</strong> registros:</p>
        <div class="max-h-64 overflow-y-auto mb-4 border rounded p-3 bg-gray-50">
          <table class="text-xs w-full">
            <thead class="font-semibold sticky top-0 bg-white dark:bg-gray-800">
              <tr>
                <th class="text-left p-1">Registro</th>
                <th class="text-left p-1">Detalles</th>
              </tr>
            </thead>
            <tbody>
    `;

    datos.slice(0, 20).forEach((item, idx) => {
      if (tipo === 'productos') {
        html += `
          <tr class="border-t">
            <td class="p-1">${idx + 1}. ${item.sku}</td>
            <td class="p-1 text-xs">${item.nombre} | ${item.categoria} | $${item.costo} → $${item.precio}</td>
          </tr>
        `;
      } else if (tipo === 'proveedores') {
        html += `
          <tr class="border-t">
            <td class="p-1">${idx + 1}. ${item.nombre}</td>
            <td class="p-1 text-xs">${item.cuit} | ${item.email} | ${item.rubro}</td>
          </tr>
        `;
      }
    });

    if (datos.length > 20) {
      html += `
        <tr class="border-t">
          <td class="p-1 font-semibold">...</td>
          <td class="p-1 text-xs">... y ${datos.length - 20} registros más</td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded p-2 text-xs text-blue-900">
          <strong>Nota:</strong> Los registros duplicados (por SKU o nombre) se actualizarán automáticamente.
        </div>
      </div>
    `;

    return html;
  },
};

export default ImportUtils;
