import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Project {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  type: string | null;
  billing_type: 'hourly' | 'monthly';
  hourly_rate: number | null;
  monthly_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
  };
}

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'clients' | 'billing_type' | 'monthly_rate'> & {
  /** Defaults to 'hourly' at the database level if omitted. */
  billing_type?: 'hourly' | 'monthly';
  monthly_rate?: number | null;
};
export type ProjectUpdate = Partial<ProjectInsert>;

export interface ProjectFilters {
  clientId?: string;
  status?: string;
}

export function useProjects(filters?: ProjectFilters) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('projects')
        .select('*, clients(id, name, email, company)')
        .order('created_at', { ascending: false });

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setProjects(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch projects';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters?.clientId, filters?.status]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = useCallback(async (project: ProjectInsert): Promise<Project> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error: insertError } = await supabase
      .from('projects')
      .insert({ ...project, user_id: user.id })
      .select('*, clients(id, name, email, company)')
      .single();

    if (insertError) throw insertError;
    await fetchProjects();
    return data;
  }, [fetchProjects]);

  const updateProject = useCallback(async (id: string, updates: ProjectUpdate): Promise<Project> => {
    const { data, error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .select('*, clients(id, name, email, company)')
      .single();

    if (updateError) throw updateError;
    await fetchProjects();
    return data;
  }, [fetchProjects]);

  const deleteProject = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchProjects();
  }, [fetchProjects]);

  return { projects, loading, error, createProject, updateProject, deleteProject, refetch: fetchProjects };
}

export function useProject(id: string | undefined) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (!id) {
      setProject(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('projects')
        .select('*, clients(id, name, email, company)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setProject(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch project';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  return { project, loading, error, refetch: fetchProject };
}
