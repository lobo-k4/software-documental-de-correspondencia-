/**
 * Controlador para el Módulo de Archivo Digital (Módulo 11).
 * Gestiona la consulta, descarga segura y administración de documentos adjuntos.
 */
const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');
const { registrarAuditoria } = require('../services/auditoriaService');
const { success, notFound, serverError } = require('../utils/responseHelper');

/**
 * Listar documentos digitales adjuntos con filtros
 * GET /api/documentos
 */
const getDocumentos = async (req, res) => {
  try {
    const { id_recibida, id_entregada, extension, q, pagina = 1, limite = 15 } = req.query;

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (id_recibida) {
      conditions.push(`da.id_recibida = $${paramIdx}`);
      params.push(parseInt(id_recibida, 10));
      paramIdx++;
    }

    if (id_entregada) {
      conditions.push(`da.id_entregada = $${paramIdx}`);
      params.push(parseInt(id_entregada, 10));
      paramIdx++;
    }

    if (extension) {
      conditions.push(`LOWER(da.extension) = LOWER($${paramIdx})`);
      params.push(extension.startsWith('.') ? extension : `.${extension}`);
      paramIdx++;
    }

    if (q?.trim()) {
      conditions.push(`(
        da.nombre_original ILIKE $${paramIdx}
        OR cr.codigo ILIKE $${paramIdx}
        OR ce.codigo ILIKE $${paramIdx}
        OR cr.asunto ILIKE $${paramIdx}
        OR ce.asunto ILIKE $${paramIdx}
        OR ng.numero_nota ILIKE $${paramIdx}
      )`);
      params.push(`%${q.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total
      FROM documentos_adjuntos da
      LEFT JOIN correspondencia_recibida cr ON da.id_recibida = cr.id_recibida
      LEFT JOIN correspondencia_entregada ce ON da.id_entregada = ce.id_entregada
      LEFT JOIN notas_generadas ng ON ng.id_nota = da.id_nota
        OR (da.id_nota IS NULL AND ng.numero_nota = ce.numero_nota)
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        da.id_documento,
        da.id_recibida,
        cr.codigo AS correspondencia_recibida_codigo,
        cr.asunto AS correspondencia_recibida_asunto,
        da.id_entregada,
        ce.codigo AS correspondencia_entregada_codigo,
        ce.asunto AS correspondencia_entregada_asunto,
        COALESCE(da.id_nota, ng.id_nota) AS id_nota,
        ng.numero_nota AS nota_numero,
        ng.id_entregada AS nota_id_entregada,
        da.nombre_original,
        da.mime_type,
        da.extension,
        da.tamano_bytes,
        da.creado_en,
        u.nombre_completo AS usuario_subio_nombre,
        u.username AS usuario_subio_username
      FROM documentos_adjuntos da
      LEFT JOIN correspondencia_recibida cr ON da.id_recibida = cr.id_recibida
      LEFT JOIN correspondencia_entregada ce ON da.id_entregada = ce.id_entregada
      LEFT JOIN notas_generadas ng ON ng.id_nota = da.id_nota
        OR (da.id_nota IS NULL AND ng.numero_nota = ce.numero_nota)
      INNER JOIN usuarios u ON da.id_usuario_subio = u.id_usuario
      ${whereClause}
      ORDER BY da.id_documento DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await query(dataSql, dataParams);

    return success(res, {
      documentos: dataRes.rows,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    }, 'Documentos obtenidos correctamente.');
  } catch (error) {
    console.error('[GET DOCUMENTOS ERROR]:', error);
    return serverError(res, 'Error al consultar documentos digitales.', error);
  }
};

/**
 * Descargar o visualizar archivo digital
 * GET /api/documentos/:id/descargar
 */
const descargarDocumento = async (req, res) => {
  try {
    const { id } = req.params;

    const docRes = await query(
      `SELECT 
        da.*,
        cr.codigo AS codigo_recibida,
        ce.codigo AS codigo_entregada
       FROM documentos_adjuntos da
       LEFT JOIN correspondencia_recibida cr ON da.id_recibida = cr.id_recibida
       LEFT JOIN correspondencia_entregada ce ON da.id_entregada = ce.id_entregada
       WHERE da.id_documento = $1`,
      [id]
    );

    if (docRes.rows.length === 0) {
      return notFound(res, 'El documento digital no fue encontrado en la base de datos.');
    }

    const doc = docRes.rows[0];
    const filePath = path.resolve(doc.ruta_almacenamiento);

    if (!fs.existsSync(filePath)) {
      return notFound(res, 'El archivo físico no se encuentra disponible en el servidor de almacenamiento.');
    }

    // Registrar descarga en auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'DESCARGA_DOCUMENTO',
      modulo: 'Archivo Digital',
      registro_afectado: doc.codigo_recibida || doc.codigo_entregada || `DOC-${id}`,
      detalles: `Descarga de archivo: ${doc.nombre_original}`,
      req
    });

    // Enviar archivo para descarga forzada o visualización en navegador
    res.setHeader('Content-Type', doc.mime_type);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.nombre_original)}"`);
    return res.sendFile(filePath);
  } catch (error) {
    console.error('[DESCARGAR DOCUMENTO ERROR]:', error);
    return serverError(res, 'Error al descargar documento digital.', error);
  }
};

/**
 * Eliminar un documento digital y su archivo físico
 * DELETE /api/documentos/:id
 */
const eliminarDocumento = async (req, res) => {
  try {
    const { id } = req.params;
    const docRes = await query(
      `SELECT da.id_documento, da.nombre_original, da.ruta_almacenamiento,
              cr.codigo AS codigo_recibida, ce.codigo AS codigo_entregada,
              ng.numero_nota
       FROM documentos_adjuntos da
       LEFT JOIN correspondencia_recibida cr ON da.id_recibida = cr.id_recibida
       LEFT JOIN correspondencia_entregada ce ON da.id_entregada = ce.id_entregada
       LEFT JOIN notas_generadas ng ON da.id_nota = ng.id_nota
       WHERE da.id_documento = $1`,
      [id]
    );

    if (docRes.rows.length === 0) {
      return notFound(res, 'El documento digital no fue encontrado.');
    }

    const documento = docRes.rows[0];
    await query('DELETE FROM documentos_adjuntos WHERE id_documento = $1', [id]);

    try {
      await fs.promises.unlink(path.resolve(documento.ruta_almacenamiento));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('[ELIMINAR DOCUMENTO] No se pudo eliminar el archivo físico:', error.message);
      }
    }

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'ELIMINAR_DOCUMENTO',
      modulo: 'Archivo Digital',
      registro_afectado: documento.codigo_recibida || documento.codigo_entregada || documento.numero_nota || `DOC-${id}`,
      detalles: `Documento eliminado: ${documento.nombre_original}`,
      req
    });

    return success(res, { id_documento: id }, 'Documento digital eliminado correctamente.');
  } catch (error) {
    console.error('[ELIMINAR DOCUMENTO ERROR]:', error);
    return serverError(res, 'Error al eliminar el documento digital.', error);
  }
};

module.exports = {
  getDocumentos,
  descargarDocumento,
  eliminarDocumento
};
