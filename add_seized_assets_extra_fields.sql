-- Migration: add_seized_assets_extra_fields
-- Purpose: Add 'seizure_date' and 'has_court_case' columns to seized_assets table.

ALTER TABLE seized_assets
ADD COLUMN IF NOT EXISTS seizure_date DATE,
ADD COLUMN IF NOT EXISTS has_court_case BOOLEAN DEFAULT TRUE;
