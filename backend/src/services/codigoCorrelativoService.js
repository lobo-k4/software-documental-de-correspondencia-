/**
 * Servicio para la Generación Atómica y Concurrente de Códigos Correlativos Únicos.
 * Utiliza bloqueo a nivel de fila (FOR UPDATE) en PostgreSQL para evitar condiciones de carrera.
 */

/**
 * Genera el siguiente código correlativo anual.
 * @param {import('pg').PoolClient} client - Cliente con transacción activa
 * @param {'RECIBIDA' | 'ENTREGADA' | 'NOTA'} tipo - Tipo de correlativo
 * @param {number} [anio] - Año de vigencia (por defecto el año actual)
 * @returns {Promise<string>} Código correlativo formateado (Ej. COR-REC-2026-00001)
 */
const generarCodigoCorrelativo = async (client, tipo, anio = new Date().getFullYear()) => {
  // 1. Bloquear o insertar la fila del año correspondiente
  const selectSql = `
    SELECT ultimo_numero 
    FROM correlativos 
    WHERE tipo = $1 AND anio = $2 
    FOR UPDATE
  `;
  const resSelect = await client.query(selectSql, [tipo, anio]);

  let nuevoNumero = 1;

  if (resSelect.rows.length === 0) {
    // Si no existía registro para este tipo y año, insertar con valor 1
    const insertSql = `
      INSERT INTO correlativos (tipo, anio, ultimo_numero)
      VALUES ($1, $2, 1)
      RETURNING ultimo_numero
    `;
    await client.query(insertSql, [tipo, anio]);
    nuevoNumero = 1;
  } else {
    nuevoNumero = resSelect.rows[0].ultimo_numero + 1;
    const updateSql = `
      UPDATE correlativos 
      SET ultimo_numero = $1 
      WHERE tipo = $2 AND anio = $3
    `;
    await client.query(updateSql, [nuevoNumero, tipo, anio]);
  }

  // 2. Dar formato al código institucional
  const numeroPadded = String(nuevoNumero).padStart(5, '0');
  let prefijo = 'COR';

  if (tipo === 'RECIBIDA') {
    return `${prefijo}-REC-${anio}-${numeroPadded}`;
  } else if (tipo === 'ENTREGADA') {
    return `${prefijo}-ENT-${anio}-${numeroPadded}`;
  } else if (tipo === 'NOTA') {
    return `NOTA-${anio}-${numeroPadded}`;
  }

  return `${tipo}-${anio}-${numeroPadded}`;
};

module.exports = {
  generarCodigoCorrelativo
};
