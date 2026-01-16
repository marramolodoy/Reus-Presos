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

-- 5. Adiciona coluna para indicar Competência Delegada (Cível - RPV/Precatório)
ALTER TABLE civil_cases ADD COLUMN IF NOT EXISTS is_delegated BOOLEAN DEFAULT FALSE;

-- 6. Adiciona coluna para Status de Expedição (Pendente/Expedido)
ALTER TABLE civil_cases ADD COLUMN IF NOT EXISTS expedition_status TEXT DEFAULT 'pending';
ALTER TABLE civil_cases ADD COLUMN IF NOT EXISTS last_movement_date DATE;
ALTER TABLE civil_cases ADD COLUMN IF NOT EXISTS last_reevaluation_date DATE;

-- 7. Tabela de Documentos Administrativos
CREATE TABLE IF NOT EXISTS administrative_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    number TEXT NOT NULL,
    subject TEXT NOT NULL,
    date DATE NOT NULL,
    issuer TEXT CHECK (issuer IN ('Secretaria', 'Gabinete')) NOT NULL,
    file_path TEXT,
    document_type TEXT, -- Novo campo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE, -- Soft Delete
    user_id UUID REFERENCES auth.users(id)
);

ALTER TABLE administrative_documents ADD COLUMN IF NOT EXISTS document_type TEXT;
ALTER TABLE administrative_documents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 8. Tabela de Cartas Precatórias
CREATE TABLE IF NOT EXISTS rogatory_letters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    case_number TEXT NOT NULL,
    defendant_name TEXT NOT NULL,
    origin_court TEXT NOT NULL,
    type TEXT CHECK (type IN ('civil', 'criminal')) NOT NULL,
    received_date DATE NOT NULL,
    deadline_date DATE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'returned')),
    obs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    user_id UUID REFERENCES auth.users(id)
);

-- NOTA: Você precisará criar um Bucket no Supabase Storage chamado 'documents' e configurar as políticas de acesso (RLS).

-- 9. Adiciona coluna de Soft Delete para Casos Cíveis
ALTER TABLE civil_cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 10. Melhorias Carta Precatória (Campos Adicionais)
ALTER TABLE rogatory_letters ADD COLUMN IF NOT EXISTS purpose TEXT;
ALTER TABLE rogatory_letters ADD COLUMN IF NOT EXISTS has_hearing BOOLEAN DEFAULT FALSE;
ALTER TABLE rogatory_letters ADD COLUMN IF NOT EXISTS is_prisoner BOOLEAN DEFAULT FALSE;
ALTER TABLE rogatory_letters ADD COLUMN IF NOT EXISTS hearing_date TIMESTAMP WITH TIME ZONE;
ALTER TABLE rogatory_letters ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'incoming' CHECK (direction IN ('incoming', 'outgoing'));

-- 11. Adiciona coluna de Soft Delete para Mural de Avisos (Sticky Notes)
ALTER TABLE sticky_notes ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- 12. RLS (Row Level Security) para Isolamento de Dados
-- Enable RLS
ALTER TABLE administrative_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE sei_requests ENABLE ROW LEVEL SECURITY;

-- Create Policies for Administrative Documents
CREATE POLICY "Users can view their own administrative documents"
ON administrative_documents FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own administrative documents"
ON administrative_documents FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own administrative documents"
ON administrative_documents FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own administrative documents"
ON administrative_documents FOR DELETE
USING (auth.uid() = user_id);

-- Create Policies for SEI Requests
CREATE POLICY "Users can view their own SEI requests"
ON sei_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own SEI requests"
ON sei_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own SEI requests"
ON sei_requests FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own SEI requests"
ON sei_requests FOR DELETE
USING (auth.uid() = user_id);

-- Fim da migração
