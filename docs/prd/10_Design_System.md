# PRD 10 · Design System

## Lenguaje visual
**Linear · Vercel · Stripe.** Minimalismo absoluto, glassmorphism contenido, motion sutil, jerarquía tipográfica fuerte.

## Tipografía
- **UI:** Inter (400/500/600/700/800).
- **Display / títulos:** Crimson Pro (serif, 600/700).
- **Editor (manuscrito):** Lora / Crimson Pro / Merriweather / Montserrat (configurable).

## Tokens (oklch)
Todos definidos en `src/styles.css`:

```css
--background: oklch(0.985 0.002 247);
--surface: oklch(1 0 0);
--foreground: oklch(0.20 0.03 264);
--primary: oklch(0.32 0.12 270);          /* deep indigo */
--ai: oklch(0.78 0.15 70);                /* amber */
--success: oklch(0.62 0.14 160);
--radius: 0.75rem;

--shadow-soft:     0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.05);
--shadow-elevated: 0 8px 24px -8px rgb(15 23 42 / 0.10), 0 2px 6px -2px rgb(15 23 42 / 0.06);
--shadow-luxe:     0 24px 60px -20px rgb(49 46 129 / 0.18), 0 8px 20px -8px rgb(15 23 42 / 0.08);
```

## Componentes core (shadcn)
- Button, Input, Textarea, Card, Dialog, Tabs, Toggle, Slider, Badge, Progress, Tooltip, Toast (sonner).

## Patrones recurrentes
- **Glass header:** `bg-surface/70 backdrop-blur-xl border-b border-border/60`.
- **Primary gradient:** `bg-gradient-to-r from-primary to-[color:var(--ai)]`.
- **Hover lift:** `transition hover:-translate-y-1 hover:shadow-luxe`.
- **Pill chip:** `rounded-full border border-border bg-surface px-3 py-1 text-xs`.

## Motion
- Tailwind animations: `animate-fade-in`, `animate-pulse`.
- Motion for React (Fase 2) para transiciones de paso del Stepper y reveal de Blueprints.
- Duración estándar: 200ms ease-out.

## Iconografía
**Lucide React** únicamente. Tamaño base 16px (h-4 w-4); títulos 20px.

## Accesibilidad (WCAG AA mínimo)
- Contraste 4.5:1 en texto < 18px.
- Focus visible: `focus-visible:ring-2 ring-primary ring-offset-2`.
- ARIA labels en todos los iconos sin texto.
- Skip-to-content link en root.
- Toasts con `aria-live="polite"`.

## Dark mode (Fase 2)
- Toggle en Header.
- Tokens duplicados en `.dark` selector con luminosidad invertida.

## Responsive breakpoints
- `sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1536.
- Stepper en móvil colapsa a 6 pastillas numeradas.
- Editor full-screen en móvil con barra inferior compacta.
