-- Migration Script for 1crimtucurui@tjpa.jus.br
-- Move user and their orphan data to Vara Criminal de Tucuruí

DO $$
DECLARE
    _target_unit_id UUID := 'a03a95e7-e919-47d8-a9ca-53b9a9f8d0bc';
    _target_user_id UUID := 'e36fc76d-957a-453d-8833-a37bfb74d444';
BEGIN
    -- 1. Update User Role (Assign to Unit)
    INSERT INTO public.user_roles (user_id, unit_id, role)
    VALUES (_target_user_id, _target_unit_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE
    SET unit_id = _target_unit_id, role = 'admin';

    -- 2. Migrate Data (Only orphan data created by this user)
    
    -- Criminal
    UPDATE public.defendants 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Civil
    UPDATE public.civil_cases 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Sticky Notes
    UPDATE public.sticky_notes 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Lawyer Requests
    UPDATE public.lawyer_requests 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Rogatory Letters
    UPDATE public.rogatory_letters 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Penhora
    UPDATE public.penhora_orders 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Assets
    UPDATE public.seized_assets 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Administrative
    UPDATE public.administrative_documents 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- SEI
    UPDATE public.sei_requests 
    SET unit_id = _target_unit_id 
    WHERE user_id = _target_user_id AND unit_id IS NULL;

    -- Pending Schedules (if has user_id)
    -- specific check for pending_schedules table structure if needed, usually linked to defendant?
    -- Assuming linking logic handled by app, moving on.

END $$;
