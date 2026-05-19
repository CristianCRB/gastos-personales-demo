import type { Server as SocketIOServer } from 'socket.io';
import QRCode from 'qrcode';
import { logger } from '@/shared/utils/logger.js';
import { whatsAppService } from '@/modules/whatsapp/WhatsAppService.js';

export class SocketManager {
  private io: SocketIOServer | null = null;

  setIO(io: SocketIOServer): void {
    this.io = io;
  }

  setup(): void {
    if (!this.io) return;

    this.io.on('connection', async (socket) => {
      logger.info('Client connected via Socket.IO');

      const qr = whatsAppService.getCurrentQR();
      if (qr) {
        try {
          const qrDataURL = await QRCode.toDataURL(qr, { width: 280, margin: 2 });
          socket.emit('whatsapp-qr-image', qrDataURL);
        } catch {}
      }
    });
  }

  emitNewExpense(expense: unknown): void {
    this.io?.emit('new-expense', expense);
  }

  emitSessionsCleared(): void {
    this.io?.emit('sessions-cleared');
  }

  emitQRImage(qrDataURL: string): void {
    this.io?.emit('whatsapp-qr-image', qrDataURL);
  }

  emitConnected(): void {
    this.io?.emit('whatsapp-connected');
  }

  emitDisconnected(): void {
    this.io?.emit('whatsapp-disconnected');
  }
}

export const socketManager = new SocketManager();
