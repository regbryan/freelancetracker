import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Communication {
  id: string;
  project_id: string;
  direction: 'sent' | 'received';
  subject: string | null;
  body: string | null;
  from_email: string | null;
  to_email: string | null;
  gmail_message_id: string | null;
  gmail_thread_id: string | null;
  date: string;
  created_at: string;
}

export type CommunicationInsert = Omit<Communication, 'id' | 'created_at'>;

export function useCommunications(projectId: string | undefined) {
  const [communications, setCommunications] = useState<Communication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCommunications = useCallback(async () => {
    if (!projectId) {
      setCommunications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('communications')
        .select('*')
        .eq('project_id', projectId)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;
      setCommunications(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch communications';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCommunications();
  }, [fetchCommunications]);

  const createCommunication = useCallback(async (
    communication: CommunicationInsert
  ): Promise<Communication> => {
    const { data, error: insertError } = await supabase
      .from('communications')
      .insert(communication)
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchCommunications();
    return data;
  }, [fetchCommunications]);

  return { communications, loading, error, createCommunication, refetch: fetchCommunications };
}
