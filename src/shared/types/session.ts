export interface Session {
  id: string;
  organizationId: string;
  sessionName: string;
  phoneNumber: string;
  sessionData: WhatsAppSessionData;
  deviceInfo: WhatsAppDeviceInfo;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = 'active' | 'disconnected' | 'failed';

export interface WhatsAppSessionData {
  /** Serialized AuthenticationCreds (Buffer → base64 via BufferJSON) */
  creds?: Record<string, unknown>;
  /** Serialized SignalKeyStore keys (type → id → value) */
  keys?: Record<string, Record<string, unknown>>;
  nextPreKeyId?: number;
  firstUnuploadedPreKeyId?: number;
  accountSettings?: Record<string, unknown>;
}

export interface WhatsAppDeviceInfo {
  platform?: string;
  browser?: string;
  osVersion?: string;
  deviceModel?: string;
  connectionType?: string;
}

/** @deprecated Use WhatsAppSessionData.creds with Record<string, unknown> */
export interface BaileysCreds {
  noiseKey?: { public: string; private: string };
  signedPreKey?: { keyId: number; pair: { public: string; private: string }; signature: string };
  preKey?: { keyId: number; pair: { public: string; private: string } }[];
  session?: Record<string, unknown>;
  senderKeyMemory?: Record<string, unknown>;
  account?: Record<string, unknown>;
  deviceId?: string;
}

export interface SessionCreateInput {
  organizationId: string;
  sessionName?: string;
  phoneNumber: string;
  sessionData?: WhatsAppSessionData;
  deviceInfo?: WhatsAppDeviceInfo;
  status?: SessionStatus;
}

export interface SessionQueryInput {
  organizationId: string;
  sessionName?: string;
  phoneNumber?: string;
}