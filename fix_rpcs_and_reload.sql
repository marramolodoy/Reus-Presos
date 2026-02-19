-- ==========================================
-- RPC: Get Unit Members (Super Admin Tool) - FIXED V3
-- ==========================================
-- Drop existing to avoid signature conflicts if slightly changed
DROP FUNCTION IF EXISTS public.get_unit_members(UUID);

CREATE OR REPLACE FUNCTION public.get_unit_members(target_unit_id UUID)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    permissions JSONB,
    joined_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    _target_id UUID := target_unit_id;
    _caller_unit UUID;
    _caller_role TEXT;
BEGIN
    -- Check caller permissions securely
    SELECT ur.unit_id, ur.role INTO _caller_unit, _caller_role 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() LIMIT 1;

    -- Allow Super Admin OR Admin of the same unit
    IF _caller_role = 'super_admin' OR (_caller_role = 'admin' AND _caller_unit = _target_id) THEN
        -- OK
    ELSE
        RAISE EXCEPTION 'Permission denied';
    END IF;

    RETURN QUERY
    SELECT 
        ur.user_id,
        COALESCE(au.email::text, 'Usuario Desconhecido'),
        ur.role,
        ur.permissions,
        ur.created_at
    FROM public.user_roles ur
    LEFT JOIN auth.users au ON ur.user_id = au.id
    WHERE ur.unit_id = _target_id
    ORDER BY ur.role, au.email;
END;
$$;

-- ==========================================
-- RPC: Update User Permissions (Super Admin Fix)
-- ==========================================
DROP FUNCTION IF EXISTS public.update_user_permissions(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.update_user_permissions(target_user_id UUID, new_permissions JSONB)
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
    -- Get caller info
    SELECT ur.unit_id, ur.role INTO _caller_unit, _caller_role 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() LIMIT 1;
  
    -- Check if allowed
    IF _caller_role = 'super_admin' THEN
        -- Super Admin can edit anyone
        -- (No check needed)
    ELSIF _caller_role = 'admin' THEN
        -- Admin can only edit users in same unit
        SELECT ur.unit_id INTO _target_unit FROM public.user_roles ur WHERE ur.user_id = target_user_id LIMIT 1;
        
        IF _target_unit IS DISTINCT FROM _caller_unit THEN
            RETURN json_build_object('success', false, 'message', 'Usuário alvo não pertence à sua unidade.');
        END IF;
    ELSE
        RETURN json_build_object('success', false, 'message', 'Apenas administradores podem gerenciar permissões.');
    END IF;

    -- Perform Update
    UPDATE public.user_roles
    SET permissions = new_permissions
    WHERE user_id = target_user_id;

    RETURN json_build_object('success', true, 'message', 'Permissões atualizadas com sucesso!');
END;
$$;

-- Force Schema Cache Reload (Standard Supabase trick)
NOTIFY pgrst, 'reload config';
