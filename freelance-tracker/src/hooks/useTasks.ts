import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clampProgress } from '../lib/progress';

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  start_date: string | null;
  due_date: string | null;
  meeting_note_id: string | null;
  milestone_id: string | null;
  assignee: string;
  /** Percent complete, 0–100. 0 for every row until the progress migration runs. */
  progress: number;
  /** Estimated hours, or null when nobody has estimated it (and pre-migration). */
  estimate_hours: number | null;
  created_at: string;
  updated_at: string;
}

export type TaskInsert = Omit<
  Task,
  'id' | 'created_at' | 'updated_at' | 'start_date' | 'milestone_id' | 'progress' | 'estimate_hours'
> & {
  start_date?: string | null;
  milestone_id?: string | null;
  progress?: number;
  estimate_hours?: number | null;
};
export type TaskUpdate = Partial<TaskInsert>;

/** Postgres "column does not exist": the progress migration has not been applied. */
const UNDEFINED_COLUMN = '42703';
/** The columns that migration adds; an update touching one can fail with 42703. */
const MIGRATION_COLUMNS = ['progress', 'estimate_hours'] as const;

/**
 * Rows arriving from a database without the progress migration have neither
 * key at all. Normalising here means nothing downstream has to think about it:
 * a missing percentage is 0, a missing estimate is null (never 0 — "nobody
 * estimated this" and "estimated at nothing" are different facts).
 */
function normalizeTask(row: Task): Task {
  return {
    ...row,
    progress: clampProgress(row.progress),
    estimate_hours: row.estimate_hours ?? null,
  };
}

export function useTasks(projectId?: string, meetingNoteId?: string) {
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

      if (meetingNoteId) {
        query = query.eq('meeting_note_id', meetingNoteId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setTasks((data ?? []).map(normalizeTask));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch tasks';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [projectId, meetingNoteId]);

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
    return normalizeTask(data);
  }, [fetchTasks]);

  const createTasks = useCallback(async (taskList: TaskInsert[]): Promise<Task[]> => {
    if (taskList.length === 0) return []
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const { data, error: insertError } = await supabase
      .from('tasks')
      .insert(taskList.map(t => ({ ...t, user_id: user.id })))
      .select();

    if (insertError) throw insertError;
    await fetchTasks();
    return (data ?? []).map(normalizeTask);
  }, [fetchTasks]);

  const updateTask = useCallback(async (id: string, updates: TaskUpdate): Promise<Task> => {
    // maybeSingle, not single: RLS makes a task the caller can no longer reach
    // (membership revoked mid-session) look like a zero-row update, and single()
    // would surface that as a cryptic PGRST116 instead of something we can map.
    const { data, error: updateError } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle();

    if (updateError) {
      // The one failure the caller can actually act on: a column the progress
      // migration adds is not there yet, so the page can name the file to apply.
      const code = (updateError as { code?: string }).code;
      if (code === UNDEFINED_COLUMN && MIGRATION_COLUMNS.some((c) => c in updates)) {
        throw new Error('migration-pending');
      }
      throw updateError;
    }
    if (!data) throw new Error('no-access');
    const row = normalizeTask(data as Task);
    setTasks(prev => prev.map(t => t.id === id ? row : t));
    return row;
  }, []);

  const deleteTask = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    // Update local state in-place so the page doesn't re-render / scroll jump
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const deleteTasks = useCallback(async (ids: string[]): Promise<void> => {
    if (ids.length === 0) return;
    const { error: deleteError } = await supabase
      .from('tasks')
      .delete()
      .in('id', ids);

    if (deleteError) throw deleteError;
    const idSet = new Set(ids);
    setTasks(prev => prev.filter(t => !idSet.has(t.id)));
  }, []);

  return { tasks, loading, error, createTask, createTasks, updateTask, deleteTask, deleteTasks, refetch: fetchTasks };
}
