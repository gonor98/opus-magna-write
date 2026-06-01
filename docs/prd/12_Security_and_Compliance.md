# PRD 12 · Seguridad & Compliance

## RLS (Row Level Security)
- Toda tabla `public.*` con datos de usuario tiene RLS habilitado.
- Política base: `auth.uid() = user_id`.
- Roles administrativos vía tabla `user_roles` + función `has_role()` security definer (canónico, jamás roles en `profiles`).

## Storage
- Buckets privados por default.
- Acceso vía signed URLs con TTL ≤ 1h.
- Path scoping: `{user_id}/...` con políticas storage.objects que validan `(storage.foldername(name))[1] = auth.uid()::text`.

## Secrets management
- `LOVABLE_API_KEY`, `STRIPE_SECRET_KEY`, `ELEVENLABS_API_KEY`, `STRIPE_WEBHOOK_SECRET` en server-only env.
- Jamás expuestos a cliente (no `VITE_*` para secretos).
- Lectura solo dentro de `.handler()` de server fns.

## Webhook security
- Firma HMAC verificada antes de cualquier procesamiento (`timingSafeEqual`).
- Idempotency keys en operaciones de Stripe.

## GDPR / privacidad
- Política de privacidad clara: datos del usuario solo se usan para servir su producto.
- Manuscritos NUNCA se usan para entrenar modelos (statement explícito).
- Derecho al olvido: endpoint `DELETE /api/account` borra proyectos, blueprints, audits, exports, assets en storage.
- Export de datos: ZIP descargable con todos los proyectos en JSON + assets.

## IP / Copyright
- El usuario es **dueño exclusivo** del contenido generado.
- Términos: Opus declina derechos sobre el output IA.
- Cláusula de uso aceptable: prohibido contenido ilegal, plagio, deepfakes no consensuados.

## AI Disclosure (legal en US, UK, EU)
- Watermark obligatorio en página de créditos del libro: *"Contenido producido con asistencia de IA generativa."*
- Audiolibros con voz clonada: disclaimer *"Voz sintética del autor reproducida con su consentimiento."*

## Voice cloning consent
- Antes de clonar voz: checkbox + texto "Confirmo que esta voz es mía o tengo permiso explícito del titular."
- Log de consentimiento en `public.consents (user_id, type, timestamp, ip)`.

## Auditoría
- Logs estructurados de cada server fn invocada (sin PII en logs).
- Retención logs: 90 días.

## Vulnerabilidades comunes mitigadas
- SQL injection: queries paramétricas vía Supabase client.
- XSS: React escapa por default; markdown sanitizado.
- CSRF: TanStack server fns mismo origen; tokens auth en httpOnly cookie.
- SSRF: Deep scraping con allowlist de dominios y timeout estricto.

## Pen-test cadence
- Anual con firma externa (Fase 3, prerequisito Serie A).
- Bug bounty público (Fase 3).
