-- Migration: Add monthly billing support to projects
-- Run this in the Supabase SQL editor.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'hourly',
  ADD COLUMN IF NOT EXISTS monthly_rate NUMERIC(12, 2);

-- Optional: add a check constraint to keep values clean
ALTER TABLE projects
  DROP CONSTRAINT IF EXISTS projects_billing_type_check;

ALTER TABLE projects
  ADD CONSTRAINT projects_billing_type_check
  CHECK (billing_type IN ('hourly', 'monthly'));
