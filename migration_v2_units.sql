-- ==========================================
-- Migration V2: Unit-Centric Model (Refined + Super Admin + Team Management)
-- ==========================================

-- 1. Create table 'units'
CREATE TABLE IF NOT EXISTS public.units (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Add 'unit_id' to 'user_roles'
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- 2.1 Update Role Check Constraint
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_role_check 
CHECK (role IN ('admin', 'server', 'restricted', 'readonly', 'super_admin'));

-- 3. Populate 'units' from existing text values
INSERT INTO public.units (name)
SELECT DISTINCT unit FROM public.user_roles WHERE unit IS NOT NULL
ON CONFLICT (name) DO NOTHING;

-- 4. Backfill 'unit_id' in 'user_roles'
UPDATE public.user_roles
SET unit_id = u.id
FROM public.units u
WHERE public.user_roles.unit = u.name;

-- 4.1 Migrate 'unit_settings' (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'unit_settings') THEN
        ALTER TABLE public.unit_settings ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);
        
        UPDATE public.unit_settings
        SET unit_id = u.id
        FROM public.units u
        WHERE public.unit_settings.unit = u.name;
    END IF;
END $$;


-- 5. Add 'unit_id' to all data tables
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
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id)', t);
        
        EXECUTE format('
            UPDATE public.%I t
            SET unit_id = ur.unit_id
            FROM public.user_roles ur
            WHERE t.user_id = ur.user_id AND t.unit_id IS NULL
        ', t);
    END LOOP;
END $$;

-- 6. Grant Access to 'units' table
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unit" ON public.units
FOR SELECT USING (
    id IN (SELECT unit_id FROM public.user_roles WHERE user_id = auth.uid()) 
    OR 
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
);

-- 7. Update RLS Policies

-- Helper function to check permissions: Same Unit OR Super Admin
CREATE OR REPLACE FUNCTION public.has_access_to_unit(record_unit_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() 
    AND (unit_id = record_unit_id OR role = 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply consolidated RLS to all tables
DO $$
DECLARE
    t text;
    tables text[] := ARRAY[
        'civil_cases', 'rogatory_letters', 'defendants', 'lawyer_requests',
        'penhora_orders', 'seized_assets', 'administrative_documents',
        'sei_requests', 'critical_issues', 'pending_schedules', 'unit_settings'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Drop old policies
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Team members can view %I of same unit" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Team members can update %I of same unit" ON public.%I', t, t);
             EXECUTE format('DROP POLICY IF EXISTS "Users can view %I of same unit" ON public.%I', t, t);
             EXECUTE format('DROP POLICY IF EXISTS "Users can view settings of their unit" ON public.%I', t, t); 
             EXECUTE format('DROP POLICY IF EXISTS "Unit members can view %I" ON public.%I', t, t);
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Create new SELECT policy
        EXECUTE format('
            CREATE POLICY "Unit members can view %I" ON public.%I
            FOR SELECT USING ( public.has_access_to_unit(unit_id) )
        ', t, t);

        -- Create new INSERT policy 
        EXECUTE format('
            CREATE POLICY "Unit members can insert %I" ON public.%I
            FOR INSERT WITH CHECK ( public.has_access_to_unit(unit_id) )
        ', t, t);

        -- Create new UPDATE policy
        EXECUTE format('
            CREATE POLICY "Unit members can update %I" ON public.%I
            FOR UPDATE USING ( public.has_access_to_unit(unit_id) )
        ', t, t);
        
        -- Create new DELETE policy
        EXECUTE format('
            CREATE POLICY "Unit members can delete %I" ON public.%I
            FOR DELETE USING ( public.has_access_to_unit(unit_id) )
        ', t, t);
    END LOOP;
END $$;

-- 8. Trigger for Auto-assign unit_id
CREATE OR REPLACE FUNCTION public.set_unit_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unit_id IS NULL THEN
        SELECT unit_id INTO NEW.unit_id
        FROM public.user_roles
        WHERE user_id = auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
        EXECUTE format('DROP TRIGGER IF EXISTS set_unit_id_trigger ON public.%I', t);
        EXECUTE format('
            CREATE TRIGGER set_unit_id_trigger
            BEFORE INSERT ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.set_unit_id()
        ', t);
    END LOOP;
END $$;

-- 9. USER ROLES RLS (Crucial for Team Management)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super Admins can view all roles" ON public.user_roles
FOR SELECT USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
);

CREATE POLICY "Super Admins can update all roles" ON public.user_roles
FOR UPDATE USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
);

CREATE POLICY "Super Admins can delete all roles" ON public.user_roles
FOR DELETE USING (
  exists (select 1 from public.user_roles where user_id = auth.uid() and role = 'super_admin')
);

-- Also allow normal admins to see their own team (Restricted to same unit)
CREATE POLICY "Admins can view their unit roles" ON public.user_roles
FOR SELECT USING (
  unit_id IN (select unit_id from public.user_roles where user_id = auth.uid())
);

-- 10. RPC: Add Team Member V2 (Unit-Aware + Super Admin Support)
CREATE OR REPLACE FUNCTION public.add_team_member_v2(target_email TEXT, target_unit_id UUID DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
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

-- 11. ASSIGN SUPER ADMIN (Automatic)
DO $$
DECLARE
    target_email TEXT := 'hectorclash01@gmail.com';
    target_uid UUID;
BEGIN
    -- Find user
    SELECT id INTO target_uid FROM auth.users WHERE email = target_email;

    IF target_uid IS NOT NULL THEN
        -- Check if role exists
        IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = target_uid) THEN
            -- Update existing role
            UPDATE public.user_roles
            SET role = 'super_admin'
            WHERE user_id = target_uid;
        ELSE
            -- Insert new role (Assign to first available unit or just leave unit null/dummy if allowed)
            -- Ideally Super Admins should be linked to a unit for UI consistency, picking the first one found.
            INSERT INTO public.user_roles (user_id, role, unit, unit_id)
            VALUES (
                target_uid,
                'super_admin',
                (SELECT name FROM public.units LIMIT 1),
                (SELECT id FROM public.units LIMIT 1)
            );
        END IF;
    END IF;
END $$;
