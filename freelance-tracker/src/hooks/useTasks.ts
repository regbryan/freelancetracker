import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskInsert = Omit<Task, 'id' | 'created_at' | 'updated_at'>;
export type TaskUpdate = Partial<TaskInsert>;

export function useTasks(projectId?: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });

      if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setTasks(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = useCallback(async (task: TaskInsert): Promise<Task> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert({ ...task, user_id: user.id })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchTasks();
    return data;
  }, [fetchTasks]);

  const updateTask = useCallback(async (id: string, updates: TaskUpdate): Promise<Task> => {
    const { data, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    await fetchTasks();
    return data;
  }, [fetchTasks]);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchTasks();
  }, [fetchTasks]);

  return { tasks, loading, error, createTask, updateTask, deleteTask, refetch: fetchTasks };
}
