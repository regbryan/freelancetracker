-- FreelanceTracker: Meeting Notes Migration
-- Run in Supabase SQL Editor

CREATE TABLE meeting_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  meeting_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  attendees TEXT[] DEFAULT '{}',
  summary TEXT DEFAULT '',
  raw_transcript TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'archived')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE meeting_topics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_note_id UUID REFERENCES meeting_notes(id) ON DELETE CASCADE NOT NULL,
  heading TEXT NOT NULL,
  notes TEXT DEFAULT '',
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS meeting_note_id UUID REFERENCES meeting_notes(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee TEXT DEFAULT 'me';

ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own meeting notes" ON meeting_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage topics for their meeting notes" ON meeting_topics FOR ALL USING (meeting_note_id IN (SELECT id FROM meeting_notes WHERE user_id = auth.uid()));

CREATE INDEX idx_meeting_notes_user_id ON meeting_notes(user_id);
CREATE INDEX idx_meeting_notes_client_id ON meeting_notes(client_id);
CREATE INDEX idx_meeting_notes_project_id ON meeting_notes(project_id);
CREATE INDEX idx_meeting_notes_meeting_date ON meeting_notes(meeting_date DESC);
CREATE INDEX idx_meeting_topics_meeting_note_id ON meeting_topics(meeting_note_id);
CREATE INDEX idx_tasks_meeting_note_id ON tasks(meeting_note_id);
