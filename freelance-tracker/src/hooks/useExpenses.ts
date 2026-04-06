import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Expense {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  receipt_url: string | null;
  invoice_id: string | null;
  created_at: string;
}

export type ExpenseInsert = Omit<Expense, 'id' | 'created_at'>;
export type ExpenseUpdate = Partial<ExpenseInsert>;

export function useExpenses(projectId?: string) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('expenses')
        .select('*')
        .order('date', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setExpenses(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch expenses';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const createExpense = useCallback(async (expense: ExpenseInsert): Promise<Expense> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error: insertError } = await supabase
      .from('expenses')
      .insert({ ...expense, user_id: user.id })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchExpenses();
    return data;
  }, [fetchExpenses]);

  const updateExpense = useCallback(async (id: string, updates: ExpenseUpdate): Promise<Expense> => {
    const { data, error: updateError } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    await fetchExpenses();
    return data;
  }, [fetchExpenses]);

  const deleteExpense = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchExpenses();
  }, [fetchExpenses]);

  return { expenses, loading, error, createExpense, updateExpense, deleteExpense, refetch: fetchExpenses };
}

export function useUnbilledExpenses(projectId: string | undefined) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUnbilled = useCallback(async () => {
    if (!projectId) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('expenses')
        .select('*')
        .eq('project_id', projectId)
        .is('invoice_id', null)
        .order('date', { ascending: false });

      if (fetchError) throw fetchError;
      setExpenses(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch unbilled expenses';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchUnbilled();
  }, [fetchUnbilled]);

  return { expenses, loading, error, refetch: fetchUnbilled };
}

export function useExpenseCategories() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('category');

      if (error) throw error;
      const unique = [...new Set((data ?? []).map((d: { category: string }) => d.category))].sort();
      setCategories(unique);
    } catch {
      // Silently fail — categories are optional
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, refetch: fetchCategories };
}
