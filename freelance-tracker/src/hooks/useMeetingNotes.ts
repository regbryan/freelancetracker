import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface MeetingNote {
  id: string;
  user_id: string;
  client_id: string | null;
  project_id: string | null;
  title: string;
  meeting_date: string;
  attendees: string[];
  summary: string;
  raw_transcript: string;
  status: 'draft' | 'reviewed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface MeetingTopic {
  id: string;
  meeting_note_id: string;
  heading: string;
  notes: string;
  sort_order: number;
  created_at: string;
}

export type MeetingNoteInsert = Omit<MeetingNote, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type MeetingNoteUpdate = Partial<MeetingNoteInsert>;
export type MeetingTopicInsert = Omit<MeetingTopic, 'id' | 'created_at'>;
export type MeetingTopicUpdate = Partial<Omit<MeetingTopicInsert, 'meeting_note_id'>>;

interface MeetingNoteFilters {
  clientId?: string;
  projectId?: string;
  status?: string;
}

export function useMeetingNotes(filters?: MeetingNoteFilters) {
  const [meetingNotes, setMeetingNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetingNotes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('meeting_notes')
        .select('*')
        .order('meeting_date', { ascending: false });

      if (filters?.clientId) {
        query = query.eq('client_id', filters.clientId);
      }
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setMeetingNotes(data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch meeting notes';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [filters?.clientId, filters?.projectId, filters?.status]);

  useEffect(() => {
    fetchMeetingNotes();
  }, [fetchMeetingNotes]);

  const createMeetingNote = useCallback(async (note: MeetingNoteInsert): Promise<MeetingNote> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error: insertError } = await supabase
      .from('meeting_notes')
      .insert({ ...note, user_id: user.id })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchMeetingNotes();
    return data;
  }, [fetchMeetingNotes]);

  const updateMeetingNote = useCallback(async (id: string, updates: MeetingNoteUpdate): Promise<MeetingNote> => {
    const { data, error: updateError } = await supabase
      .from('meeting_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    await fetchMeetingNotes();
    return data;
  }, [fetchMeetingNotes]);

  const deleteMeetingNote = useCallback(async (id: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('meeting_notes')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;
    await fetchMeetingNotes();
  }, [fetchMeetingNotes]);

  return { meetingNotes, loading, error, createMeetingNote, updateMeetingNote, deleteMeetingNote, refetch: fetchMeetingNotes };
}

export function useMeetingNote(id: string | undefined) {
  const [meetingNote, setMeetingNote] = useState<MeetingNote | null>(null);
  const [topics, setTopics] = useState<MeetingTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMeetingNote = useCallback(async () => {
    if (!id) {
      setMeetingNote(null);
      setTopics([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [noteResult, topicsResult] = await Promise.all([
        supabase.from('meeting_notes').select('*').eq('id', id).single(),
        supabase.from('meeting_topics').select('*').eq('meeting_note_id', id).order('sort_order'),
      ]);

      if (noteResult.error) throw noteResult.error;
      if (topicsResult.error) throw topicsResult.error;

      setMeetingNote(noteResult.data);
      setTopics(topicsResult.data ?? []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch meeting note';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMeetingNote();
  }, [fetchMeetingNote]);

  const updateNote = useCallback(async (updates: MeetingNoteUpdate): Promise<MeetingNote> => {
    if (!id) throw new Error('No meeting note ID');
    const { data, error: updateError } = await supabase
      .from('meeting_notes')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;
    setMeetingNote(data);
    return data;
  }, [id]);

  const createTopic = useCallback(async (topic: Omit<MeetingTopicInsert, 'meeting_note_id'>): Promise<MeetingTopic> => {
    if (!id) throw new Error('No meeting note ID');
    const { data, error: insertError } = await supabase
      .from('meeting_topics')
      .insert({ ...topic, meeting_note_id: id })
      .select()
      .single();

    if (insertError) throw insertError;
    await fetchMeetingNote();
    return data;
  }, [id, fetchMeetingNote]);

  const updateTopic = useCallback(async (topicId: string, updates: MeetingTopicUpdate): Promise<MeetingTopic> => {
    const { data, error: updateError } = await supabase
      .from('meeting_topics')
      .update(updates)
      .eq('id', topicId)
      .select()
      .single();

    if (updateError) throw updateError;
    await fetchMeetingNote();
    return data;
  }, [fetchMeetingNote]);

  const deleteTopic = useCallback(async (topicId: string): Promise<void> => {
    const { error: deleteError } = await supabase
      .from('meeting_topics')
      .delete()
      .eq('id', topicId);

    if (deleteError) throw deleteError;
    await fetchMeetingNote();
  }, [fetchMeetingNote]);

  return { meetingNote, topics, loading, error, updateNote, createTopic, updateTopic, deleteTopic, refetch: fetchMeetingNote };
}
