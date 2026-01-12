-- Execute este script no Editor SQL do seu projeto no Supabase (https://supabase.com/dashboard)
-- Selecione o projeto "Réus Presos - Controle" e clique em "SQL Editor" na barra lateral esquerda.
-- Cole este script e clique em "Run".

-- 1. Adiciona coluna para indicar se tem audiência (padrão falso)
ALTER TABLE defendants ADD COLUMN IF NOT EXISTS has_hearing BOOLEAN DEFAULT FALSE;

-- 2. Adiciona coluna para a data e hora da audiência
ALTER TABLE defendants ADD COLUMN IF NOT EXISTS hearing_date TIMESTAMP WITH TIME ZONE;

-- 3. Adiciona coluna para armazenar IDs de presos vinculados (Array de Texto)
ALTER TABLE defendants ADD COLUMN IF NOT EXISTS linked_defendant_ids TEXT[] DEFAULT '{}';

-- 4. Opcional: Indexar hearing_date se for usar para queries frequentes, mas não é crítico agora.
-- CREATE INDEX IF NOT EXISTS idx_defendants_hearing_date ON defendants(hearing_date);

-- Fim da migração
