-- Migration: create_seized_assets
-- Purpose: Create table for controlling Seized Assets (Bens Apreendidos) with team-based RLS.

-- 1. Create Table
CREATE TABLE IF NOT EXISTS seized_assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  process_number TEXT,
  party_name TEXT NOT NULL, -- Nome da Parte
  possible_owner TEXT, -- Possível Proprietário
  description TEXT NOT NULL, -- Descrição do Bem
  location TEXT NOT NULL, -- Onde está acautelado
  destination_status TEXT DEFAULT 'Aguardando', -- Encaminhado para destinação? (Status)
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- 2. Enable RLS
ALTER TABLE seized_assets ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies (Team/Unit Based)

-- Select
CREATE POLICY "Team view seized assets"
ON seized_assets FOR SELECT
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = seized_assets.user_id
  )
);

-- Insert
CREATE POLICY "Team insert seized assets"
ON seized_assets FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    WHERE requester_role.user_id = auth.uid()
  )
);

-- Update
CREATE POLICY "Team update seized assets"
ON seized_assets FOR UPDATE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = seized_assets.user_id
  )
);

-- Delete
CREATE POLICY "Team delete seized assets"
ON seized_assets FOR DELETE
USING (
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1
    FROM user_roles requester_role
    JOIN user_roles owner_role ON requester_role.unit = owner_role.unit
    WHERE requester_role.user_id = auth.uid()
    AND owner_role.user_id = seized_assets.user_id
  )
);
