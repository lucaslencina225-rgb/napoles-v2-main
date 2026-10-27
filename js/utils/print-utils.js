export function imprimirComprobante(titulo, htmlBody) {
  const ventana = window.open('', '_blank');
  if (!ventana) {
    alert('Permite ventanas emergentes para imprimir');
    return;
  }
  ventana.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
    th { background: #f5f5f5; }
    .total { text-align: right; font-size: 16px; font-weight: bold; margin-top: 16px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  ${htmlBody}
  <script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`);
  ventana.document.close();
}

export function exportarCSV(nombreArchivo, columnas, filas) {
  const encabezado = columnas.map(c => c.label).join(',');
  const lineas = filas.map(fila =>
    columnas.map(c => `"${String(fila[c.key] ?? '').replace(/"/g, '""')}"`).join(',')
  );
  const csv = [encabezado, ...lineas].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function fmtMoney(n) {
  return '$' + (Number(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
