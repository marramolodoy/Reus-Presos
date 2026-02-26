-- ==========================================
-- Unit Consolidation Script
-- Fixes missing data by merging duplicate units
-- ==========================================

DO $$
DECLARE
    -- Jacundá mapping
    jacunda_old UUID := 'e25b078c-fbf6-45ca-b979-e077a641d42a';
    jacunda_new UUID := '49ac6432-d430-4a91-926c-779c3db9ae8b';
    
    -- Goianésia mapping
    goianesia_old UUID := '16e59722-252a-490e-97bf-e679689d45f0';
    goianesia_new UUID := '00413b72-6013-4a15-b71b-9eed5b45fed8';
    
    -- Primavera mapping
    primavera_old UUID := '4006ffcb-1ac1-4122-b7dc-d20d77556a33';
    primavera_new UUID := 'a690a996-3ba5-42cc-94c2-691f28a1f1ca';
    
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules', 'sticky_notes',
        'productivity_logs'
    ];
BEGIN
    -- 1. Consolidate JACUNDÁ
    UPDATE public.user_roles SET unit_id = jacunda_new WHERE unit_id = jacunda_old;
    UPDATE public.unit_settings SET unit_id = jacunda_new WHERE unit_id = jacunda_old;
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('UPDATE public.%I SET unit_id = %L WHERE unit_id = %L', t, jacunda_new, jacunda_old);
    END LOOP;
    DELETE FROM public.units WHERE id = jacunda_old;
    
    -- 2. Consolidate GOIANÉSIA
    UPDATE public.user_roles SET unit_id = goianesia_new WHERE unit_id = goianesia_old;
    UPDATE public.unit_settings SET unit_id = goianesia_new WHERE unit_id = goianesia_old;
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('UPDATE public.%I SET unit_id = %L WHERE unit_id = %L', t, goianesia_new, goianesia_old);
    END LOOP;
    DELETE FROM public.units WHERE id = goianesia_old;
    
    -- 3. Consolidate PRIMAVERA
    UPDATE public.user_roles SET unit_id = primavera_new WHERE unit_id = primavera_old;
    UPDATE public.unit_settings SET unit_id = primavera_new WHERE unit_id = primavera_old;
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('UPDATE public.%I SET unit_id = %L WHERE unit_id = %L', t, primavera_new, primavera_old);
    END LOOP;
    DELETE FROM public.units WHERE id = primavera_old;

    -- 4. Clean up any remaining unit_id mismatches (safety check)
    -- If unit column (string) exists and doesn't match unit_id (UUID), 
    -- we might need to fix it, but let's stick to the mapping for now.
    
    RAISE NOTICE 'Unit consolidation completed successfully.';
END $$;
