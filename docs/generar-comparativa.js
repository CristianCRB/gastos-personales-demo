import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  TableLayoutType, PageOrientation, convertInchesToTwip,
} from 'docx';
import * as fs from 'node:fs';

// ── helpers ──────────────────────────────────────────────────

const COLOR_WHITE = 'FFFFFF';
const COLOR_HEADER_BG = '1F2937';
const COLOR_ROW_ALT = 'F3F4F6';
const COLOR_GREEN = '059669';
const COLOR_RED = 'DC2626';
const COLOR_AMBER = 'D97706';
const COLOR_BORDER = 'D1D5DB';

function headerCell(text: string, widthPct: number): TableCell {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    shading: { fill: COLOR_HEADER_BG, type: ShadingType.CLEAR },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: COLOR_WHITE, font: 'Calibri', size: 20 })] })],
  });
}

function dataCell(text: string, opts?: { bold?: boolean; color?: string; widthPct?: number; shading?: string }): TableCell {
  return new TableCell({
    width: opts?.widthPct ? { size: opts.widthPct, type: WidthType.PERCENTAGE } : undefined,
    shading: opts?.shading ? { fill: opts.shading, type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({
      spacing: { before: 40, after: 40 },
      children: [new TextRun({ text, font: 'Calibri', size: 20, bold: opts?.bold, color: opts?.color })],
    })],
  });
}

function tableBorder(): { style: BorderStyle; size: number; color: string } {
  return { style: BorderStyle.SINGLE, size: 1, color: COLOR_BORDER };
}

// ── build document ───────────────────────────────────────────

async function build(): Promise<void> {
  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, color: '111827' } },
        heading1: { run: { font: 'Calibri', bold: true, size: 32, color: '1F2937' } },
        heading2: { run: { font: 'Calibri', bold: true, size: 26, color: '1F2937' } },
        heading3: { run: { font: 'Calibri', bold: true, size: 22, color: '374151' } },
      },
    },
    sections: [{
      properties: {
        page: {
          margin: { top: convertInchesToTwip(0.8), bottom: convertInchesToTwip(0.8), left: convertInchesToTwip(0.9), right: convertInchesToTwip(0.9) },
        },
      },
      children: [

        // ═══════════════════════════════════════════════════════
        // TITLE
        // ═══════════════════════════════════════════════════════
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [new TextRun({ text: 'Comparativa Gemini vs OpenRouter', bold: true, font: 'Calibri', size: 40, color: '1F2937' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'ExpenseFlow — Mayo 2026', font: 'Calibri', size: 24, color: '6B7280' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
          border: { bottom: tableBorder() },
          children: [new TextRun({ text: 'Análisis de costos, límites y viabilidad para procesamiento de facturas vía IA', font: 'Calibri', size: 22, color: '9CA3AF', italics: true })],
        }),

        // ═══════════════════════════════════════════════════════
        // 1. CONTEXTO
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: '1. Contexto Actual' })] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: 'La aplicación ExpenseFlow usa Gemini 2.5 Flash para extraer datos de facturas desde imágenes enviadas por WhatsApp. Actualmente soporta hasta 3 API keys (GEMINI_API_KEY, _2, _3) con rotación solo en errores 429 y un rate limiter global de 50 requests/60s.', font: 'Calibri', size: 22 })],
        }),

        // ═══════════════════════════════════════════════════════
        // 2. — GEMINI FREE vs OPENROUTER FREE
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: '2. Gemini Free vs OpenRouter Free' })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: '2.1 Tabla comparativa' })] }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell('Aspecto', 25), headerCell('Gemini Free', 37.5), headerCell('OpenRouter Free', 37.5)] }),
            ['Modelo disponible', 'gemini-2.5-flash directo', 'Solo modelos :free (Gemma, DeepSeek, Mistral). Gemini 2.5 Flash NO está disponible'].map((t, i) => dataCell(t, { widthPct: i === 0 ? 25 : 37.5, bold: i === 0, shading: i === 1 ? COLOR_ROW_ALT : undefined })),
            ['Costo por token', '$0 — input y output gratuitos', '$0 — solo modelos :free'],
            ['Rate limit', '~10 RPM / ~250 RPD (varía por proyecto)', '20 RPM / 50 req/día (< $10) o 1.000/día (≥ $10)', ,],
            ['Calidad OCR', 'Excelente — probada con facturas colombianas', 'Variable — modelos gratuitos rinden inferior'],
            ['Entren. con tus datos', 'Sí — Google puede usarlos para mejorar', 'Depende del proveedor del modelo'],
            ['Tarjeta de crédito', 'No necesaria', 'No necesaria'],
            ['¿Sirve para producción?', 'Limitado — rate limits ajustados para uso continuo', 'No — 50 req/día y modelos de baja calidad'],
          ].map((row, ri) => new TableRow({
            children: row.map((cell, ci) => dataCell(cell, {
              widthPct: ci === 0 ? 25 : 37.5,
              bold: ci === 0,
              shading: ri % 2 === 0 ? COLOR_ROW_ALT : undefined,
            })),
          })),
        }),

        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Veredicto: ', bold: true }), new TextRun({ text: 'Gemini Free es claramente superior porque te da acceso directo a Gemini 2.5 Flash sin costo. OpenRouter Free no te permite usar Gemini.', font: 'Calibri', size: 22 })],
        }),

        // ═══════════════════════════════════════════════════════
        // 2.2 — FREE TIER LIMITS
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: '2.2 ¿Alcanza el free para tu app?' })] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Cada factura procesada consume ~40.000 tokens de entrada (imagen) + ~200 de salida (JSON). Con 250 requests/día en Gemini Free:', font: 'Calibri', size: 22 })],
        }),
        new Paragraph({
          spacing: { after: 120 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Límite diario: ~250 facturas/día → ~7.500 facturas/mes sin pagar un peso' })],
        }),
        new Paragraph({
          spacing: { after: 120 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Tokens por factura: ~10.000.000 tokens/mes (muy por debajo del límite de 250.000 TPM)' })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Conclusión: para el volumen típico de facturas vía WhatsApp, Gemini Free es suficiente el 99% del tiempo.' })],
        }),

        // ═══════════════════════════════════════════════════════
        // 3. — GEMINI PAGO vs OPENROUTER PAGO
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: '3. Gemini Pago (Tier 1) vs OpenRouter Pago' })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: '3.1 Tabla comparativa' })] }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell('Aspecto', 25), headerCell('Gemini Pago', 37.5), headerCell('OpenRouter Pago', 37.5)] }),
            ...([
              ['Costo Gemini 2.5 Flash', 'Input: $0.15/M tok.\nOutput: $0.60/M tok.', 'Mismo precio (sin markup en inferencia)'],
              ['Costo por factura típica', '~$0.0061\n(40K imagen + 200 texto)', '~$0.0065\n(mismo + 5,5% comisión al comprar créditos)'],
              ['1.000 facturas/mes', '~$6,10', '~$6,45'],
              ['10.000 facturas/mes', '~$61', '~$64'],
              ['100.000 facturas/mes', '~$610', '~$644'],
              ['Rate limits', '3.000.000 TPM\n(~3.000 facturas/min)', 'Sin límites de plataforma (con $10+ en créditos)'],
              ['Comisión', '0%', '5,5% al comprar créditos (una sola vez)'],
              ['Facturación', 'Pay-as-you-go directo', 'Compra de créditos (mín. ~$0,80/transacción)'],
              ['Techo de gasto', '$250/mes (Tier 1)', 'Sin techo'],
              ['Failover automático', 'No — si Google cae, no hay API', 'Sí — OpenRouter redirige a otro proveedor'],
              ['Datos para training', 'No', 'No'],
              ['Modelos adicionales', 'Solo Gemini', '300+ modelos (Claude, GPT, Llama, etc.)'],
              ['Configuración', '1 API key en .env', '1 API key en .env'],
            ] as [string, string, string][]).map((row, ri) => new TableRow({
              children: row.map((cell, ci) => dataCell(cell, {
                widthPct: ci === 0 ? 25 : 37.5,
                bold: ci === 0,
                shading: ri % 2 === 0 ? COLOR_ROW_ALT : undefined,
              })),
            })),
          ],
        }),

        // ═══════════════════════════════════════════════════════
        // 3.2 — COST BREAKDOWN
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: '3.2 Desglose de costos por factura' })] }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Estimación basada en una foto de factura típica (~500 KB JPEG):', font: 'Calibri', size: 22, italics: true })],
        }),
        new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: 'Tokens de imagen (1024×768): ~40.000 tokens' })] }),
        new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: 'Tokens de prompt + respuesta: ~400 tokens' })] }),
        new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: 'Total por request: ~40.400 tokens' })] }),
        new Paragraph({ spacing: { after: 40 }, bullet: { level: 0 }, children: [new TextRun({ text: 'Costo: (40.000 × $0,15 + 400 × $0,60) / 1.000.000 = ~$0,0061' })] }),
        new Paragraph({ spacing: { after: 120 }, bullet: { level: 0 }, children: [new TextRun({ text: 'Con OpenRouter: $0,0061 + 5,5% comisión = ~$0,0065', bold: true })] }),

        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: 'La diferencia de $0,0004 por factura es irrelevante. El factor decisivo no es el costo.', font: 'Calibri', size: 22, bold: true })],
        }),

        // ═══════════════════════════════════════════════════════
        // 4. — RECOMENDACIÓN
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: '4. Recomendación Final' })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: 'Según el volumen de tu app' })] }),

        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ tableHeader: true, children: [headerCell('Escenario', 28), headerCell('Recomendación', 36), headerCell('Por qué', 36)] }),
            ...[
              ['Ahora mismo\n(< 250 facturas/día)', 'Gemini Free', 'Sin costo, modelo correcto, sin configuración extra'],
              ['Producción baja-media\n(250-1.000 facturas/día)', 'Gemini Pago directo\n(1 API key, tier 1)', 'Misma calidad, más simple, sin intermediario'],
              ['Producción alta con failover\n(> 1.000 facturas/día)', 'Gemini Pago (key1)\n+ OpenRouter (key2)', 'Gemini primario, OpenRouter como respaldo si Google cae'],
              ['Multi-provider', 'Solo OpenRouter Pago', 'Acceso a Claude, GPT, Gemini desde una API unificada'],
            ].map((row, ri) => new TableRow({
              children: row.map((cell, ci) => dataCell(cell, {
                widthPct: ci === 0 ? 28 : 36,
                bold: ci === 0,
                shading: ri % 2 === 0 ? COLOR_ROW_ALT : undefined,
              })),
            })),
          ],
        }),

        new Paragraph({ spacing: { before: 300 } }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Ruta práctica para ExpenseFlow:', bold: true, size: 24 })],
        }),
        new Paragraph({
          spacing: { after: 40 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Fase 1 — ', bold: true }), new TextRun({ text: 'Seguir con Gemini Free mientras no se superen los rate limits (gratis, funciona).' })],
        }),
        new Paragraph({
          spacing: { after: 40 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Fase 2 — ', bold: true }), new TextRun({ text: 'Activar Gemini Pago con UNA sola API key cuando se necesite más throughput. Eliminar las 3 keys actuales.' })],
        }),
        new Paragraph({
          spacing: { after: 40 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Fase 3 (opcional) — ', bold: true }), new TextRun({ text: 'Agregar OpenRouter como GEMINI_API_KEY_2 para failover si Google se cae.' })],
        }),
        new Paragraph({
          spacing: { after: 200 },
          bullet: { level: 0 },
          children: [new TextRun({ text: 'Las 3 API keys actuales no dan ventaja real porque el rate limiter (50/60s) es global y las 3 keys son del mismo proveedor.', italics: true })],
        }),

        // ═══════════════════════════════════════════════════════
        // 5. — CONFIGURACIÓN
        // ═══════════════════════════════════════════════════════
        new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 400, after: 200 }, children: [new TextRun({ text: '5. Configuración (sin modificar código)' })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: 'Gemini Pago (recomendado)' })] }),
        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: 'Solo cambias las variables de entorno. El código no se toca.', font: 'Calibri', size: 20, italics: true })],
        }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: '# .env', bold: true, font: 'Consolas', size: 18 })],
        }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'GEMINI_API_KEY=AIza...tu-key-paga', font: 'Consolas', size: 18 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: '# GEMINI_API_KEY_2=   ← vacías, ya no se usan', font: 'Consolas', size: 18, color: '9CA3AF' })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: '# GEMINI_API_KEY_3=   ← vacías, ya no se usan', font: 'Consolas', size: 18, color: '9CA3AF' })] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: 'PORT=3000', font: 'Consolas', size: 18 })] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 150 }, children: [new TextRun({ text: 'Gemini + OpenRouter (failover)' })] }),
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: '# .env', bold: true, font: 'Consolas', size: 18 })],
        }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'GEMINI_API_KEY=AIza...key-paga-directo', font: 'Consolas', size: 18 })] }),
        new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: 'GEMINI_API_KEY_2=sk-or-v2-...key-openrouter', font: 'Consolas', size: 18 })] }),
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: '# GEMINI_API_KEY_3=   ← vacía', font: 'Consolas', size: 18, color: '9CA3AF' })] }),

        // ═══════════════════════════════════════════════════════
        // FOOTER
        // ═══════════════════════════════════════════════════════
        new Paragraph({
          spacing: { before: 400 },
          border: { top: tableBorder() },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Documento generado el 15 de mayo de 2026 — ExpenseFlow', font: 'Calibri', size: 18, color: '9CA3AF', italics: true })],
        }),
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync('docs/comparativa-gemini-vs-openrouter.docx', buffer);
  console.log('✓ Documento generado: docs/comparativa-gemini-vs-openrouter.docx');
}

build().catch(console.error);
