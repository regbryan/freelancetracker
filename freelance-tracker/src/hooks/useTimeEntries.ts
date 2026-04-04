import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface TimeEntry {
  id: string;
  project_id: string;
  description: string | null;
  hours: number;
  date: string;
  billable: boolean;
  invoice_id: string | null;
  created_at: string;
}

export type TimeEntryInsert = Omit<TimeEntry, 'id' | 'created_at'>;
export type TimeEntryUpdate = Partial<TimeEntryInsert>;

export function useTimeEntries(projectId?: string) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('time_entries')
        .select('*')
        .order('date', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setEntries(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch time entries';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const createEntry = useCallback(async (entry: TimeEntryInsert): Promise<TimeEntry> => {
    const { data, error: insertError } = await supabase
      .from('time_entries')
      .insert(entry)
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchEntries();
    return data;
  }, [fetchEntries]);

  const updateEntry = useCallback(async (id: string, updates: TimeEntryUpdate): Promise<TimeEntry> => {
    const { data, error: updateError } = await supabase
      .from('time_entries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    await fetchEntries();
    return data;
  }, [fetchEntries]);

  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('time_entries')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchEntries();
  }, [fetchEntries]);

  return { entries, loading, error, createEntry, updateEntry, deleteEntry, refetch: fetchEntries };
}

export function useUnbilledEntries(projectId: string | undefined) {
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnbilled = useCallback(async () => {
    if (!projectId) {
      setEntries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('time_entries')
        .select('*')
        .eq('project_id', projectId)
        .is('invoice_id', null)
        .eq('billable', true)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;
      setEntries(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch unbilled entries';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchUnbilled();
  }, [fetchUnbilled]);

  return { entries, loading, error, refetch: fetchUnbilled };
}
