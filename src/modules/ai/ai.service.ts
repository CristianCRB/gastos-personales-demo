export interface AiRequestPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}
