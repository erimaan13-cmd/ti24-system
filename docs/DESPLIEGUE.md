# Despliegue del P0 (MODO REAL: lo ejecuta Erick)

Claude preparó el código y verificó todo en local. **Crear cuentas, proyectos o variables es MODO REAL:** lo haces tú. Cada paso lleva su porqué.

## 0. Publicar el repositorio (una vez)

Esta sesión no tuvo acceso de escritura a `ErickInfante03/ti24-system` (GitHub respondió «GitHub access to this repository is not enabled for this session»). Por eso el código llega a tu laptop como una carpeta con su historial de git.

1. En VS Code: **File → Open Folder** (abrir carpeta) → la carpeta `ti24-system`.
   *Por qué:* VS Code ya trae git y el botón para publicar.
2. Panel **Source Control** (control de código) → rama `feat/p0-vertical-slice` → **Publish Branch** (publicar rama).
   Si el repositorio remoto ya existe vacío, en la terminal de VS Code:
   ```bash
   git remote add origin https://github.com/ErickInfante03/ti24-system.git
   git push -u origin main
   git push -u origin feat/p0-vertical-slice
   ```
   *Por qué:* `main` queda como base y la rama del P0 se revisa como PR.
3. En GitHub: **Compare & pull request** → pega el texto de `docs/PR.md`. **No hagas merge** hasta que Abraham revise.

## 1. Supabase (plan gratuito)

1. supabase.com → **New project** (proyecto nuevo) → nombre `ti24`, región `us-east-1` o la más cercana a Monterrey que ofrezca. Guarda la contraseña de la base en tu gestor de contraseñas.
   *Por qué:* datos separados de tu otro proyecto (AT-12 §4).
2. **SQL Editor** → pega y ejecuta, en orden: `supabase/migrations/0001_init.sql`, `0002_policies.sql`, `0003_p0_additions.sql` y `supabase/seed.sql`. **No** ejecutes `supabase/local/auth_stub.sql`: Supabase ya trae ese esquema.
   *Por qué:* el mismo esquema que pasó las 43 pruebas.
3. **Project Settings → Database → Connection string → Transaction pooler** (cadena del agrupador en modo transacción, puerto 6543). Esa es tu `DATABASE_URL`.
   *Por qué:* Vercel abre muchas conexiones cortas; el pooler las aguanta.
4. **PENDIENTE de verificar en Supabase:** que el usuario del pooler pueda ejecutar `set local role authenticated` (el CRM lo usa para aplicar RLS). Prueba en el SQL Editor: `begin; set local role authenticated; select 1; rollback;`. Si falla, avísame con el error literal.

> El plan gratuito se **pausa tras 1 semana sin uso**. Para la revisión de Abraham basta; antes de producción se decide el plan Pro y se transfiere a una organización de TI24.

## 2. Vercel: dos proyectos desde el mismo repositorio

Repite esto dos veces: una para la web y otra para el CRM.

| Campo | Web | CRM |
|---|---|---|
| Add New → Project → Import (agregar → proyecto → importar) | `ti24-system` | `ti24-system` |
| Project Name | `ti24-web` | `ti24-crm` |
| Root Directory (carpeta raíz) | `apps/web` | `apps/crm` |
| Framework | Next.js (se detecta solo) | Next.js |

**Variables de entorno** (Settings → Environment Variables):

| Variable | Web | CRM | Valor |
|---|---|---|---|
| `DATABASE_URL` | ✔ | ✔ | Cadena del pooler (paso 1.3) |
| `TENANT_ID` | ✔ | ✔ | `00000000-0000-0000-0000-000000000001` |
| `NEXT_PUBLIC_SITE_URL` | ✔ | | URL del preview de la web |
| `SITE_INDEXABLE` | ✔ | | `false` hasta completar el aviso de privacidad |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | ✔ | | Cloudflare Turnstile (gratis). **Obligatorias en Production**: sin ellas `/api/leads` responde 503 a propósito |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | ✔ | | Número de Abraham, formato `5281…` (sin «+»). Vacío = botón oculto |
| `SESSION_SECRET` | | ✔ | 64 caracteres aleatorios (`openssl rand -hex 32`) |
| `CRM_DEMO_PASSWORD` | | ✔ | Contraseña de la cuenta demo; compártela con Abraham por un canal privado |

*Por qué dos proyectos:* la web es pública e indexable; el CRM es privado y siempre `noindex`. Cada uno se despliega y se protege por separado.

**Plan de Vercel:** Hobby es solo para uso personal no comercial (AT-12 §4, VERIFICADO el 14-sep-2026). Para mostrarle el preview a Abraham, activa la prueba Pro de 14 días.

## 3. Verificar el preview (checklist)

1. Estado `PREVIEW_READY`: ambos proyectos muestran **Ready** (listo) en el PR.
2. Corre el E2E contra el preview desde tu laptop:
   ```bash
   WEB_URL=https://<preview-web> CRM_URL=https://<preview-crm> CRM_DEMO_PASSWORD=… pnpm test:e2e
   ```
   *Nota:* contra el preview no se reinicia la base; el flujo crea datos DEMO nuevos y es seguro repetirlo. Si Turnstile está activo en el preview, el formulario automatizado fallará: deja Turnstile solo en Production.
3. Lighthouse móvil en `/` y `/desarrollo-de-software` (Chrome → DevTools → Lighthouse → Mobile).
4. Abraham revisa el PR → estado `VERIFIED`.
