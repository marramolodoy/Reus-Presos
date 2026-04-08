-- ==========================================
-- Correção de Políticas RLS para Administrativo
-- Execute no "SQL Editor" do Supabase
-- ==========================================

DO $$
DECLARE
    t text;
    tables text[] := ARRAY['sei_requests', 'administrative_documents'];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- 1. Habilitar RLS nas tabelas
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

        -- 2. Limpar políticas antigas que possam estar causando conflito
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Users can view their own SEI requests" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own SEI requests" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can update their own SEI requests" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own SEI requests" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can view their own administrative documents" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can insert their own administrative documents" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can update their own administrative documents" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can delete their own administrative documents" ON public.%I', t);

            EXECUTE format('DROP POLICY IF EXISTS "Unit members can view %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can insert %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can update %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Unit members can delete %I" ON public.%I', t, t);
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- 3. Criar a política de SELECT (Leitura restrita à unidade)
        EXECUTE format('
            CREATE POLICY "Unit members can view %I" ON public.%I
            FOR SELECT USING ( public.has_access_to_unit(unit_id) )
        ', t, t);

        -- 4. Criar a política de INSERT (Escrita restrita à unidade)
        EXECUTE format('
            CREATE POLICY "Unit members can insert %I" ON public.%I
            FOR INSERT WITH CHECK ( public.has_access_to_unit(unit_id) OR auth.uid() = user_id )
        ', t, t);

        -- 5. Criar a política de UPDATE
        EXECUTE format('
            CREATE POLICY "Unit members can update %I" ON public.%I
            FOR UPDATE USING ( public.has_access_to_unit(unit_id) OR auth.uid() = user_id )
        ', t, t);
        
        -- 6. Criar a política de DELETE
        EXECUTE format('
            CREATE POLICY "Unit members can delete %I" ON public.%I
            FOR DELETE USING ( public.has_access_to_unit(unit_id) OR auth.uid() = user_id )
        ', t, t);

        -- 7. Garantir que a trigger de auto-assinatura de unit_id está funcionando
        EXECUTE format('DROP TRIGGER IF EXISTS set_unit_id_trigger ON public.%I', t);
        EXECUTE format('
            CREATE TRIGGER set_unit_id_trigger
            BEFORE INSERT ON public.%I
            FOR EACH ROW EXECUTE FUNCTION public.set_unit_id()
        ', t);

    END LOOP;
END $$;
