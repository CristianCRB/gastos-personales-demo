import { getSupabaseClient } from '@/services/SupabaseService.js';
import { logger } from '@/shared/utils/logger.js';
import type { Organization } from '@/shared/types/index.js';

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

function rowToOrganization(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    createdAt: row.created_at,
  };
}

export interface CreateOrganizationInput {
  name: string;
  slug: string;
}

export class OrganizationRepository {
  async findBySlug(slug: string): Promise<Organization | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) {
      if (error?.code !== 'PGRST116') {
        logger.error('OrganizationRepository.findBySlug:', error?.message);
      }
      return null;
    }

    return rowToOrganization(data as OrganizationRow);
  }

  async findById(id: string): Promise<Organization | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToOrganization(data as OrganizationRow);
  }

  async getOrganizationById(id: string): Promise<Organization | null> {
    return this.findById(id);
  }

  async createOrganization(input: CreateOrganizationInput): Promise<Organization | null> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      logger.error('OrganizationRepository.createOrganization: Supabase client unavailable');
      return null;
    }

    const { data: row, error } = await supabase
      .from('organizations')
      .insert({ name: input.name, slug: input.slug })
      .select()
      .single();

    if (error || !row) {
      logger.error('OrganizationRepository.createOrganization: Failed to create organization', error?.message);
      return null;
    }

    logger.info('Organization created successfully', { organizationId: row.id, name: input.name });
    return rowToOrganization(row as OrganizationRow);
  }

  async create(data: { name: string; slug: string }): Promise<Organization | null> {
    return this.createOrganization(data);
  }

  async list(): Promise<Organization[]> {
    const supabase = getSupabaseClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      logger.error('OrganizationRepository.list:', error?.message);
      return [];
    }

    return (data as OrganizationRow[]).map(rowToOrganization);
  }
}

export const organizationRepository = new OrganizationRepository();
