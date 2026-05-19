import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { env } from '@/shared/config/env.js';
import { logger } from '@/shared/utils/logger.js';
import type { AiRequestPart } from '@/modules/ai/ai.service.js';
import { RateLimiter } from '@/services/RateLimiter.js';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

const RECEIPT_PROMPT = `Eres un experto contador analizando recibos y facturas. Analiza esta imagen y extrae la siguiente informacion en JSON:

{
  "vendor": "nombre del comercio",
  "date": "fecha en formato YYYY-MM-DD",
  "total": total como numero,
  "currency": "COP",
  "subtotal": "subtotal de la compra",
  "tax": "impuesto/IVA si existe",
   "items": [{"description": "descripcion", "quantity": cantidad, "unit_price": precio_unitario, "amount": precio_total}],
  "category": "categoria del gasto",
  "invoiceNumber": "numero de factura si existe",
  "paymentMethod": "metodo de pago si es visible"
}

Reglas importantes:
- Solo devuelve JSON valido, sin texto adicional
- Si no puedes determinar un campo, usa null
- La fecha debe ser YYYY-MM-DD
- Los montos deben ser numeros, no strings
- Para moneda colombiana usa "COP"
- Las categorias validas son: Alimentos, Transporte, Servicios, Salud, Educacion, Entretenimiento, Tecnologia, Otros`;

function getApiKeys(): string[] {
  const keys = [env.GEMINI_API_KEY];
  if (env.GEMINI_API_KEY_2) keys.push(env.GEMINI_API_KEY_2);
  if (env.GEMINI_API_KEY_3) keys.push(env.GEMINI_API_KEY_3);
  return keys;
}

function createModel(apiKey: string): GenerativeModel {
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      maxOutputTokens: 8192,
    },
  });
}

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  const message = (err as { message?: string })?.message ?? '';
  return (
    status === 429 ||
    status === 500 ||
    status === 503 ||
    message.includes('RATE_LIMIT') ||
    message.includes('timeout') ||
    message.includes('TIMEOUT') ||
    message.includes('unavailable') ||
    message.includes('Internal server error')
  );
}

export class GeminiClient {
  private models: Array<{ key: string; model: GenerativeModel }> = [];
  private currentIndex = 0;
  private rateLimiter = new RateLimiter(50, 60000);

  constructor() {
    const keys = getApiKeys();
    this.models = keys.map(k => ({ key: k, model: createModel(k) }));
    logger.info(`GeminiClient initialized with ${this.models.length} API key(s)`);
  }

  private rotateKey(): void {
    this.currentIndex = (this.currentIndex + 1) % this.models.length;
    logger.info(`Rotated to API key ${this.currentIndex + 1}/${this.models.length}`);
  }

  private getCurrentModel(): { key: string; model: GenerativeModel } {
    return this.models[this.currentIndex]!;
  }

  async extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    await this.rateLimiter.acquire();

    const imagePart: AiRequestPart = {
      inlineData: { data: imageBuffer.toString('base64'), mimeType },
    };

    const maxAttempts = this.models.length * 3;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { key: _key, model } = this.getCurrentModel();
      const label = `attempt ${attempt + 1}/${maxAttempts}`;

      try {
        const result = await withTimeout(
          model.generateContent([{ text: RECEIPT_PROMPT }, imagePart] as never),
          env.GEMINI_REQUEST_TIMEOUT
        );
        return result.response.text();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logger.warn(`Gemini ${label} failed: ${lastError.message}`);

        if (isRetryable(lastError)) {
          const status = (err as { status?: number })?.status;
          if (status === 429) {
            this.rotateKey();
          }
          const backoff = Math.min(1000 * Math.pow(2, attempt), 8000);
          await delay(backoff);
        } else {
          throw lastError;
        }
      }
    }

    throw lastError ?? new Error('Gemini: all attempts exhausted');
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  return Promise.race([
    promise.finally(() => clearTimeout(timer!)),
    timeout,
  ]);
}

export const geminiClient = new GeminiClient();
