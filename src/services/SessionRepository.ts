import { getSupabaseClient } from '@/services/SupabaseService.js';
import { logger } from '@/shared/utils/logger.js';
import type { Session, SessionCreateInput, SessionQueryInput, WhatsAppSessionData, WhatsAppDeviceInfo } from '@/shared/types/index.js';

interface SessionRow {
  id: string;
  organization_id: string;
  session_name: string;
  phone_number: string;
  session_data: WhatsAppSessionData | null;
  device_info: WhatsAppDeviceInfo | null;
  status: string;
  created_at: string;
  updated_at: string;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    organizationId: row.organization_id,
    sessionName: row.session_name,
    phoneNumber: row.phone_number,
    sessionData: row.session_data || { creds: undefined, keys: undefined },
    deviceInfo: row.device_info || {},
    status: row.status as Session['status'],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SessionRepository {
  async createSession(input: SessionCreateInput): Promise<Session | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.error('SessionRepository.createSession: Supabase client unavailable');
      return null;
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        organization_id: input.organizationId,
        session_name: input.sessionName || 'main',
        phone_number: input.phoneNumber,
        session_data: input.sessionData || {},
        device_info: input.deviceInfo || {},
        status: input.status || 'active',
      })
      .select()
      .single();

    if (error || !data) {
      logger.error('SessionRepository.createSession: Failed to create session', error?.message);
      return null;
    }

    return rowToSession(data as SessionRow);
  }

  async getSession(input: SessionQueryInput): Promise<Session | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    let query = supabase
      .from('sessions')
      .select('*');

    if (input.sessionName) {
      query = query.eq('session_name', input.sessionName);
    } else if (input.phoneNumber) {
      query = query.eq('phone_number', input.phoneNumber);
    }

    query = query.eq('organization_id', input.organizationId);

    const { data, error } = await query.single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        logger.error('SessionRepository.getSession:', error?.message);
      }
      return null;
    }

    return rowToSession(data as SessionRow);
  }

  async getSessionByPhone(organizationId: string, phoneNumber: string): Promise<Session | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('phone_number', phoneNumber)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        logger.error('SessionRepository.getSessionByPhone:', error?.message);
      }
      return null;
    }

    return rowToSession(data as SessionRow);
  }

  async updateSessionData(id: string, sessionData: WhatsAppSessionData): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('sessions')
      .update({ session_data: sessionData, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error('SessionRepository.updateSessionData:', error.message);
      return false;
    }

    return true;
  }

  async updateStatus(id: string, status: Session['status']): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('sessions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      logger.error('SessionRepository.updateStatus:', error.message);
      return false;
    }

    return true;
  }

  async upsertSession(input: SessionCreateInput): Promise<Session | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.error('SessionRepository.upsertSession: Supabase client unavailable');
      return null;
    }

    // Try to find existing session first (by org + name)
    const existing = await this.getSession({
      organizationId: input.organizationId,
      sessionName: input.sessionName || 'main',
    });

    if (existing) {
      // Update existing row
      const { error } = await supabase
        .from('sessions')
        .update({
          phone_number: input.phoneNumber,
          session_data: input.sessionData || {},
          device_info: input.deviceInfo || {},
          status: input.status || 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      if (error) {
        logger.error('SessionRepository.upsertSession: update failed', error.message);
        return null;
      }

      return {
        ...existing,
        phoneNumber: input.phoneNumber,
        sessionData: input.sessionData || {},
        deviceInfo: input.deviceInfo || {},
        status: (input.status || 'active') as Session['status'],
        updatedAt: new Date().toISOString(),
      };
    }

    // No existing session — insert new row
    return this.createSession(input);
  }

  async deleteSession(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;

    const { error } = await supabase
      .from('sessions')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('SessionRepository.deleteSession:', error.message);
      return false;
    }

    return true;
  }

  async clearAllSessions(organizationId: string): Promise<number> {
    const supabase = getSupabaseClient();
    if (!supabase) return 0;

    const { count, error } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', organizationId);

    if (error) {
      logger.error('SessionRepository.clearAllSessions:', error.message);
      return 0;
    }

    const deleteCount = count ?? 0;

    await supabase
      .from('sessions')
      .delete()
      .eq('organization_id', organizationId);

    return deleteCount;
  }

  async getActiveSessions(organizationId: string): Promise<Session[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('SessionRepository.getActiveSessions:', error.message);
      return [];
    }

    return (data as SessionRow[]).map(rowToSession);
  }

  async initialize(): Promise<void> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.warn('SessionRepository: Supabase not available');
      return;
    }

    const { error } = await supabase.from('sessions').select('id').limit(1);
    if (error && error.code !== 'PGRST116') {
      logger.warn('Sessions table may not exist:', error.message);
    }
  }
}

export const sessionRepository = new SessionRepository();