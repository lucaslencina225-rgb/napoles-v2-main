// Legacy service records use NULL or a negative minimum; keep that representation.
function isService(product) {
  return product.es_servicio === true || product.es_servicio === 1 || product.es_servicio === '1' ||
    product.minimo_stock === null || Number(product.minimo_stock) < 0;
}
function stockMinimum(body) {
  if (isService(body)) return -1;
  const minimum = body.minimo_stock === undefined ? 5 : Number(body.minimo_stock);
  if (!Number.isFinite(minimum) || minimum < 0) throw new Error('Stock mínimo inválido');
  return minimum;
}
module.exports = { isService, stockMinimum };
