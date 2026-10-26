/**
 * Controlador para la Generación de Notas Oficiales y Documentos (Módulo 10).
 * Soporta renderizado dinámico de variables, vista previa y emisión con correlativo.
 */
const { query, getClient } = require('../config/database');
const { generarCodigoCorrelativo } = require('../services/codigoCorrelativoService');
const { registrarAuditoria } = require('../services/auditoriaService');
const { crearNotificacion } = require('../services/notificacionService');
const { success, created, badRequest, notFound, serverError } = require('../utils/responseHelper');
const config = require('../config/env');
const PDFDocument = require('pdfkit');
const {
  AlignmentType,
  Document,
  Footer,
  ImageRun,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} = require('docx');
const QRCode = require('qrcode');
const fs = require('fs');
const { networkInterfaces } = require('os');
const path = require('path');
const { randomUUID } = require('crypto');

const getUrlBaseVerificacion = (req) => {
  if (config.env !== 'development') return config.frontendUrl;

  const origen = req.get('origin');
  if (origen) {
    const urlOrigen = new URL(origen);
    if (!['localhost', '127.0.0.1', '::1'].includes(urlOrigen.hostname)) return urlOrigen.origin;
  }

  const urlConfigurada = new URL(config.frontendUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(urlConfigurada.hostname)) return urlConfigurada.origin;

  const ipLocal = Object.values(networkInterfaces()).flat()
    .find(interfaz => interfaz.family === 'IPv4' && !interfaz.internal && !interfaz.address.startsWith('169.254.'))?.address;
  return ipLocal
    ? `${urlConfigurada.protocol}//${ipLocal}${urlConfigurada.port ? `:${urlConfigurada.port}` : ''}`
    : urlConfigurada.origin;
};

const htmlToText = (html) => html
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<\/p>|<\/div>|<\/h[1-6]>|<\/tr>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/\n\s*\n\s*\n/g, '\n\n')
  .trim();

const dibujarPieQr = (documento, qrBuffer) => {
  const x = documento.page.width - documento.page.margins.right - 68;
  const y = documento.page.height - 94;
  const posicionAnterior = { x: documento.x, y: documento.y };

  documento.save();
  documento.rect(0, documento.page.height - 9, documento.page.width, 9).fill('#286f99');
  documento.rect(0, documento.page.height - 12, documento.page.width, 3).fill('#d4933d');
  documento.image(qrBuffer, x, y, { width: 56, height: 56 });
  documento.restore();
  documento.x = posicionAnterior.x;
  documento.y = posicionAnterior.y;
};

const prepararPieQr = (documento, qrBuffer) => {
  documento.on('pageAdded', () => dibujarPieQr(documento, qrBuffer));
  dibujarPieQr(documento, qrBuffer);
};

const generarPdfNota = async (numeroNota, contenido, qrBuffer) => {
  const directorio = path.join(config.uploads.directory, 'notas');
  await fs.promises.mkdir(directorio, { recursive: true });
  const nombreArchivo = `${randomUUID()}.pdf`;
  const ruta = path.join(directorio, nombreArchivo);
  const texto = htmlToText(contenido);

  await new Promise((resolve, reject) => {
    const documento = new PDFDocument({ size: 'LETTER', margins: { top: 54, bottom: 118, left: 60, right: 60 } });
    const salida = fs.createWriteStream(ruta);
    salida.on('finish', resolve);
    salida.on('error', reject);
    documento.pipe(salida);
    prepararPieQr(documento, qrBuffer);
    documento.font('Times-Roman').fontSize(10).text(texto, { align: 'left', lineGap: 2 });
    documento.end();
  });

  const estadisticas = await fs.promises.stat(ruta);
  return {
    nombre_original: `${numeroNota}.pdf`,
    nombre_archivo: nombreArchivo,
    ruta_almacenamiento: ruta,
    mime_type: 'application/pdf',
    extension: '.pdf',
    tamano_bytes: estadisticas.size
  };
};

const generarPdfNotaGanesha = async (numeroNota, variables, qrBuffer) => {
  const directorio = path.join(config.uploads.directory, 'notas');
  await fs.promises.mkdir(directorio, { recursive: true });
  const nombreArchivo = `${randomUUID()}.pdf`;
  const ruta = path.join(directorio, nombreArchivo);

  await new Promise((resolve, reject) => {
    const documento = new PDFDocument({
      size: 'LETTER',
      margins: { top: 36, bottom: 122, left: 54, right: 54 }
    });
    const salida = fs.createWriteStream(ruta);
    const ancho = documento.page.width - documento.page.margins.left - documento.page.margins.right;

    salida.on('finish', resolve);
    salida.on('error', reject);
    documento.pipe(salida);
    prepararPieQr(documento, qrBuffer);

    documento.rect(0, 0, documento.page.width, 8).fill('#286f99');
    documento.rect(0, 8, documento.page.width, 3).fill('#d4933d');
    documento.fillColor('#1c5d86').font('Times-Bold').fontSize(23).text('Ganesha', 54, 24, { width: 210 });
    documento.fillColor('#2677a8').font('Times-Bold').fontSize(7.5).text('CONSULTORES MULTIDISCIPLINARIOS', 56, 49);
    documento.fillColor('#222').font('Times-Roman').fontSize(10)
      .text(`${variables.lugar}, ${variables.fecha}`, 300, 32, { width: ancho - 300, align: 'right' })
      .text(`CITE: ${numeroNota}`, 300, 48, { width: ancho - 300, align: 'right' });

    const textoEn = (texto, x, y, width, opciones = {}) => {
      const tamano = opciones.tamano || 9.5;
      const espacio = opciones.espacio ?? 4;
      documento.fillColor('#111').font(opciones.negrita ? 'Times-Bold' : 'Times-Roman').fontSize(tamano);
      const alto = documento.heightOfString(texto, { width, lineGap: opciones.lineGap || 1 });
      documento.text(texto, x, y, {
        width,
        align: opciones.alinear || 'left',
        lineGap: opciones.lineGap || 1,
        underline: opciones.subrayado || false
      });
      return y + alto + espacio;
    };

    let y = 83;
    y = textoEn('Señores:', 54, y, ancho, { espacio: 4 });
    y = textoEn(variables.destinatario || '', 54, y, ancho, { negrita: true, espacio: 3 });
    y = textoEn('Presente.-', 54, y, ancho, { espacio: 12 });
    y = textoEn(`REF.: ${variables.referencia || ''}`, 54, y, ancho, { negrita: true, subrayado: true, espacio: 10 });
    y = textoEn('De mi consideración', 54, y, ancho, { espacio: 11 });
    y = textoEn(variables.cuerpo || '', 54, y, ancho, { alinear: 'justify', tamano: 9.5, espacio: 14 });
    documento.y = y;

    const columnaConcepto = ancho * 0.32;
    const columnaDetalle = ancho - columnaConcepto;
    const dibujarCelda = (texto, x, y, width, height, opciones = {}) => {
      documento.rect(x, y, width, height).fillAndStroke(opciones.fondo || '#fff', '#6b7280');
      documento.fillColor(opciones.color || '#111').font(opciones.negrita ? 'Times-Bold' : 'Times-Roman')
        .fontSize(opciones.tamano || 8.5)
        .text(texto, x + 5, y + 4, { width: width - 10, height: height - 8, align: opciones.alinear || 'left', lineGap: 1 });
    };
    const dibujarFila = (concepto, detalle, opcionesFila = {}) => {
      const opciones = { width: columnaDetalle - 12, font: 'Times-Roman', fontSize: 8.5, lineGap: 1 };
      const alturaDetalle = documento.heightOfString(detalle, opciones);
      const alturaConcepto = documento.heightOfString(concepto, {
        width: columnaConcepto - 12, font: 'Times-Roman', fontSize: 8.5, lineGap: 1
      });
      const altura = Math.max(alturaDetalle, alturaConcepto) + 12;
      const y = documento.y;
      dibujarCelda(concepto, 54, y, columnaConcepto, altura, { negrita: opcionesFila.negrita });
      dibujarCelda(detalle, 54 + columnaConcepto, y, columnaDetalle, altura, { negrita: opcionesFila.negrita });
      documento.y = y + altura;
    };

    const yTabla = y;
    dibujarCelda('CONCEPTO', 54, yTabla, columnaConcepto, 22, { fondo: '#e4e8eb', negrita: true, alinear: 'center' });
    dibujarCelda('DETALLE', 54 + columnaConcepto, yTabla, columnaDetalle, 22, { fondo: '#e4e8eb', negrita: true, alinear: 'center' });
    documento.y = yTabla + 22;
    dibujarFila('Auditoría Externa Financiera a Proyecto de Inversión Pública FDI', `1. ${variables.detalle_1 || ''}`);
    dibujarFila('N° de comprobantes:', variables.comprobantes_1 || '');
    dibujarFila('Costo del servicio:', variables.costo_1 || '');
    dibujarFila('Auditoría Externa Financiera a Proyecto de Inversión Pública MMAyA-VMRHR', `2. ${variables.detalle_2 || ''}`);
    dibujarFila('N° de comprobantes:', variables.comprobantes_2 || '');
    dibujarFila('Costo del servicio:', variables.costo_2 || '');
    dibujarFila('Plazo de ejecución:', variables.plazo || '');
    dibujarFila('COSTO TOTAL DEL SERVICIO:', variables.costo_total || '', { negrita: true });

    let cierreY = textoEn('La presente cotización comprende el pago de todos los impuestos vigentes en el país, a la fecha de presentación de la propuesta.', 54, documento.y + 16, ancho, { tamano: 9, alinear: 'justify', espacio: 14 });
    cierreY = textoEn(variables.despedida || '', 54, cierreY, ancho, { tamano: 9, espacio: 8 });
    cierreY = textoEn('Atentamente,', 54, cierreY, ancho, { tamano: 9, espacio: 24 });
    cierreY = textoEn('___________________________________', 54, cierreY, ancho, { tamano: 9, espacio: 0 });
    cierreY = textoEn(variables.firmante_nombre || '', 54, cierreY, ancho, { tamano: 9, negrita: true, espacio: 0 });
    cierreY = textoEn(variables.firmante_cargo || '', 54, cierreY, ancho, { tamano: 9, negrita: true, espacio: 0 });
    cierreY = textoEn('GANESHA LTDA.', 54, cierreY, ancho, { tamano: 9, negrita: true, espacio: 0 });
    textoEn('CONSULTORES MULTIDISCIPLINARIOS', 54, cierreY, ancho, { tamano: 8, negrita: true, espacio: 0 });
    documento.end();
  });

  const estadisticas = await fs.promises.stat(ruta);
  return {
    nombre_original: `${numeroNota}.pdf`,
    nombre_archivo: nombreArchivo,
    ruta_almacenamiento: ruta,
    mime_type: 'application/pdf',
    extension: '.pdf',
    tamano_bytes: estadisticas.size
  };
};

/**
 * Reemplaza variables {{variable}} en el cuerpo de la plantilla
 * @param {string} plantilla 
 * @param {Object} variables 
 * @returns {string} Contenido HTML renderizado
 */
const renderizarContenido = (plantilla, variables = {}) => {
  let resultado = plantilla;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
    const texto = value !== undefined && value !== null ? String(value) : '';
    const textoSeguro = texto.replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
    resultado = resultado.replace(regex, textoSeguro);
  }
  return resultado;
};

const escaparHtml = (valor) => String(valor ?? '').replace(/[&<>"']/g, caracter => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[caracter]));

const renderizarDocumentoInstitucional = (codigo, numeroNota, variables) => {
  const valor = (campo) => escaparHtml(variables[campo] || '—');
  const titulos = {
    'PLANT-NOTA-OFICIAL': 'NOTA OFICIAL INSTITUCIONAL',
    'PLANT-MEMO-INTERNO': 'MEMORÁNDUM INTERNO',
    'PLANT-CIRCULAR-INT': 'CIRCULAR INTERNA'
  };
  const cabecera = `<header style="display:flex;justify-content:space-between;align-items:center;gap:24px;border-bottom:4px solid #2677a8;padding:0 0 14px;margin:0 0 28px;font-family:Georgia,'Times New Roman',serif"><div><strong style="display:block;font-size:28px;line-height:1.1;color:#1c5d86">Ganesha</strong><span style="font:700 9px Arial,sans-serif;color:#2876a3;letter-spacing:1px">CONSULTORES MULTIDISCIPLINARIOS</span></div><div style="text-align:right;font:12px Arial,sans-serif;color:#26343b"><strong style="display:block;font-size:13px">CITE: ${escaparHtml(numeroNota)}</strong><span>${variables.lugar ? `${valor('lugar')}, ` : ''}${valor('fecha')}</span></div></header><h1 style="margin:0 0 24px;text-align:center;color:#1c5d86;font:700 17px Arial,sans-serif;letter-spacing:1px">${titulos[codigo]}</h1>`;
  const fila = (etiqueta, contenido) => `<tr><th style="width:20%;padding:9px 10px;border:1px solid #b7c5cc;background:#edf3f6;text-align:left;font:700 10px Arial,sans-serif;color:#31566a">${etiqueta}</th><td style="padding:9px 10px;border:1px solid #b7c5cc;font:12px Georgia,'Times New Roman',serif">${contenido}</td></tr>`;
  const tabla = filas => `<table style="width:100%;border-collapse:collapse;margin:0 0 22px">${filas}</table>`;
  const parrafo = (contenido) => `<p style="margin:0 0 16px;font:13px/1.7 Georgia,'Times New Roman',serif;white-space:pre-wrap">${contenido}</p>`;
  const firma = `<div style="margin:48px auto 0;text-align:center;font:12px/1.5 Georgia,'Times New Roman',serif"><div style="width:260px;margin:0 auto 7px;border-top:1px solid #45545c"></div><strong>${valor('remitente_nombre')}</strong><br>${valor('remitente_cargo')}</div>`;

  if (codigo === 'PLANT-NOTA-OFICIAL') {
    return `${cabecera}${tabla(
      fila('DESTINATARIO', `${valor('destinatario')}<br>${valor('cargo_destinatario')}<br><strong>${valor('institucion_destinatario')}</strong>`) +
      fila('REFERENCIA', `<strong>${valor('asunto')}</strong>`)
    )}<p style="font:13px Georgia,'Times New Roman',serif">De mi mayor consideración:</p>${parrafo(valor('contenido'))}<p style="font:13px Georgia,'Times New Roman',serif">Sin otro particular, me despido con las consideraciones más distinguidas.</p>${firma}`;
  }

  if (codigo === 'PLANT-MEMO-INTERNO') {
    return `${cabecera}${tabla(
      fila('A', `${valor('destinatario')} - ${valor('cargo_destinatario')}`) +
      fila('DE', `${valor('remitente_nombre')} - ${valor('remitente_cargo')}`) +
      fila('FECHA', valor('fecha')) +
      fila('ASUNTO', `<strong>${valor('asunto')}</strong>`)
    )}${parrafo(valor('contenido'))}${firma}`;
  }

  return `${cabecera}${tabla(
    fila('FECHA', valor('fecha')) +
    fila('DE', `${valor('remitente_nombre')} - ${valor('remitente_cargo')}`) +
    fila('PARA', 'TODO EL PERSONAL INSTITUCIONAL') +
    fila('ASUNTO', `<strong>${valor('asunto')}</strong>`)
  )}${parrafo(valor('contenido'))}<p style="font:13px Georgia,'Times New Roman',serif">Agradeciendo su atención y cumplimiento estricto.</p>${firma}`;
};

const generarPdfNotaInstitucional = async (numeroNota, codigo, variables, qrBuffer) => {
  const directorio = path.join(config.uploads.directory, 'notas');
  await fs.promises.mkdir(directorio, { recursive: true });
  const nombreArchivo = `${randomUUID()}.pdf`;
  const ruta = path.join(directorio, nombreArchivo);
  const titulos = {
    'PLANT-NOTA-OFICIAL': 'NOTA OFICIAL INSTITUCIONAL',
    'PLANT-MEMO-INTERNO': 'MEMORÁNDUM INTERNO',
    'PLANT-CIRCULAR-INT': 'CIRCULAR INTERNA'
  };
  const texto = (documento, contenido, opciones = {}) => {
    const { espacio = 0.5, tamano, fontSize, negrita, color, ...opcionesTexto } = opciones;
    documento.font(negrita ? 'Times-Bold' : 'Times-Roman')
      .fontSize(tamano || fontSize || 10)
      .fillColor(color || '#17252d')
      .text(String(contenido || '—'), {
        width: documento.page.width - documento.page.margins.left - documento.page.margins.right,
        lineGap: 3,
        ...opcionesTexto
      });
    documento.moveDown(espacio);
  };

  await new Promise((resolve, reject) => {
    const documento = new PDFDocument({ size: 'LETTER', margins: { top: 42, bottom: 118, left: 54, right: 54 } });
    const salida = fs.createWriteStream(ruta);
    salida.on('finish', resolve);
    salida.on('error', reject);
    documento.pipe(salida);
    prepararPieQr(documento, qrBuffer);
    documento.rect(0, 0, documento.page.width, 8).fill('#286f99');
    documento.rect(0, 8, documento.page.width, 3).fill('#d4933d');
    documento.fillColor('#1c5d86').font('Times-Bold').fontSize(23).text('Ganesha', 54, 24);
    documento.fillColor('#2677a8').font('Times-Bold').fontSize(7.5).text('CONSULTORES MULTIDISCIPLINARIOS', 56, 49);
    documento.fillColor('#26343b').font('Times-Bold').fontSize(9)
      .text(`CITE: ${numeroNota}`, 300, 31, { width: 208, align: 'right' });
    if (variables.fecha) {
      documento.font('Times-Roman').fontSize(9)
        .text(`${variables.lugar ? `${variables.lugar}, ` : ''}${variables.fecha}`, 300, 46, { width: 208, align: 'right' });
    }
    documento.moveTo(54, 68).lineTo(558, 68).lineWidth(2).stroke('#2677a8');
    documento.x = documento.page.margins.left;
    documento.y = 86;
    texto(documento, titulos[codigo], { align: 'center', negrita: true, tamano: 12, color: '#1c5d86', characterSpacing: 0.5, espacio: 1 });

    if (codigo === 'PLANT-NOTA-OFICIAL') {
      texto(documento, `DESTINATARIO: ${variables.destinatario || '—'}\n${variables.cargo_destinatario || ''}\n${variables.institucion_destinatario || ''}`, { fontSize: 10 });
      texto(documento, `REFERENCIA: ${variables.asunto || '—'}`, { negrita: true });
      texto(documento, 'De mi mayor consideración:', {});
      texto(documento, variables.contenido, { align: 'justify', fontSize: 10 });
      texto(documento, 'Sin otro particular, me despido con las consideraciones más distinguidas.', {});
    } else if (codigo === 'PLANT-MEMO-INTERNO') {
      texto(documento, `A: ${variables.destinatario || '—'} - ${variables.cargo_destinatario || '—'}`);
      texto(documento, `DE: ${variables.remitente_nombre || '—'} - ${variables.remitente_cargo || '—'}`);
      texto(documento, `FECHA: ${variables.fecha || '—'}`);
      texto(documento, `ASUNTO: ${variables.asunto || '—'}`, { negrita: true });
      documento.moveTo(54, documento.y).lineTo(558, documento.y).lineWidth(0.8).stroke('#aab9c0');
      documento.x = documento.page.margins.left;
      documento.moveDown(0.8);
      texto(documento, variables.contenido, { align: 'justify', fontSize: 10 });
    } else {
      texto(documento, `FECHA: ${variables.fecha || '—'}`);
      texto(documento, `DE: ${variables.remitente_nombre || '—'} - ${variables.remitente_cargo || '—'}`);
      texto(documento, 'PARA: TODO EL PERSONAL INSTITUCIONAL');
      texto(documento, `ASUNTO: ${variables.asunto || '—'}`, { negrita: true });
      documento.moveTo(54, documento.y).lineTo(558, documento.y).lineWidth(0.8).stroke('#aab9c0');
      documento.x = documento.page.margins.left;
      documento.moveDown(0.8);
      texto(documento, variables.contenido, { align: 'justify', fontSize: 10 });
      texto(documento, 'Agradeciendo su atención y cumplimiento estricto.', {});
    }

    documento.moveDown(1.5);
    texto(documento, 'Atentamente,', { align: 'center' });
    documento.moveDown(1.8);
    texto(documento, '___________________________________', { align: 'center', espacio: 0 });
    texto(documento, variables.remitente_nombre, { align: 'center', negrita: true, espacio: 0 });
    texto(documento, variables.remitente_cargo, { align: 'center', espacio: 0 });
    documento.end();
  });

  const estadisticas = await fs.promises.stat(ruta);
  return {
    nombre_original: `${numeroNota}.pdf`,
    nombre_archivo: nombreArchivo,
    ruta_almacenamiento: ruta,
    mime_type: 'application/pdf',
    extension: '.pdf',
    tamano_bytes: estadisticas.size
  };
};

/**
 * Vista previa en tiempo real de una nota
 * POST /api/notas/previsualizar
 */
const generarDocxNota = async (nota, qrBuffer) => {
  const variables = nota.datos_variables || {};
  const codigo = nota.plantilla_codigo;
  const colorAzul = '1C5D86';
  const parrafo = (valor, opciones = {}) => new Paragraph({
    alignment: opciones.alignment || AlignmentType.LEFT,
    spacing: { before: opciones.before || 0, after: opciones.after ?? 150, line: 300 },
    children: [new TextRun({
      text: String(valor ?? ''),
      bold: opciones.bold || false,
      underline: opciones.underline ? {} : undefined,
      size: opciones.size || 22,
      color: opciones.color || '17252D',
      font: 'Times New Roman'
    })]
  });
  const bordes = {
    top: { style: 'single', size: 1, color: 'B7C5CC' },
    bottom: { style: 'single', size: 1, color: 'B7C5CC' },
    left: { style: 'single', size: 1, color: 'B7C5CC' },
    right: { style: 'single', size: 1, color: 'B7C5CC' },
    insideHorizontal: { style: 'single', size: 1, color: 'B7C5CC' },
    insideVertical: { style: 'single', size: 1, color: 'B7C5CC' }
  };
  const tabla = (filas, anchos = [2500, 7500]) => new Table({
    width: { size: 10000, type: WidthType.DXA },
    columnWidths: anchos,
    borders: bordes,
    rows: filas.map(([etiqueta, valor]) => new TableRow({ children: [
      new TableCell({
        width: { size: anchos[0], type: WidthType.DXA },
        shading: { fill: 'EDF3F6', type: ShadingType.CLEAR },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [parrafo(etiqueta, { bold: true, size: 20, after: 0 })]
      }),
      new TableCell({
        width: { size: anchos[1], type: WidthType.DXA },
        margins: { top: 100, bottom: 100, left: 120, right: 120 },
        children: [parrafo(valor, { size: 20, after: 0 })]
      })
    ]}))
  });

  const contenido = [
    parrafo('Ganesha', { bold: true, size: 48, color: colorAzul, after: 0 }),
    parrafo('CONSULTORES MULTIDISCIPLINARIOS', { bold: true, size: 15, color: '2677A8', after: 60 }),
    parrafo(`CITE: ${nota.numero_nota}`, { bold: true, alignment: AlignmentType.RIGHT, after: 0 }),
    parrafo(`${variables.lugar ? `${variables.lugar}, ` : ''}${variables.fecha || ''}`, { alignment: AlignmentType.RIGHT, after: 180 })
  ];

  if (codigo === 'GANESHA-NOTA-OFICIAL') {
    contenido.push(
      parrafo('Señores:', { after: 30 }),
      parrafo(variables.destinatario || '', { bold: true, after: 20 }),
      parrafo('Presente.-', { after: 180 }),
      parrafo(`REF.: ${variables.referencia || ''}`, { bold: true, underline: true, after: 150 }),
      parrafo('De mi consideración', { after: 140 }),
      parrafo(variables.cuerpo || '', { after: 180 })
    );
    const conceptos = [
      ['Auditoría Externa Financiera a Proyecto de Inversión Pública FDI', `1. ${variables.detalle_1 || ''}`],
      ['N° de comprobantes:', variables.comprobantes_1],
      ['Costo del servicio:', variables.costo_1],
      ['Auditoría Externa Financiera a Proyecto de Inversión Pública MMAyA-VMRHR', `2. ${variables.detalle_2 || ''}`],
      ['N° de comprobantes:', variables.comprobantes_2],
      ['Costo del servicio:', variables.costo_2],
      ['Plazo de ejecución:', variables.plazo],
      ['COSTO TOTAL DEL SERVICIO:', variables.costo_total]
    ];
    contenido.push(tabla([['CONCEPTO', 'DETALLE'], ...conceptos], [3600, 6400]));
    contenido.push(
      parrafo('La presente cotización comprende el pago de todos los impuestos vigentes en el país, a la fecha de presentación de la propuesta.', { before: 180 }),
      parrafo(variables.despedida || '', { after: 140 }),
      parrafo('Atentamente,', { alignment: AlignmentType.CENTER, after: 400 }),
      parrafo('___________________________________', { alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.firmante_nombre || '', { bold: true, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.firmante_cargo || '', { bold: true, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo('GANESHA LTDA.', { bold: true, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo('CONSULTORES MULTIDISCIPLINARIOS', { bold: true, size: 16, alignment: AlignmentType.CENTER })
    );
  } else if (codigo === 'PLANT-NOTA-OFICIAL') {
    contenido.push(
      parrafo('NOTA OFICIAL INSTITUCIONAL', { bold: true, size: 26, color: colorAzul, alignment: AlignmentType.CENTER }),
      tabla([
        ['DESTINATARIO', `${variables.destinatario || ''}\n${variables.cargo_destinatario || ''}\n${variables.institucion_destinatario || ''}`],
        ['REFERENCIA', variables.asunto]
      ]),
      parrafo('De mi mayor consideración:', { before: 180 }),
      parrafo(variables.contenido || ''),
      parrafo('Sin otro particular, me despido con las consideraciones más distinguidas.', { after: 400 }),
      parrafo('___________________________________', { alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.remitente_nombre || '', { bold: true, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.remitente_cargo || '', { alignment: AlignmentType.CENTER })
    );
  } else if (codigo === 'PLANT-MEMO-INTERNO') {
    contenido.push(
      parrafo('MEMORÁNDUM INTERNO', { bold: true, size: 26, color: colorAzul, alignment: AlignmentType.CENTER }),
      tabla([
        ['A', `${variables.destinatario || ''} - ${variables.cargo_destinatario || ''}`],
        ['DE', `${variables.remitente_nombre || ''} - ${variables.remitente_cargo || ''}`],
        ['FECHA', variables.fecha],
        ['ASUNTO', variables.asunto]
      ]),
      parrafo(variables.contenido || '', { before: 180 }),
      parrafo('___________________________________', { before: 400, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.remitente_nombre || '', { bold: true, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.remitente_cargo || '', { alignment: AlignmentType.CENTER })
    );
  } else if (codigo === 'PLANT-CIRCULAR-INT') {
    contenido.push(
      parrafo('CIRCULAR INTERNA', { bold: true, size: 26, color: colorAzul, alignment: AlignmentType.CENTER }),
      tabla([
        ['FECHA', variables.fecha],
        ['DE', `${variables.remitente_nombre || ''} - ${variables.remitente_cargo || ''}`],
        ['PARA', 'TODO EL PERSONAL INSTITUCIONAL'],
        ['ASUNTO', variables.asunto]
      ]),
      parrafo(variables.contenido || '', { before: 180 }),
      parrafo('Agradeciendo su atención y cumplimiento estricto.'),
      parrafo('Atentamente,', { before: 140, alignment: AlignmentType.CENTER }),
      parrafo('___________________________________', { before: 300, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.remitente_nombre || '', { bold: true, alignment: AlignmentType.CENTER, after: 0 }),
      parrafo(variables.remitente_cargo || '', { alignment: AlignmentType.CENTER })
    );
  } else {
    contenido.push(...htmlToText(nota.contenido_renderizado || '').split('\n').map(linea => parrafo(linea)));
  }

  const documento = new Document({
    sections: [{
      properties: { page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 900, right: 1080, bottom: 1350, left: 1080 }
      } },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new ImageRun({ data: qrBuffer, transformation: { width: 58, height: 58 } })]
      })] }) },
      children: contenido
    }]
  });
  return Packer.toBuffer(documento);
};

const previsualizarNota = async (req, res) => {
  try {
    const { id_plantilla, datos_variables = {} } = req.body;

    if (!id_plantilla) {
      return badRequest(res, 'Debe especificar el ID de la plantilla a previsualizar.');
    }

    const plantRes = await query('SELECT codigo, cuerpo_plantilla, titulo, tipo FROM plantillas_notas WHERE id_plantilla = $1', [id_plantilla]);
    if (plantRes.rows.length === 0) {
      return notFound(res, 'Plantilla no encontrada.');
    }

    const { codigo, cuerpo_plantilla, titulo, tipo } = plantRes.rows[0];
    const contenidoRenderizado = ['PLANT-NOTA-OFICIAL', 'PLANT-MEMO-INTERNO', 'PLANT-CIRCULAR-INT'].includes(codigo)
      ? renderizarDocumentoInstitucional(codigo, datos_variables.numero_nota || datos_variables.cite || 'Pendiente', datos_variables)
      : renderizarContenido(cuerpo_plantilla, datos_variables);

    return success(res, {
      titulo,
      tipo,
      contenido_renderizado: contenidoRenderizado
    }, 'Vista previa generada.');
  } catch (error) {
    console.error('[PREVISUALIZAR NOTA ERROR]:', error);
    return serverError(res, 'Error al previsualizar nota.', error);
  }
};

/**
 * Emitir y guardar nota generada (con asignación de número y opción de despacho)
 * POST /api/notas/generar
 */
const generarNota = async (req, res) => {
  const client = await getClient();
  let rutaPdfGenerado;
  try {
    const {
      id_plantilla,
      numero_nota,
      datos_variables = {},
      despachar_como_entregada = false,
      id_area_remitente,
      responsable_remitente,
      medio_entrega = 'Entrega física'
    } = req.body;

    if (!id_plantilla) {
      return badRequest(res, 'Debe especificar la plantilla para generar la nota.');
    }
    if (despachar_como_entregada && (!id_area_remitente || !responsable_remitente)) {
      return badRequest(res, 'Para registrar como salida debe indicar id_area_remitente y responsable_remitente.');
    }

    await client.query('BEGIN');

    // 1. Obtener plantilla
    const plantRes = await client.query(
      'SELECT codigo, cuerpo_plantilla, titulo, tipo FROM plantillas_notas WHERE id_plantilla = $1 AND activo = TRUE',
      [id_plantilla]
    );
    if (plantRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'La plantilla seleccionada no existe o se encuentra inactiva.');
    }
    const { codigo, cuerpo_plantilla, titulo } = plantRes.rows[0];

    // 2. El CITE manual se fija como número oficial al emitir la nota.
    const anio = new Date().getFullYear();
    const citeIngresado = String(numero_nota || '').trim()
      || String(datos_variables.cite || '').trim()
      || String(datos_variables.numero_nota || '').trim();
    const citeObligatorio = codigo === 'GANESHA-NOTA-OFICIAL'
      || ['PLANT-NOTA-OFICIAL', 'PLANT-MEMO-INTERNO', 'PLANT-CIRCULAR-INT'].includes(codigo);
    if (citeObligatorio && !citeIngresado) {
      await client.query('ROLLBACK');
      return badRequest(res, 'Debe ingresar el CITE antes de generar el documento.');
    }
    const numeroNotaFinal = citeIngresado
      ? citeIngresado
      : await generarCodigoCorrelativo(client, 'NOTA', anio);

    // El CITE y numero_nota representan el mismo identificador oficial.
    const variablesConNumero = {
      ...datos_variables,
      numero_nota: numeroNotaFinal,
      cite: numeroNotaFinal
    };

    // 3. Renderizar contenido
    const contenidoRenderizado = ['PLANT-NOTA-OFICIAL', 'PLANT-MEMO-INTERNO', 'PLANT-CIRCULAR-INT'].includes(codigo)
      ? renderizarDocumentoInstitucional(codigo, numeroNotaFinal, variablesConNumero)
      : renderizarContenido(cuerpo_plantilla, variablesConNumero);
    const limiteQrRes = await client.query(
      'SELECT limite_verificaciones FROM configuracion_qr WHERE id_configuracion = 1'
    );
    const limiteVerificacionesQr = Number(limiteQrRes.rows[0]?.limite_verificaciones || 3);
    const insertNotaSql = `
      INSERT INTO notas_generadas (
        id_plantilla, numero_nota, datos_variables, contenido_renderizado,
        id_entregada, id_usuario_genero, limite_verificaciones_qr
      ) VALUES ($1, $2, $3, $4, NULL, $5, $6)
      RETURNING *
    `;
    const insertNotaRes = await client.query(insertNotaSql, [
      id_plantilla,
      numeroNotaFinal,
      JSON.stringify(variablesConNumero),
      contenidoRenderizado,
      req.user.id_usuario,
      limiteVerificacionesQr
    ]);
    const idNota = insertNotaRes.rows[0].id_nota;
    const urlVerificacion = `${getUrlBaseVerificacion(req)}/verificar/${idNota}`;
    await client.query('UPDATE notas_generadas SET url_verificacion = $1 WHERE id_nota = $2', [urlVerificacion, idNota]);
    const qrBuffer = await QRCode.toBuffer(urlVerificacion, { type: 'png', errorCorrectionLevel: 'H', margin: 1, width: 240 });
    const pdfGenerado = codigo === 'GANESHA-NOTA-OFICIAL'
      ? await generarPdfNotaGanesha(numeroNotaFinal, variablesConNumero, qrBuffer)
      : ['PLANT-NOTA-OFICIAL', 'PLANT-MEMO-INTERNO', 'PLANT-CIRCULAR-INT'].includes(codigo)
        ? await generarPdfNotaInstitucional(numeroNotaFinal, codigo, variablesConNumero, qrBuffer)
        : await generarPdfNota(numeroNotaFinal, contenidoRenderizado, qrBuffer);
    rutaPdfGenerado = pdfGenerado.ruta_almacenamiento;

    let idEntregadaAsociada = null;

    // 4. Si el usuario solicitó registrar directamente la correspondencia de salida
    if (despachar_como_entregada) {
      const codigoSalida = await generarCodigoCorrelativo(client, 'ENTREGADA', anio);

      // Buscar id_tipo_doc correspondiente a 'Carta' u 'Oficio'
      const tipoDocRes = await client.query("SELECT id_tipo_doc FROM tipos_documento WHERE nombre ILIKE '%nota%' OR nombre ILIKE '%carta%' LIMIT 1");
      const idTipoDoc = tipoDocRes.rows.length > 0 ? tipoDocRes.rows[0].id_tipo_doc : 2;

      const MAPA_MEDIOS = {
        'entrega fisica': 'Entrega física',
        'entrega física': 'Entrega física',
        'correo electronico': 'Correo electrónico',
        'correo electrónico': 'Correo electrónico',
        'mensajeria': 'Mensajería',
        'mensajería': 'Mensajería',
        'otro': 'Otro'
      };
      const medioNormalizado = MAPA_MEDIOS[medio_entrega.toLowerCase()] || 'Entrega física';

      const insertEntregadaSql = `
        INSERT INTO correspondencia_entregada (
          codigo,
          numero_nota,
          fecha_emision,
          hora_emision,
          destinatario,
          institucion_destinatario,
          cargo_destinatario,
          asunto,
          id_tipo_doc,
          id_area_remitente,
          responsable_remitente,
          medio_entrega,
          estado,
          observaciones,
          id_usuario_registro
        ) VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, $4, $5, $6, $7, $8, $9, $10, 'Emitido', $11, $12)
        RETURNING id_entregada
      `;

      const entregadaRes = await client.query(insertEntregadaSql, [
        codigoSalida,
        numeroNotaFinal,
        variablesConNumero.destinatario || 'A quien corresponda',
        variablesConNumero.institucion_destinatario || null,
        variablesConNumero.cargo_destinatario || null,
        variablesConNumero.asunto || titulo,
        idTipoDoc,
        parseInt(id_area_remitente, 10),
        responsable_remitente.trim(),
        medioNormalizado,
        `Nota emitida automáticamente desde plantilla: ${titulo}`,
        req.user.id_usuario
      ]);

      idEntregadaAsociada = entregadaRes.rows[0].id_entregada;

      // Hito en seguimiento de salida
      await client.query(
        "INSERT INTO seguimientos (id_entregada, estado_anterior, estado_nuevo, accion, descripcion, id_usuario) VALUES ($1, NULL, 'Emitido', 'EMISION_DESPACHO', $2, $3)",
        [idEntregadaAsociada, `Nota generada (${numeroNotaFinal}) y lista para despacho`, req.user.id_usuario]
      );
    }

    if (idEntregadaAsociada) {
      await client.query('UPDATE notas_generadas SET id_entregada = $1 WHERE id_nota = $2', [idEntregadaAsociada, idNota]);
    }

    await client.query(`
      INSERT INTO documentos_adjuntos (
        id_nota, id_entregada, nombre_original, nombre_archivo,
        ruta_almacenamiento, mime_type, extension, tamano_bytes, id_usuario_subio
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      idNota,
      idEntregadaAsociada,
      pdfGenerado.nombre_original,
      pdfGenerado.nombre_archivo,
      pdfGenerado.ruta_almacenamiento,
      pdfGenerado.mime_type,
      pdfGenerado.extension,
      pdfGenerado.tamano_bytes,
      req.user.id_usuario
    ]);

    await client.query('COMMIT');

    const nuevaNota = {
      ...insertNotaRes.rows[0],
      id_entregada: idEntregadaAsociada,
      url_verificacion: urlVerificacion,
      codigo_qr: `data:image/png;base64,${qrBuffer.toString('base64')}`
    };

    // 6. Auditoría
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'GENERAR_NOTA',
      modulo: 'Generador de Notas',
      registro_afectado: numeroNotaFinal,
      detalles: `Emisión de nota oficial N° ${numeroNotaFinal} mediante plantilla "${titulo}"`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_usuario_destino: req.user.id_usuario,
      tipo: 'NOTA_COMPLETADA',
      titulo: 'Nota de respuesta completada',
      mensaje: `La nota N° ${numeroNotaFinal} fue generada exitosamente${idEntregadaAsociada ? ' y registrada como correspondencia de salida.' : '.'}`,
      referencia_codigo: numeroNotaFinal,
      id_recibida: null,
      id_entregada: idEntregadaAsociada
    });

    return created(res, nuevaNota, `Nota ${numeroNotaFinal} generada exitosamente.`);
  } catch (error) {
    await client.query('ROLLBACK');
    if (rutaPdfGenerado) await fs.promises.unlink(rutaPdfGenerado).catch(() => {});
    console.error('[GENERAR NOTA ERROR]:', error);
    if (error.code === '23505' && error.constraint === 'notas_generadas_numero_nota_key') {
      return badRequest(res, 'Ya existe una nota registrada con ese CITE. Ingrese un CITE único.');
    }
    return serverError(res, 'Error al generar la nota oficial.', error);
  } finally {
    client.release();
  }
};

/**
 * Registrar una nota previamente generada como correspondencia entregada.
 * POST /api/notas/:id/registrar-entregada
 */
const registrarNotaComoEntregada = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { id_area_remitente, responsable_remitente, medio_entrega = 'Entrega física' } = req.body;

    if (!id_area_remitente || !responsable_remitente) {
      return badRequest(res, 'Debe indicar el área remitente y el responsable remitente.');
    }

    await client.query('BEGIN');

    const notaRes = await client.query(`
      SELECT ng.id_nota, ng.numero_nota, ng.id_entregada, ng.datos_variables,
             p.titulo, p.id_plantilla
      FROM notas_generadas ng
      INNER JOIN plantillas_notas p ON ng.id_plantilla = p.id_plantilla
      WHERE ng.id_nota = $1
      FOR UPDATE
    `, [id]);

    if (notaRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'La nota generada no fue encontrada.');
    }
    const nota = notaRes.rows[0];
    if (nota.id_entregada) {
      await client.query('ROLLBACK');
      return badRequest(res, 'Esta nota ya está registrada como correspondencia entregada.');
    }

    const variables = nota.datos_variables || {};
    const anio = new Date().getFullYear();
    const codigoSalida = await generarCodigoCorrelativo(client, 'ENTREGADA', anio);
    const tipoDocRes = await client.query("SELECT id_tipo_doc FROM tipos_documento WHERE nombre ILIKE '%nota%' OR nombre ILIKE '%carta%' OR nombre ILIKE '%oficio%' LIMIT 1");
    const idTipoDoc = tipoDocRes.rows.length > 0 ? tipoDocRes.rows[0].id_tipo_doc : 2;
    const medios = {
      'entrega fisica': 'Entrega física', 'entrega física': 'Entrega física',
      'correo electronico': 'Correo electrónico', 'correo electrónico': 'Correo electrónico',
      'mensajeria': 'Mensajería', 'mensajería': 'Mensajería', otro: 'Otro'
    };
    const medioNormalizado = medios[String(medio_entrega).trim().toLowerCase()] || 'Entrega física';

    const salidaRes = await client.query(`
      INSERT INTO correspondencia_entregada (
        codigo, numero_nota, fecha_emision, hora_emision, destinatario,
        institucion_destinatario, cargo_destinatario, asunto, id_tipo_doc,
        id_area_remitente, responsable_remitente, medio_entrega, estado,
        observaciones, id_usuario_registro
      ) VALUES ($1, $2, CURRENT_DATE, CURRENT_TIME, $3, $4, $5, $6, $7, $8, $9, $10, 'Emitido', $11, $12)
      RETURNING id_entregada
    `, [
      codigoSalida,
      nota.numero_nota,
      variables.destinatario || 'A quien corresponda',
      variables.institucion_destinatario || null,
      variables.cargo_destinatario || null,
      variables.asunto || nota.titulo,
      idTipoDoc,
      parseInt(id_area_remitente, 10),
      responsable_remitente.trim(),
      medioNormalizado,
      `Nota generada desde plantilla: ${nota.titulo}`,
      req.user.id_usuario
    ]);
    const idEntregada = salidaRes.rows[0].id_entregada;

    await client.query(
      "UPDATE notas_generadas SET id_entregada = $1 WHERE id_nota = $2",
      [idEntregada, id]
    );
    await client.query(
      "UPDATE documentos_adjuntos SET id_entregada = $1 WHERE id_nota = $2",
      [idEntregada, id]
    );
    await client.query(
      "INSERT INTO seguimientos (id_entregada, estado_anterior, estado_nuevo, accion, descripcion, id_usuario) VALUES ($1, NULL, 'Emitido', 'EMISION_DESPACHO', $2, $3)",
      [idEntregada, `Nota ${nota.numero_nota} registrada como correspondencia entregada`, req.user.id_usuario]
    );

    await client.query('COMMIT');
    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'REGISTRAR',
      modulo: 'Correspondencia Entregada',
      registro_afectado: codigoSalida,
      detalles: `Nota ${nota.numero_nota} asociada como salida`,
      req
    });

    await crearNotificacion({
      id_usuario_origen: req.user.id_usuario,
      id_usuario_destino: req.user.id_usuario,
      tipo: 'NOTA_COMPLETADA',
      titulo: 'Nota de respuesta completada',
      mensaje: `La nota N° ${nota.numero_nota} fue registrada como correspondencia de salida (${codigoSalida}).`,
      referencia_codigo: nota.numero_nota,
      id_recibida: null,
      id_entregada: idEntregada
    });

    return success(res, { id_nota: id, id_entregada: idEntregada, codigo: codigoSalida }, 'Nota registrada como correspondencia entregada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[REGISTRAR NOTA COMO ENTREGADA ERROR]:', error);
    return serverError(res, 'Error al registrar la nota como correspondencia entregada.', error);
  } finally {
    client.release();
  }
};

/**
 * Listar notas oficiales generadas
 * GET /api/notas
 */
const getNotas = async (req, res) => {
  try {
    const { busqueda = '', pagina = 1, limite = 10 } = req.query;

    const page = Math.max(1, parseInt(pagina, 10));
    const limit = Math.max(1, Math.min(100, parseInt(limite, 10)));
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    if (busqueda && busqueda.trim()) {
      conditions.push(`(
        LOWER(ng.numero_nota) LIKE LOWER($${paramIdx}) OR
        LOWER(p.titulo) LIKE LOWER($${paramIdx}) OR
        LOWER(u.nombre_completo) LIKE LOWER($${paramIdx})
      )`);
      params.push(`%${busqueda.trim()}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `
      SELECT COUNT(*) AS total 
      FROM notas_generadas ng
      INNER JOIN plantillas_notas p ON ng.id_plantilla = p.id_plantilla
      INNER JOIN usuarios u ON ng.id_usuario_genero = u.id_usuario
      ${whereClause}
    `;
    const countRes = await query(countSql, params);
    const total = parseInt(countRes.rows[0].total, 10);

    const dataSql = `
      SELECT 
        ng.id_nota,
        ng.numero_nota,
        ng.fecha_generacion,
        ng.datos_variables,
        ng.id_entregada,
        ce.codigo AS correspondencia_entregada_codigo,
        p.id_plantilla,
        p.titulo AS plantilla_titulo,
        p.tipo AS plantilla_tipo,
        u.nombre_completo AS usuario_genero_nombre
      FROM notas_generadas ng
      INNER JOIN plantillas_notas p ON ng.id_plantilla = p.id_plantilla
      INNER JOIN usuarios u ON ng.id_usuario_genero = u.id_usuario
      LEFT JOIN correspondencia_entregada ce ON ng.id_entregada = ce.id_entregada
      ${whereClause}
      ORDER BY ng.id_nota DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
    `;

    const dataParams = [...params, limit, offset];
    const dataRes = await query(dataSql, dataParams);

    return success(res, {
      notas: dataRes.rows,
      paginacion: {
        total,
        pagina: page,
        limite: limit,
        total_paginas: Math.ceil(total / limit)
      }
    }, 'Notas obtenidas correctamente.');
  } catch (error) {
    console.error('[GET NOTAS ERROR]:', error);
    return serverError(res, 'Error al consultar notas.', error);
  }
};

/**
 * Obtener detalle y contenido completo de una nota para visualización o impresión
 * GET /api/notas/:id
 */
const getNotaById = async (req, res) => {
  try {
    const { id } = req.params;

    const sql = `
      SELECT 
        ng.*,
        p.titulo AS plantilla_titulo,
        p.tipo AS plantilla_tipo,
        u.nombre_completo AS usuario_genero_nombre,
        ce.codigo AS correspondencia_entregada_codigo
      FROM notas_generadas ng
      INNER JOIN plantillas_notas p ON ng.id_plantilla = p.id_plantilla
      INNER JOIN usuarios u ON ng.id_usuario_genero = u.id_usuario
      LEFT JOIN correspondencia_entregada ce ON ng.id_entregada = ce.id_entregada
      WHERE ng.id_nota = $1
    `;
    const result = await query(sql, [id]);

    if (result.rows.length === 0) {
      return notFound(res, 'Nota no encontrada.');
    }

    return success(res, result.rows[0], 'Detalle de nota obtenido.');
  } catch (error) {
    return serverError(res, 'Error al consultar la nota.', error);
  }
};

const descargarPdfNota = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return notFound(res, 'Nota no encontrada.');

    const result = await query(`
      SELECT ng.numero_nota, da.ruta_almacenamiento
      FROM notas_generadas ng
      INNER JOIN documentos_adjuntos da ON da.id_nota = ng.id_nota
      WHERE ng.id_nota = $1 AND LOWER(da.extension) = '.pdf'
      ORDER BY da.id_documento DESC
      LIMIT 1
    `, [id]);
    if (result.rows.length === 0) return notFound(res, 'No se encontró el PDF archivado para esta nota.');

    const archivo = result.rows[0];
    await fs.promises.access(archivo.ruta_almacenamiento);
    const nombre = `${String(archivo.numero_nota).replace(/[^\w.-]/g, '_')}.pdf`;
    return res.download(archivo.ruta_almacenamiento, nombre);
  } catch (error) {
    if (error.code === 'ENOENT') return notFound(res, 'El archivo PDF de esta nota no está disponible.');
    console.error('[DESCARGAR PDF NOTA ERROR]:', error);
    return serverError(res, 'No se pudo descargar el PDF de la nota.', error);
  }
};

const descargarWordNota = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return notFound(res, 'Nota no encontrada.');

    const result = await query(`
      SELECT ng.*, p.codigo AS plantilla_codigo, p.titulo AS plantilla_titulo
      FROM notas_generadas ng
      INNER JOIN plantillas_notas p ON p.id_plantilla = ng.id_plantilla
      WHERE ng.id_nota = $1
    `, [id]);
    if (result.rows.length === 0) return notFound(res, 'Nota no encontrada.');

    const nota = result.rows[0];
    const urlVerificacion = nota.url_verificacion || `${getUrlBaseVerificacion(req)}/verificar/${nota.id_nota}`;
    const qrBuffer = await QRCode.toBuffer(urlVerificacion, {
      type: 'png', errorCorrectionLevel: 'H', margin: 1, width: 240
    });
    const archivo = await generarDocxNota(nota, qrBuffer);
    const nombre = `${String(nota.numero_nota).replace(/[^\w.-]/g, '_')}.docx`;
    res.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.attachment(nombre);
    return res.send(archivo);
  } catch (error) {
    console.error('[DESCARGAR WORD NOTA ERROR]:', error);
    return serverError(res, 'No se pudo generar el documento Word de la nota.', error);
  }
};

const getLimiteVerificacionesNota = async (req, res) => {
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return notFound(res, 'Nota no encontrada.');

    const result = await query(`
      SELECT id_nota, numero_nota, verificaciones_qr, limite_verificaciones_qr
      FROM notas_generadas
      WHERE id_nota = $1
    `, [id]);
    if (result.rows.length === 0) return notFound(res, 'Nota no encontrada.');

    return success(res, result.rows[0], 'Límite QR de la nota obtenido.');
  } catch (error) {
    return serverError(res, 'No se pudo consultar el límite QR de la nota.', error);
  }
};

const actualizarLimiteVerificacionesNota = async (req, res) => {
  try {
    const { id } = req.params;
    const limite = Number(req.body.limite_verificaciones);
    if (!/^\d+$/.test(id)) return notFound(res, 'Nota no encontrada.');
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 2147483647) {
      return badRequest(res, 'El límite debe ser un número entero positivo no mayor a 2147483647.');
    }

    const result = await query(`
      UPDATE notas_generadas
      SET limite_verificaciones_qr = $1
      WHERE id_nota = $2
      RETURNING id_nota, numero_nota, verificaciones_qr, limite_verificaciones_qr
    `, [limite, id]);
    if (result.rows.length === 0) return notFound(res, 'Nota no encontrada.');

    await registrarAuditoria({
      id_usuario: req.user.id_usuario,
      username: req.user.username,
      accion: 'MODIFICAR',
      modulo: 'Configuración QR',
      registro_afectado: result.rows[0].numero_nota,
      detalles: `Límite individual del QR configurado en ${limite} verificaciones`,
      req
    });

    return success(res, result.rows[0], 'Límite individual del QR actualizado.');
  } catch (error) {
    return serverError(res, 'No se pudo actualizar el límite QR de la nota.', error);
  }
};

const verificarNota = async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) return notFound(res, 'Nota no encontrada.');

    await client.query('BEGIN');
    const result = await client.query(`
      SELECT ng.id_nota, ng.numero_nota, ng.fecha_generacion, ng.datos_variables,
        ng.contenido_renderizado, ng.verificaciones_qr, ng.limite_verificaciones_qr,
        p.titulo AS plantilla_titulo, p.codigo AS plantilla_codigo
      FROM notas_generadas ng
      INNER JOIN plantillas_notas p ON p.id_plantilla = ng.id_plantilla
      WHERE ng.id_nota = $1
      FOR UPDATE OF ng
    `, [id]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return notFound(res, 'Nota no encontrada.');
    }

    const nota = result.rows[0];
  const limite = Number(nota.limite_verificaciones_qr);
    if (nota.verificaciones_qr >= limite) {
      await client.query('ROLLBACK');
      return res.status(429).json({
        success: false,
        message: 'Se alcanzó el límite de verificaciones permitido para este código QR.',
        data: {
          verificaciones_realizadas: Number(nota.verificaciones_qr),
          limite_verificaciones: Number(limite),
          verificaciones_restantes: 0
        }
      });
    }

    const actualizacion = await client.query(`
      UPDATE notas_generadas
      SET verificaciones_qr = verificaciones_qr + 1
      WHERE id_nota = $1
      RETURNING verificaciones_qr
    `, [id]);
    const realizadas = Number(actualizacion.rows[0].verificaciones_qr);
    await client.query('COMMIT');

    await registrarAuditoria({
      username: 'QR_PUBLICO',
      accion: 'VERIFICAR_QR',
      modulo: 'Verificación QR',
      registro_afectado: nota.numero_nota,
      detalles: `Verificación ${realizadas} de ${limite}`,
      req
    });

    return success(res, {
      ...nota,
      verificaciones_realizadas: realizadas,
      limite_verificaciones: limite,
      verificaciones_restantes: limite - realizadas
    }, 'Nota verificada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VERIFICAR NOTA ERROR]:', error);
    return serverError(res, 'No se pudo verificar la nota.', error);
  } finally {
    client.release();
  }
};

module.exports = {
  previsualizarNota,
  generarNota,
  registrarNotaComoEntregada,
  getNotas,
  getNotaById,
  getLimiteVerificacionesNota,
  actualizarLimiteVerificacionesNota,
  generarDocxNota,
  descargarPdfNota,
  descargarWordNota,
  verificarNota,
  generarPdfNotaGanesha
};
