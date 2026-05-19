import { v4 as uuidv4 } from 'uuid';
import { getAdminClient } from '@/config/supabase.js';
import { logger } from '@/shared/utils/logger.js';
import type { UploadResult, SignedUrlResult } from '@/shared/types/storage.js';
import { STORAGE_BUCKET, MAX_FILE_SIZE_BYTES, ALLOWED_MIME_TYPES } from '@/shared/types/storage.js';

function buildStoragePath(organizationId: string, mimeType: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const fileId = uuidv4();
  return `receipts/${organizationId}/${year}/${month}/${fileId}.${ext}`;
}

export async function uploadReceiptImage(
  buffer: Buffer,
  organizationId: string,
  mimeType: string
): Promise<UploadResult | null> {
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    logger.warn(`Invalid mime type rejected: ${mimeType}`);
    return null;
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    logger.warn(`File too large: ${buffer.length} bytes (max ${MAX_FILE_SIZE_BYTES})`);
    return null;
  }

  const supabase = getAdminClient();
  const storagePath = buildStoragePath(organizationId, mimeType);

  logger.info(`Uploading receipt to: ${storagePath} (${buffer.length} bytes)`);

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    logger.error('Storage upload failed:', error.message);
    return null;
  }

  logger.info(`Uploaded successfully: ${storagePath}`);

  return {
    storagePath,
    bucket: STORAGE_BUCKET,
    fileName: storagePath.split('/').pop() ?? '',
    mimeType,
    sizeBytes: buffer.length,
  };
}

export async function generateSignedUrl(
  storagePath: string,
  expiresInSeconds: number = 3600
): Promise<SignedUrlResult | null> {
  const supabase = getAdminClient();

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    logger.error('Signed URL generation failed:', error?.message);
    return null;
  }

  return {
    signedUrl: data.signedUrl,
    storagePath,
    expiresInSeconds,
  };
}

export async function deleteReceiptImage(storagePath: string): Promise<boolean> {
  const supabase = getAdminClient();

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([storagePath]);

  if (error) {
    logger.error('Storage delete failed:', error.message);
    return false;
  }

  logger.info(`Deleted from storage: ${storagePath}`);
  return true;
}
