import { logger } from '@/shared/utils/logger.js';

export class ReceiptParserService {
  parse(raw: string): Record<string, unknown> {
    const cleaned = this.stripMarkdownFences(raw).trim();

    if (!cleaned) {
      throw new Error('Respuesta vacia del modelo');
    }

    return this.tryParseJson(cleaned, raw);
  }

  private stripMarkdownFences(text: string): string {
    return text.replace(/```json\n?|```\n?/g, '').trim();
  }

  private tryParseJson(cleaned: string, original: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new Error('La respuesta no es un objeto JSON');
      }
      return parsed as Record<string, unknown>;
    } catch {
      const extracted = this.extractJsonBlock(original);
      if (extracted) return extracted;

      logger.error('Gemini response parse failed', original);
      throw new Error('No se pudo interpretar la respuesta del modelo');
    }
  }

  private extractJsonBlock(text: string): Record<string, unknown> | null {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      const parsed = JSON.parse(match[0]);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }

    return null;
  }
}

export const receiptParserService = new ReceiptParserService();
