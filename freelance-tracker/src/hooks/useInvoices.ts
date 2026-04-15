import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  time_entry_id: string | null;
  item_type: 'time' | 'expense' | 'flat';
}

export type InvoiceItemInsert = Omit<InvoiceItem, 'id' | 'invoice_id'>;

export interface Invoice {
  id: string;
  project_id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  subtotal: number;
  tax_rate: number;
  total: number;
  notes: string | null;
  due_date: string | null;
  issued_date: string | null;
  payment_url: string | null;
  created_at: string;
  projects?: {
    id: string;
    name: string;
    clients?: {
      id: string;
      name: string;
    };
  };
  invoice_items?: InvoiceItem[];
}

export type InvoiceInsert = Omit<Invoice, 'id' | 'created_at' | 'payment_url' | 'projects' | 'invoice_items'>;
export type InvoiceUpdate = Partial<Pick<Invoice, 'invoice_number' | 'status' | 'tax_rate' | 'total' | 'notes' | 'due_date' | 'issued_date'>>;

/**
 * Returns the next sequential invoice number for the current year, in the
 * form `INV-YYYY-NNN`. The sequence resets to 001 each new year.
 * Scans existing invoices for the current user (RLS scopes the query) and
 * finds the highest NNN matching the current year.
 */
export async function getNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const prefix = `INV-${year}-`

  const { data, error: fetchError } = await supabase
    .from('invoices')
    .select('invoice_number')
    .like('invoice_number', `${prefix}%`)

  if (fetchError) throw fetchError

  let maxSeq = 0
  for (const row of data ?? []) {
    const num: string = row.invoice_number ?? ''
    const tail = num.slice(prefix.length)
    const parsed = parseInt(tail, 10)
    if (!Number.isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed
    }
  }

  const next = String(maxSeq + 1).padStart(3, '0')
  return `${prefix}${next}`
}

export interface InvoiceFilters {
  projectId?: string;
  clientId?: string;
  status?: string;
}

export function useInvoices(filters?: InvoiceFilters) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('invoices')
        .select('*, projects(id, name, clients(id, name)), invoice_items(*)')
        .order('created_at', { ascending: false });

      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.clientId) {
        query = query.eq('projects.client_id', filters.clientId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setInvoices(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoices';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters?.projectId, filters?.clientId, filters?.status]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const createInvoice = useCallback(async (
    invoice: InvoiceInsert,
    items: InvoiceItemInsert[],
    options?: { expenseIds?: string[] }
  ): Promise<Invoice> => {
    // Get authenticated user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Insert the invoice first
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .insert({ ...invoice, user_id: user.id })
      .select()
      .single();

    if (invoiceError) throw invoiceError;

    // Insert all line items with the invoice id
    if (items.length > 0) {
      const itemsWithInvoiceId = items.map((item) => ({
        ...item,
        invoice_id: invoiceData.id,
      }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsWithInvoiceId);

      if (itemsError) throw itemsError;

      // Link time entries to this invoice
      const timeEntryIds = items
        .filter((item) => item.time_entry_id)
        .map((item) => item.time_entry_id as string);

      if (timeEntryIds.length > 0) {
        const { error: linkError } = await supabase
          .from('time_entries')
          .update({ invoice_id: invoiceData.id })
          .in('id', timeEntryIds);

        if (linkError) throw linkError;
      }
    }

    // Link expenses to this invoice
    if (options?.expenseIds?.length) {
      const { error: expLinkError } = await supabase
        .from('expenses')
        .update({ invoice_id: invoiceData.id })
        .in('id', options.expenseIds);

      if (expLinkError) throw expLinkError;
    }

    await fetchInvoices();
    return invoiceData;
  }, [fetchInvoices]);

  const updateInvoiceStatus = useCallback(async (
    id: string,
    status: Invoice['status']
  ): Promise<Invoice> => {
    const { data, error: updateError } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', id)
      .select('*, projects(id, name, clients(id, name))')
      .single();

    if (updateError) throw updateError;
    await fetchInvoices();
    return data;
  }, [fetchInvoices]);

  const updateInvoice = useCallback(async (
    id: string,
    updates: InvoiceUpdate
  ): Promise<Invoice> => {
    const { data, error: updateError } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select('*, projects(id, name, clients(id, name)), invoice_items(*)')
      .single();

    if (updateError) throw updateError;
    await fetchInvoices();
    return data;
  }, [fetchInvoices]);

  return { invoices, loading, error, createInvoice, updateInvoiceStatus, updateInvoice, refetch: fetchInvoices };
}

export function useInvoice(id: string | undefined) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvoice = useCallback(async () => {
    if (!id) {
      setInvoice(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('invoices')
        .select('*, projects(id, name, clients(id, name)), invoice_items(*)')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      setInvoice(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch invoice';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  return { invoice, loading, error, refetch: fetchInvoice };
}
