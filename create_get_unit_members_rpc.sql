-- ==========================================
-- RPC: Get Unit Members (Super Admin Tool)
-- ==========================================

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
AS $$
BEGIN
    -- Check if requester is Super Admin or Admin of the same unit
    IF NOT EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() 
        AND (role = 'super_admin' OR (role = 'admin' AND unit_id = target_unit_id))
    ) THEN
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
    WHERE ur.unit_id = target_unit_id
    ORDER BY ur.role, au.email;
END;
$$;
