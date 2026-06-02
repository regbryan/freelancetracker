-- Migration: Add billing period to invoices
-- Run this in the Supabase SQL editor (or via MCP apply_migration).

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS period_start DATE,
  ADD COLUMN IF NOT EXISTS period_end   DATE;
