# feat: P0 vertical slice — web + CRM (Google → Lead → Oportunidad → Propuesta → Ganada → Proyecto)

## Qué entra

- **Web** (`apps/web`): `/`, `/desarrollo-de-software`, `/diagnostico`, `/gracias`, `/aviso-de-privacidad` (borrador con campos PENDIENTE), 404, `/en` (estructura). Atribución first/last touch, eventos del contrato v1, `/api/events` y `/api/leads` con Zod, honeypot, Turnstile, límite de frecuencia y control de origen.
- **CRM** (`apps/crm`): login demo, bandeja de leads con deduplicación, conversión, pipeline (tablero y lista con filtros), actividades y tareas, propuestas con estados, ganar → proyecto, ficha 360, búsqueda, tablero canal → ingreso, auditoría para admin.
- **Paquetes**: `contracts` (Zod), `domain` (reglas puras), `db` (núcleo con RLS real por usuario), `ui` (sistema visual compartido).
- **Base de datos**: migraciones 0001 (AT-13), 0002 (RLS) y 0003 (ajustes del P0), más `seed.sql`.
- **CI**: GitHub Actions con Postgres 16, pruebas, build y E2E.

## Cómo revisar (≈ 2–4 h)

1. Mira las capturas en `docs/evidencia/` (01 → 09): es el flujo completo.
2. Lee `docs/P0-INFORME.md`: estado del backlog, cambios frente a AT-13 y verificación.
3. Revisa, en este orden: `supabase/migrations/` → `packages/contracts` → `packages/domain` → `packages/db` → `apps/web/app/api` → `apps/crm/lib/actions.ts`.
4. En el preview: entra al CRM con `ventas@ti24.example` y luego con `admin@ti24.example`.

## Verificación

- `pnpm test`: **43/43** (contrato, dominio, flujo contra Postgres real, RLS).
- `pnpm test:e2e`: **15/15** (móvil + escritorio).
- Lighthouse móvil, mediana de 3 corridas en local: Rendimiento 95–99, Accesibilidad 100. El LCP (2.1–2.8 s) queda pendiente de medir en el preview.

## Fuera de alcance (P1)

Supabase Auth con enlace mágico, notificación por correo de leads nuevos, PDF de propuesta, SLA en horas hábiles, suscripciones, tickets, landings P1 y contenido en inglés.

## Checklist de Abraham

- [ ] Dirección visual y textos aprobados
- [ ] RLS: ventas no borra ni lee auditoría (pruebas 9–12)
- [ ] Ningún secreto en el repositorio
- [ ] Aviso de privacidad: datos PENDIENTE identificados
- [ ] `VERIFIED`

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01PrJU8wUe4dnFbnsGB8b9KY
