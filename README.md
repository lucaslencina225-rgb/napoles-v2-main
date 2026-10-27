# Nápoles POS

Instalar con `npm ci` e iniciar con `npm start`. Los cambios de código requieren actualizar la instalación y reiniciar el servidor. No reemplazar la base `pos.db` existente al actualizar.

## Gestión y reportes

- Los buscadores conservan foco y posición del cursor. Ventas incluye un campo para filtrar clientes por nombre completo o teléfono y carga todas las páginas de registros.
- Las cabeceras de Clientes, Barberos, Inventario y las tablas de Reportes incluyen ↕ para alternar el orden. Clientes y Barberos muestran la fecha de incorporación. Inventario ordena el catálogo completo antes de paginar.
- Los reportes muestran fecha y hora argentina; PDF y CSV incluyen ambas. Las ventas se cargan por páginas sin el anterior límite de 1.000; los resúmenes de clientes y productos tampoco se limitan a veinte registros.
- Un servicio se representa mediante `minimo_stock = -1` (compatible con valores negativos o NULL anteriores). No descuenta unidades, genera movimientos de stock ni aparece en alertas de stock bajo. Los productos con mínimo cero conservan ese valor.

## Respaldo completo

En Configuraciones → Sistema → Respaldar Base de Datos, un administrador descarga un ZIP con:

- `pos.db`: copia consistente de toda la base SQLite, incluidos los datos confirmados en WAL, todas sus tablas, índices, vistas y disparadores.
- `uploads/` y `assets/`: archivos locales cargados, imágenes y documentos.
- `manifest.json`: fecha, cantidad de registros por tabla, archivos, tamaños y SHA-256.
- `RESTAURAR.txt`: instrucciones para restaurar con el servidor detenido.

El servidor verifica la integridad de la copia antes de entregar el ZIP. Solo permite un respaldo simultáneo y elimina los temporales al finalizar o fallar. El archivo contiene credenciales y sesiones: conservarlo en una ubicación privada. Las imágenes externas se conservan como URL en la base, no se descargan de servicios ajenos. El ZIP respalda los datos, y se restaura sobre una instalación compatible de esta aplicación.

Para restaurar: detener el servidor, conservar una copia de la instalación actual, extraer `pos.db`, `uploads/` y `assets/` en la carpeta del proyecto y retirar los antiguos `pos.db-wal` y `pos.db-shm` antes de reiniciar. Comprobar los SHA-256 del manifiesto si se necesita verificar el archivo transferido.

## Verificación

`npm test` ejecuta regresiones del DOM, búsqueda continua, ordenamiento, paginación, contenido exportado, endpoints y restauración del respaldo con datos de prueba aislados. No utiliza la base de producción. `npm run build` recompila los estilos.
