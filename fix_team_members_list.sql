-- ==========================================
-- FIX TEAM RPCS: ensure auth.users can be read
-- ==========================================

-- 1. Get My Team RPC
DROP FUNCTION IF EXISTS public.get_my_team();
CREATE OR REPLACE FUNCTION public.get_my_team()
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
    _caller_unit UUID;
BEGIN
    SELECT ur.unit_id INTO _caller_unit 
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() LIMIT 1;

    RETURN QUERY
    SELECT 
        ur.user_id,
        COALESCE(au.email::text, 'Usuario Desconhecido'),
        ur.role,
        ur.permissions,
        ur.created_at
    FROM public.user_roles ur
    LEFT JOIN auth.users au ON ur.user_id = au.id
    WHERE ur.unit_id = _caller_unit
    ORDER BY ur.role, au.email;
END;
$$;

-- 2. Get Unit Members RPC (for Super Admin)
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
    SELECT ur.unit_id, ur.role INTO _caller_unit, _caller_role 
    FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() LIMIT 1;

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

-- 3. Add Team Member V2 (Ensure logic)
CREATE OR REPLACE FUNCTION public.add_team_member_v2(target_email TEXT, target_unit_id UUID DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_uid UUID;
    requester_unit_id UUID;
    requester_role TEXT;
    final_unit_id UUID;
BEGIN
    -- 1. Get Requester Info
    SELECT unit_id, role INTO requester_unit_id, requester_role
    FROM public.user_roles
    WHERE user_id = auth.uid();

    IF requester_role IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Permissão negada.');
    END IF;

    -- 2. Determine Target Unit
    IF requester_role = 'super_admin' THEN
        IF target_unit_id IS NOT NULL THEN
            final_unit_id := target_unit_id;
        ELSE
            RETURN json_build_object('success', false, 'message', 'Super Admin deve especificar a Unidade.');
        END IF;
    ELSIF requester_role = 'admin' THEN
        final_unit_id := requester_unit_id;
    ELSE
         RETURN json_build_object('success', false, 'message', 'Apenas administradores podem adicionar membros.');
    END IF;

    -- 3. Find User by Email
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Usuário não encontrado. Peça para ele se cadastrar primeiro.');
    END IF;

    -- 4. Check if already in a team
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_uid) THEN
        RETURN json_build_object('success', false, 'message', 'Usuário já pertence a uma equipe.');
    END IF;

    -- 5. Insert into user_roles
    INSERT INTO public.user_roles (user_id, role, unit_id, unit)
    VALUES (
        target_uid, 
        'server', 
        final_unit_id,
        (SELECT name FROM public.units WHERE id = final_unit_id)
    );

    RETURN json_build_object('success', true, 'message', 'Membro adicionado com sucesso!');
END;
$$;

-- Force Schema Cache Reload
NOTIFY pgrst, 'reload config';
