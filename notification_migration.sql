-- Execute este script no Editor SQL do Supabase

-- 1. Tabela de Perfis de Usuário (Para vincular Nome/Alias ao ID)
CREATE TABLE IF NOT EXISTS user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  name TEXT NOT NULL,
  department TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança (RLS)
CREATE POLICY "Todos podem ver os perfis" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "Usuários podem atualizar seu próprio perfil" ON user_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir seu próprio perfil" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 2. Tabela de Notificações
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id), -- Quem recebe a notificação
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT, -- Link para o processo/documento
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Políticas de Segurança
CREATE POLICY "Usuários veem suas próprias notificações" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Usuários marcam como lida suas próprias notificações" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Permitir que qualquer usuário autenticado crie notificações para outros (ex: ao atribuir tarefa)
CREATE POLICY "Qualquer um pode criar notificações" ON notifications
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
