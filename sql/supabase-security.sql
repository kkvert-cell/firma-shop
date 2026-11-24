-- Защита данных в Supabase. Выполнить ПОСЛЕ supabase-schema.sql (и после любого переноса данных). Безопасно запускать повторно.
-- Зачем: Supabase открывает таблицы схемы public через публичный Data API по ключу anon. Сайт подключается напрямую к Postgres
-- ролью postgres и этого API не использует, поэтому API закрываем полностью: включаем RLS без политик и отбираем права у anon/authenticated.
-- Роль postgres, которой пользуется сайт, обходит RLS и продолжает работать как раньше.

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', r.tablename);
  END LOOP;
  FOR r IN SELECT sequencename FROM pg_sequences WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE public.%I FROM anon, authenticated', r.sequencename);
  END LOOP;
END $$;

-- Таблицы и последовательности, которые появятся позже (сайт создаёт часть таблиц сам), тоже не выдаются анонимным ролям
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon, authenticated;
