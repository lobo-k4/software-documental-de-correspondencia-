/**
 * Controlador para la Administración de Plantillas de Notas (Módulo 10).
 */
const { query } = require('../config/database');
const { registrarAuditoria } = require('../services/auditoriaService');
const { success, created, badRequest, notFound, serverError } = require('../utils/responseHelper');

/**
 * Listar plantillas disponibles
 * GET /api/plantillas
 */
const getPlantillas = async (req, res) => {
  try {
    const { tipo, activo = 'true' } = req.query;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (activo !== undefined && activo !== '') {
      conditions.push(`p.activo = $${paramIdx}`);
      params.push(activo === 'true' || activo === true);
      paramIdx++;
    }

    if (tipo) {
      conditions.push(`p.tipo = $${paramIdx}`);
      params.push(tipo);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        p.id_plantilla,
        p.codigo,
        p.titulo,
        p.tipo,
        p.cuerpo_plantilla,
        p.variables_requeridas,
        p.activo,
        p.creado_en,
        u.nombre_completo AS creado_por_nombre
      FROM plantillas_notas p
      INNER JOIN usuarios u ON p.creado_por = u.id_usuario
      ${whereClause}
      ORDER BY p.id_plantilla ASC
    `;

    const result = await query(sql, params);
    return success(res, result.rows, 'Plantillas obtenidas correctamente.');
  } catch (error) {
    console.error('[GET PLANTILLAS ERROR]:', error);
    return serverError(res, 'Error al consultar plantillas.', error);
  }
};

/**
 * Obtener detalle de una plantilla por ID
 * GET /api/plantillas/:id
 */
const getPlantillaById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        p.id_plantilla,
        p.codigo,
        p.titulo,
        p.tipo,
        p.cuerpo_plantilla,
        p.variables_requeridas,
        p.activo,
        p.creado_en,
        u.nombre_completo AS creado_por_nombre
      FROM plantillas_notas p
      INNER JOIN usuarios u ON p.creado_por = u.id_usuario
      WHERE p.id_plantilla = $1
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return notFound(res, 'Plantilla no encontrada.');
    }

    return success(res, result.rows[0], 'Detalle de plantilla obtenido.');
  } catch (error) {
    return serverError(res, 'Error al obtener la plantilla.', error);
  }
};

/**
 * Crear nueva plantilla de notas
 * POST /api/plantillas
 */
const crearPlantilla = async (req, res) => {
  try {
    const { codigo, titulo, tipo, cuerpo_plantilla, variables_requeridas = [] } = req.body;

    if (!codigo || !titulo || !tipo || !cuerpo_plantilla) {
      return badRequest(res, 'Campos obligatorios requeridos: codigo, titulo, tipo, cuerpo_plantilla.');
    }

    // Verificar unicidad de código
    const checkRes = await query('SELECT id_plantilla FROM plantillas_notas WHERE codigo = $1', [codigo.trim()]);
    if (checkRes.rows.length > 0) {
      return badRequest(res, 'El código de plantilla ya se encuentra registrado.');
    }

    const insertSql = `
      INSERT INTO plantillas_notas (
        codigo,
        titulo,
        tipo,
        cuerpo_plantilla,
        variables_requeridas,
        creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const insertParams = [
      codigo.trim().toUpperCase(),
      titulo.trim(),
      tipo.trim(),
      cuerpo_plantilla,
      JSON.stringify(variables_requeridas),
      req.user.id_usuario
    ];

    const insertRes = await query(insertSql, insertParams);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'REGISTRAR',
      modulo: 'Plantillas',
      registro_afectado: codigo,
      detalles: `Creación de plantilla: ${titulo}`,
      req
    });

    return created(res, insertRes.rows[0], 'Plantilla creada exitosamente.');
  } catch (error) {
    console.error('[CREAR PLANTILLA ERROR]:', error);
    return serverError(res, 'Error al registrar plantilla.', error);
  }
};

/**
 * Modificar plantilla existente
 * PUT /api/plantillas/:id
 */
const actualizarPlantilla = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, tipo, cuerpo_plantilla, variables_requeridas, activo } = req.body;

    const checkRes = await query('SELECT codigo FROM plantillas_notas WHERE id_plantilla = $1', [id]);
    if (checkRes.rows.length === 0) {
      return notFound(res, 'Plantilla no encontrada.');
    }
    const { codigo } = checkRes.rows[0];

    const updateSql = `
      UPDATE plantillas_notas SET
        titulo = COALESCE($1, titulo),
        tipo = COALESCE($2, tipo),
        cuerpo_plantilla = COALESCE($3, cuerpo_plantilla),
        variables_requeridas = COALESCE($4, variables_requeridas),
        activo = COALESCE($5, activo),
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_plantilla = $6
      RETURNING *
    `;

    const updateParams = [
      titulo ? titulo.trim() : null,
      tipo ? tipo.trim() : null,
      cuerpo_plantilla || null,
      variables_requeridas ? JSON.stringify(variables_requeridas) : null,
      activo !== undefined ? activo : null,
      id
    ];

    const updateRes = await query(updateSql, updateParams);

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Plantillas',
      registro_afectado: codigo,
      detalles: 'Actualización de plantilla de nota',
      req
    });

    return success(res, updateRes.rows[0], 'Plantilla actualizada correctamente.');
  } catch (error) {
    console.error('[ACTUALIZAR PLANTILLA ERROR]:', error);
    return serverError(res, 'Error al actualizar la plantilla.', error);
  }
};

module.exports = {
  getPlantillas,
  getPlantillaById,
  crearPlantilla,
  actualizarPlantilla
};
