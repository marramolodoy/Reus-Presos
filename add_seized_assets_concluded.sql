-- Migration: add_seized_assets_concluded
-- Purpose: Add 'is_concluded' and 'concluded_at' columns to seized_assets table.

ALTER TABLE seized_assets
ADD COLUMN IF NOT EXISTS is_concluded BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS concluded_at TIMESTAMPTZ;
