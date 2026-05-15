-- Cloud sync table for Opus Magna Studio projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (device_id, slug)
);

CREATE INDEX idx_projects_device ON public.projects(device_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Single-user demo app (no auth yet). Allow anon CRUD scoped client-side
-- via device_id. To upgrade later, replace with auth.uid() = user_id policies.
CREATE POLICY "anon read projects" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon insert projects" ON public.projects FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "anon update projects" ON public.projects FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "anon delete projects" ON public.projects FOR DELETE TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_projects_updated
BEFORE UPDATE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();