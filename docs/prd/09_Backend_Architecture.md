# PRD 09 · Backend Architecture

## Filosofía
- **TanStack server functions** (`createServerFn`) son la API canónica para todo lo invocado desde la UI.
- **Server routes** (`src/routes/api/public/*`) solo para webhooks externos (Stripe, ElevenLabs) y crons.
- **Edge functions de Supabase NO se usan** en este stack.

## Supabase schema (Fase 0 → Fase 2)

### Tablas

```sql
-- Proyectos (libros)
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,           -- auth.uid() en Fase 1
  device_id TEXT,                  -- pre-auth fallback
  slug TEXT NOT NULL,
  title TEXT,
  subtitle TEXT,
  current_step INT DEFAULT 1,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,  -- snapshot del store
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Blueprints generados (histórico)
CREATE TABLE public.blueprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  payload JSONB NOT NULL,
  selected BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Auditorías
CREATE TABLE public.audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  report JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exports
CREATE TABLE public.exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  format TEXT NOT NULL,            -- pdf|docx|epub|acx
  asset_path TEXT NOT NULL,        -- bucket path
  size_bytes BIGINT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- KDP trends (cron diario)
CREATE TABLE public.kdp_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  keyword TEXT NOT NULL,
  volume INT,
  competition NUMERIC,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### GRANTs (obligatorios)
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
-- mismo patrón para blueprints, audits, exports
GRANT SELECT ON public.kdp_trends TO authenticated;
GRANT ALL ON public.kdp_trends TO service_role;
```

### RLS
```sql
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own their projects" ON public.projects
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
```

## Storage buckets

| Bucket | Visibilidad | Uso |
|--------|-------------|-----|
| `book-uploads` | Privado | Manuscritos crudos (existente) |
| `voice-samples` | Privado | Audios para DNA y voice clone |
| `book-assets` | Privado | Covers generadas, exports |
| `book-public` | Público | Covers publicadas (post-launch) |

## Auth flow (Fase 1)
- Email + password (Supabase Auth).
- Google OAuth (siempre, salvo opt-out).
- Email verification ON (no auto-confirm).
- Tabla `user_roles` (admin / user) con función `has_role()` security definer (canónico).

## Cron jobs (Fase 2)
- `kdp_trends_refresh`: diario 03:00 UTC, llena `kdp_trends`.
- Implementado vía Supabase pg_cron → POST a `/api/public/cron/kdp-refresh` (HMAC firmado).

## Error handling
- Server fns devuelven `{ data, error }` cuando recuperable.
- Errores críticos → throw → `errorComponent` de la ruta.
- Logs estructurados (JSON) a `console.error` → recogidos por Lovable Cloud.
