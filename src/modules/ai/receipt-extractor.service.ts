import { geminiClient } from '@/services/GeminiClient.js';

export class ReceiptExtractorService {
  async extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<string> {
    return geminiClient.extractFromImage(imageBuffer, mimeType);
  }
}

export const receiptExtractorService = new ReceiptExtractorService();
