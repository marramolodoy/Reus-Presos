-- ==========================================
-- Fixer Script: Backfill Missing unit_id
-- ==========================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules', 'sticky_notes'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Print progress (optional/implicit)
        
        EXECUTE format('
            UPDATE public.%I t
            SET unit_id = ur.unit_id
            FROM public.user_roles ur
            WHERE t.user_id = ur.user_id 
            AND t.unit_id IS NULL
            AND ur.unit_id IS NOT NULL
        ', t);
    END LOOP;
END $$;
