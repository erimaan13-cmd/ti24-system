# apps/web — sitio público de TI24

Next.js 16. Páginas P0: `/`, `/desarrollo-de-software`, `/diagnostico`, `/gracias`, `/aviso-de-privacidad`, 404 y `/en`.

## Vercel (proyecto `ti24-web`)

- **Root Directory:** `apps/web` (con «Include files outside the root directory» activado: usa los paquetes de `packages/`).
- **Variables:** `DATABASE_URL`, `TENANT_ID`, `SITE_INDEXABLE=false`. Opcionales: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_CONTACT_EMAIL`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`/`TURNSTILE_SECRET_KEY` (obligatorias en Production).
- Guía completa: `docs/DESPLIEGUE.md`.
