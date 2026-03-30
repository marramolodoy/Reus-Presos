-- Adicionando campo expert_name na tabela de perícias existente
-- Execute este comando no SQL Editor do seu Supabase
ALTER TABLE public.pending_schedules ADD COLUMN IF NOT EXISTS expert_name TEXT;

COMMENT ON COLUMN public.pending_schedules.expert_name IS 'Nome do perito nomeado para esta perícia';
