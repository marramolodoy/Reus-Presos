-- ==========================================
-- Rollback V2: Revert to Text-Based Unit Model
-- ==========================================
-- WARNING: This will delete the 'units' table and all 'unit_id' columns.
-- Ensure you have a backup if you have created NEW units since the migration.

-- 1. Revert RLS Policies
-- We need to drop the new "Unit members..." policies and restore "Team members..."

DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules', 'app_notifications', 'unit_settings'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Drop NEW policies
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can view %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can insert %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can update %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can delete %I" ON public.%I', t, t);
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Restore OLD policies (Text-based matching)
        -- Logic: Match owner_role.unit = requester_role.unit
        
        -- SELECT
        EXECUTE format('
            CREATE POLICY "Team members can view %I of same unit" ON public.%I
            FOR SELECT USING (
                auth.uid() = user_id OR
                EXISTS (
                    SELECT 1 FROM public.user_roles req
                    JOIN public.user_roles owner ON req.unit = owner.unit
                    WHERE req.user_id = auth.uid() AND owner.user_id = %I.user_id
                )
            )
        ', t, t, t);

        -- UPDATE
        EXECUTE format('
            CREATE POLICY "Team members can update %I of same unit" ON public.%I
            FOR UPDATE USING (
                auth.uid() = user_id OR
                EXISTS (
                    SELECT 1 FROM public.user_roles req
                    JOIN public.user_roles owner ON req.unit = owner.unit
                    WHERE req.user_id = auth.uid() AND owner.user_id = %I.user_id
                )
            )
        ', t, t, t);
        
        -- Restore INSERT/DELETE if they existed (usually they were owner-only or similar, 
        -- but for simplicity we revert to the main ones we modified)
    END LOOP;
END $$;

-- 2. Restore 'unit_settings' specific policies
DROP POLICY IF EXISTS "Users can view settings of their unit" ON public.unit_settings;
CREATE POLICY "Users can view settings of their unit" ON public.unit_settings
FOR SELECT USING (
    unit IN (SELECT unit FROM public.user_roles WHERE user_id = auth.uid())
);

-- 3. Drop Triggers
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules', 'app_notifications'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS set_unit_id_trigger ON public.%I', t);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.set_unit_id();
DROP FUNCTION IF EXISTS public.is_same_unit(UUID);

-- 4. Drop 'unit_id' columns
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules', 'app_notifications', 'unit_settings', 'user_roles'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS unit_id', t);
    END LOOP;
END $$;

-- 5. Drop 'units' table
DROP TABLE IF EXISTS public.units CASCADE;
