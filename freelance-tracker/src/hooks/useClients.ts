import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Client {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  hourly_rate: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type ClientInsert = Omit<Client, 'id' | 'created_at' | 'updated_at'>;
export type ClientUpdate = Partial<ClientInsert>;

export function useClients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (fetchError) throw fetchError;
      setClients(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch clients';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const createClient = useCallback(async (client: ClientInsert): Promise<Client> => {
    const { data, error: insertError } = await supabase
      .from('clients')
      .insert(client)
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchClients();
    return data;
  }, [fetchClients]);

  const updateClient = useCallback(async (id: string, updates: ClientUpdate): Promise<Client> => {
    const { data, error: updateError } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    await fetchClients();
    return data;
  }, [fetchClients]);

  const deleteClient = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchClients();
  }, [fetchClients]);

  return { clients, loading, error, createClient, updateClient, deleteClient, refetch: fetchClients };
}

export function useClient(id: string | undefined) {
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClient = useCallback(async () => {
    if (!id) {
      setClient(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setClient(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch client';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  return { client, loading, error, refetch: fetchClient };
}
