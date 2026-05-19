import type { Socket as SocketIOSocket } from 'socket.io';

export type ConnectionStatus = 'connecting' | 'open' | 'close';

export type QREventCallback = (qr: string) => void;

export interface WhatsAppDependencies {
  io: import('socket.io').Server | null;
  onLogout: (() => void) | null;
  onConnected: ((userId: string) => void) | null;
}

export interface MediaDownloadResult {
  buffer: Buffer;
  mimeType: string;
}
