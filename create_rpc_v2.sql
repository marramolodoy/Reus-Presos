-- ==========================================
-- RPC: Update User Permissions V2
-- Force new name to bypass schema cache issues
-- ==========================================

CREATE OR REPLACE FUNCTION public.update_user_permissions_v2(target_user_id UUID, new_permissions JSONB)
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
        
        -- Handle case where target has no unit (e.g. new user) or different unit
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
