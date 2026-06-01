# PRD 11 · Monetización & Paywall

## Modelo
**Freemium con decoy pricing de 4 tiers.** Mensual con opción anual (Fase 1, -20%).

| Tier | Precio/mes | Posicionamiento |
|------|-----------|-----------------|
| **Gratis** | $0 | Onboarding, prueba real del Ikigai. |
| **Pro** | $49 | El plan que la mayoría debería elegir. |
| **Publisher** | $119 | **Decoy** — visualmente menos atractivo, hace ver Empire barato. |
| **Empire** | $149 | Mejor valor, ring-primary, badge "Mejor Valor". |

## Feature matrix

| Feature | Free | Pro | Publisher | Empire |
|---------|:----:|:---:|:---------:|:------:|
| Proyectos activos | 1 | 5 | 20 | ∞ |
| Blueprints/mes | 3 | ∞ | ∞ | ∞ |
| ADN del autor + OCR | — | ✓ | ✓ | ✓ |
| Editor Tiptap + IA inline | básico | full | full | full |
| Auditor de manuscrito | — | — | ✓ | ✓ |
| Cover Engine (4 variantes) | — | ✓ | ✓ | ✓ |
| Export PDF KDP | con marca de agua | ✓ | ✓ | ✓ |
| Export DOCX | — | ✓ | ✓ | ✓ |
| Export ePub | — | — | ✓ | ✓ |
| ACX Script + SSML | — | — | ✓ | ✓ |
| Voice cloning (ElevenLabs) | — | — | — | ✓ |
| Traducción EN/ZH | — | — | — | ✓ |
| Distribución KDP/IngramSpark API | — | — | — | ✓ |
| Deep scraping competencia | — | — | — | ✓ |
| Soporte | comunidad | email | email priority | 24/7 dedicado |

## Gating UX
- Acción bloqueada por tier → **no esconder el botón**, mostrarlo deshabilitado con `lock` icon + tooltip "Disponible en Pro+".
- Click → abre `PricingModal` con tier mínimo requerido pre-seleccionado.
- Mensaje en el modal: "Esta acción requiere {tier}. Cambia ahora y desbloquea {feature}."

## Stripe integration (Fase 2)
- Productos: `prod_omf_pro`, `prod_omf_publisher`, `prod_omf_empire`.
- Server route `POST /api/public/stripe-webhook` valida firma HMAC, actualiza `public.subscriptions(user_id, tier, current_period_end)`.
- Customer Portal para gestión propia.

## Trial
- **14 días Pro gratis** al registrarse (sin tarjeta).
- Día 11: email "Tu trial termina pronto" + 20% off primer mes.

## Upgrade prompts contextuales
- Después de generar 3 blueprints → "¿Quieres ilimitados? Pro $49."
- Al intentar exportar PDF sin marca de agua → modal.
- Al completar Paso 4 → "Tu libro merece audiolibro. Empire."

## Métricas de monetización
- **MRR**, **ARR**, **NRR**.
- **Trial → Paid conversion** (target 22%).
- **Tier upgrade rate** Pro → Empire (target 8%/mes).
- **Churn mensual** (target < 4%).
- **LTV / CAC** > 4.
