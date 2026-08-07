-- ==========================================
-- RPC & RLS: Remove Team Member
-- Execute este script no SQL Editor do Supabase para habilitar a remoção de membros de equipe.
-- ==========================================

-- 1. Permissão RLS para deleção direta na tabela user_roles
DROP POLICY IF EXISTS "Admins can delete unit roles" ON public.user_roles;

CREATE POLICY "Admins can delete unit roles" ON public.user_roles
FOR DELETE USING (
    unit_id IN (SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
    OR
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 2. Função RPC remove_team_member
DROP FUNCTION IF EXISTS public.remove_team_member(UUID);

CREATE OR REPLACE FUNCTION public.remove_team_member(target_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _caller_unit UUID;
    _caller_role TEXT;
    _target_unit UUID;
BEGIN
    -- 1. Buscar informações do solicitante
    SELECT ur.unit_id, ur.role INTO _caller_unit, _caller_role
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() LIMIT 1;

    IF _caller_role IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Permissão negada.');
    END IF;

    -- 2. Buscar informações do membro a ser removido
    SELECT ur.unit_id INTO _target_unit
    FROM public.user_roles ur
    WHERE ur.user_id = target_id LIMIT 1;

    IF _target_unit IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Membro não encontrado na equipe.');
    END IF;

    -- 3. Verificar permissões
    IF _caller_role = 'super_admin' THEN
        -- Permitido para qualquer unidade
    ELSIF _caller_role = 'admin' AND _caller_unit = _target_unit THEN
        -- Permitido para membros da mesma unidade
    ELSE
        RETURN json_build_object('success', false, 'message', 'Apenas administradores podem remover membros de sua unidade.');
    END IF;

    -- 4. Excluir vínculo em user_roles
    DELETE FROM public.user_roles WHERE user_id = target_id;

    RETURN json_build_object('success', true, 'message', 'Membro removido da equipe com sucesso!');
END;
$$;

-- Atualizar cache de esquemas do PostgREST
NOTIFY pgrst, 'reload config';
