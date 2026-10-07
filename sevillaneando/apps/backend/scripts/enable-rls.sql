-- Habilita Row-Level Security en todas las tablas del esquema public.
-- Ejecutar desde el editor SQL de Supabase (o psql con un superusuario).
--
-- Contexto: el backend de Sevillaneando se conecta a Supabase con el rol
-- `service_role`, que omite RLS por diseño. Por tanto, habilitar RLS sin
-- definir políticas permisivas bloquea el acceso vía el cliente publico
-- (anon key) sin afectar al backend.

DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      -- Excluir tablas gestionadas por PostGIS (no somos owner).
      AND tablename NOT IN ('spatial_ref_sys')
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY;', t);
  END LOOP;
END;
$$;

-- Verificacion: todas las tablas deben aparecer con rowsecurity = true.
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
