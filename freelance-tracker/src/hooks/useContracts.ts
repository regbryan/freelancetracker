import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ContractSignature {
  id: string;
  contract_id: string;
  signer_name: string;
  signer_email: string | null;
  signature_data: string;
  signed_at: string;
}

export interface Contract {
  id: string;
  project_id: string | null;
  client_id: string;
  title: string;
  content: string;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  sign_token: string;
  created_at: string;
  updated_at: string;
  clients?: {
    id: string;
    name: string;
    email: string | null;
    company: string | null;
  };
  projects?: {
    id: string;
    name: string;
  };
  contract_signatures?: ContractSignature[];
}

export type ContractInsert = Omit<Contract, 'id' | 'created_at' | 'updated_at' | 'sign_token' | 'clients' | 'projects' | 'contract_signatures'>;
export type ContractUpdate = Partial<ContractInsert>;

export interface ContractFilters {
  projectId?: string;
  clientId?: string;
  status?: string;
}

export function useContracts(filters?: ContractFilters) {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('contracts')
        .select('*, clients(id, name, email, company), projects(id, name), contract_signatures(*)')
        .order('created_at', { ascending: false });

      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setContracts(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch contracts';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters?.projectId, filters?.clientId, filters?.status]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  const createContract = useCallback(async (contract: ContractInsert): Promise<Contract> => {
    const { data, error: insertError } = await supabase
      .from('contracts')
      .insert(contract)
      .select('*, clients(id, name, email, company), projects(id, name), contract_signatures(*)')
      .single();

    if (insertError) throw insertError;
    await fetchContracts();
    return data;
  }, [fetchContracts]);

  const updateContract = useCallback(async (id: string, updates: ContractUpdate): Promise<Contract> => {
    const { data, error: updateError } = await supabase
      .from('contracts')
      .update(updates)
      .eq('id', id)
      .select('*, clients(id, name, email, company), projects(id, name), contract_signatures(*)')
      .single();

    if (updateError) throw updateError;
    await fetchContracts();
    return data;
  }, [fetchContracts]);

  const deleteContract = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('contracts')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchContracts();
  }, [fetchContracts]);

  return { contracts, loading, error, createContract, updateContract, deleteContract, refetch: fetchContracts };
}

export function useContract(id: string | undefined) {
  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchContract = useCallback(async () => {
    if (!id) {
      setContract(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('contracts')
        .select('*, clients(id, name, email, company), projects(id, name), contract_signatures(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setContract(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch contract';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchContract();
  }, [fetchContract]);

  return { contract, loading, error, refetch: fetchContract };
}
