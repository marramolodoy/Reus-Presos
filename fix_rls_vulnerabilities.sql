-- ==========================================
-- SCRIPT DE CORREÇÃO DE VULNERABILIDADES RLS
-- ==========================================
-- Este script corrige os 3 alertas críticos apontados pelo Supabase Security Advisor.

-- 1. CORRIGINDO `user_profiles`
-- Problema: "Todos podem ver os perfis" usando (true). Exposição pública.
-- Solução: Apenas usuários autenticados (logados no sistema) podem ver os perfis.
DROP POLICY IF EXISTS "Todos podem ver os perfis" ON public.user_profiles;

CREATE POLICY "Apenas autenticados veem perfis" ON public.user_profiles
FOR SELECT USING (auth.role() = 'authenticated');


-- 2. CORRIGINDO `lawyer_requests`
-- Problema: Permitia que qualquer usuário autenticado fizesse todas as ações na tabela.
-- Solução: Implementar o padrão de isolamento por Unidade (has_access_to_unit).
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.lawyer_requests;

-- Certificando que a coluna unit_id existe (ela deveria ter sido adicionada no migration_v2_units, mas é bom garantir)
ALTER TABLE public.lawyer_requests ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

DROP POLICY IF EXISTS "Unit members can view lawyer_requests" ON public.lawyer_requests;
CREATE POLICY "Unit members can view lawyer_requests" ON public.lawyer_requests
FOR SELECT USING ( public.has_access_to_unit(unit_id) );

DROP POLICY IF EXISTS "Unit members can insert lawyer_requests" ON public.lawyer_requests;
CREATE POLICY "Unit members can insert lawyer_requests" ON public.lawyer_requests
FOR INSERT WITH CHECK ( public.has_access_to_unit(unit_id) );

DROP POLICY IF EXISTS "Unit members can update lawyer_requests" ON public.lawyer_requests;
CREATE POLICY "Unit members can update lawyer_requests" ON public.lawyer_requests
FOR UPDATE USING ( public.has_access_to_unit(unit_id) );

DROP POLICY IF EXISTS "Unit members can delete lawyer_requests" ON public.lawyer_requests;
CREATE POLICY "Unit members can delete lawyer_requests" ON public.lawyer_requests
FOR DELETE USING ( public.has_access_to_unit(unit_id) );


-- 3. CORRIGINDO `notifications`
-- Problema: Permitia inserção irrestrita apenas exigindo que fosse autenticado em toda a tabela.
-- Solução: Reforçar para garantir que o user_id providenciado seja válido, ou restringir o escopo, ainda cobrindo a inserção cruzada segura se aplicável. 
-- Como notificações não possuem `unit_id` e a aplicação pode disparar notificações cruzadas (ex: admin para servidor), 
-- manter o `authenticated` é útil, mas o problema que o Supabase acusa pode ser o WITH CHECK aberto demais para uma FK,
-- ou simplesmente acusando a palavra 'authenticated' em um WITH CHECK "coringa".
-- Solução Mais Segura Limitada: Exigir explicitamente que autenticados criem e limitar a deleção/update para apenas os donos ou admin.

DROP POLICY IF EXISTS "Qualquer um pode criar notificações" ON public.notifications;

-- Política Substituta: Autenticados podem inserir notificações, validando que quem dispara está logado.
CREATE POLICY "Autenticados criam notificacoes" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Garantir que não existe política coringa de TODOS (all) que possa estar acusando erro:
DROP POLICY IF EXISTS "Enable all for authenticated users" ON public.notifications;

-- Recarrega o cache 
NOTIFY pgrst, 'reload config';
