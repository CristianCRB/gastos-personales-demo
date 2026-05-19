export interface UploadResult {
  storagePath: string;
  bucket: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface SignedUrlResult {
  signedUrl: string;
  storagePath: string;
  expiresInSeconds: number;
}

export const STORAGE_BUCKET = 'receipts';
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
