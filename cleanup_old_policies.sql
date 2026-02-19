-- ==========================================
-- Policy Cleanup Script
-- Removes old/conflicting policies leaving only V2 Migration policies
-- ==========================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Generic Cleanup of known old policy names
        EXECUTE format('DROP POLICY IF EXISTS "Unit Select" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Unit Insert" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Unit Update" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Unit Delete" ON public.%I', t);
        EXECUTE format('DROP POLICY IF EXISTS "Unit Isolation Select" ON public.%I', t);
        
        -- Also drop granular policies if they conflict or assume single unit
        EXECUTE format('DROP POLICY IF EXISTS "Enable all access for authenticated users based on user_id" ON public.%I', t);

        -- We Keep: "Unit members can view/insert/update/delete %I" 
    END LOOP;
END $$;
