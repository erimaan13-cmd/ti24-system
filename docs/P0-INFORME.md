# P0 · Informe de construcción y verificación

**Fecha:** 21-sep-2026 · **Modo:** ENSAYO · **Base:** AT-11, AT-12, AT-13 · **Rama:** `feat/p0-vertical-slice`

## Conclusión en cinco líneas

1. **El vertical slice funciona de punta a punta.** Playwright recorre Google → landing → formulario → CRM → propuesta aceptada → ganada → proyecto (VERIFICADO en local, 21-sep-2026).
2. **58 pruebas en verde:** 43 de contrato, dominio y base de datos real (incluye RLS) y 15 E2E en móvil y escritorio.
3. **Lighthouse móvil (mediana de 3 corridas, local):** Rendimiento 95–99 y Accesibilidad 100 en las 5 páginas. SEO da 100 con indexación activa y 66 en preview porque el sitio pide `noindex` a propósito.
4. **El LCP queda cerca del límite:** 2.1–2.8 s simulado, contra una meta < 2.5 s. Hay que medirlo en el Vercel Preview (CDN real) antes de dar el criterio por cumplido.
5. **Pendiente humano:** publicar el repositorio, crear Supabase y Vercel, y la revisión de Abraham. Instrucciones en `DESPLIEGUE.md`.

## Backlog AT-13: estado

| # | Tarea | Estado | Evidencia |
|---|---|---|---|
| 1 | Monorepo (`apps/web`, `apps/crm`, `packages/*`, `supabase/migrations`) | ✅ Hecho | Compila; `pnpm typecheck` limpio en los 6 paquetes |
| 2 | Tokens y componentes base (`packages/ui`) | ✅ Hecho, **pendiente aprobación de Abraham** | Contraste AA (Lighthouse Accesibilidad 100); foco visible con contorno tinta + halo ámbar |
| 3 | Web P0 + estructura `/en` | ✅ Hecho | 5 páginas + 404; textos en `apps/web/content/` (borrador) |
| 4 | Atribución + `/api/events` + `/api/leads` | ✅ Hecho | E2E: rechaza inválido (422), otro origen (403), duplicado (`replayed`), honeypot, datos personales en eventos |
| 5 | Supabase: 0001 + RLS 0002 | ✅ Código hecho y probado en Postgres 16 · ⏳ Crear el proyecto (Erick) | Pruebas 9–12: ventas no borra, no lee auditoría, aislamiento entre inquilinos |
| 6 | CRM completo del P0 | ✅ Hecho | Flujo E2E + pruebas de dominio |
| 7 | E2E Playwright | ✅ En local · ⏳ En Vercel Preview | `tests/e2e/flow.spec.ts`; capturas en `docs/evidencia/` |
| 8 | Vercel | ⏳ Erick | `DESPLIEGUE.md` §2 |
| 9 | Revisión de Abraham | ⏳ Abraham | `docs/PR.md` |

## Lo que se agregó o cambió respecto a AT-13 (y por qué)

| Cambio | Porqué |
|---|---|
| Migración `0003_p0_additions.sql` (no se tocó 0001) | Hacían falta `suggested_account_id` (dedupe por dominio), `company_size`, `marketing_consent` y `disqualified_reason`, más dos excepciones acotadas de borrado para ventas (una línea de una propuesta en borrador, un servicio de una oportunidad abierta) |
| El CRM ejecuta cada consulta con `set local role authenticated` y el id del usuario en el JWT | Así RLS protege aunque haya un error en el código de la app. **PENDIENTE:** confirmar en Supabase (`DESPLIEGUE.md` §1.4) |
| **Login en modo demo** (cookie firmada + contraseña de entorno) en lugar del enlace mágico | El enlace mágico requiere el proyecto Supabase, que aún no existe. El resto del CRM solo usa `requireActor()`: el cambio a Supabase Auth toca 2 archivos (`lib/session.ts`, `lib/auth.ts`) |
| Catálogo P0: `DIAG, WEB, MKT, SOC, SYS, APP, MNT, EDU-IC, EDU-OP` | SYNC 2 (D-12). El formulario público ofrece solo lo que se entrega hoy; los cursos quedan fuera hasta que estén en oferta (D-18) |
| «Ganada» exige propuesta aceptada **y** monto > 0; el proyecto se crea solo si hay un servicio de tipo proyecto | Evita ganar sin documento y proyectos vacíos para servicios recurrentes |
| Enviar una propuesta pasa la oportunidad de «Diagnóstico» a «Propuesta» automáticamente | Un paso manual menos; queda en la auditoría |
| Wordmark como SVG con nombre accesible | El «24» ámbar sobre papel no cumple contraste como texto; como logotipo está exento (WCAG 1.4.3) y el lector de pantalla lee «TI24» |
| Límite de frecuencia en memoria (5 formularios / 10 min por IP; configurable) | Suficiente con tráfico bajo; con más tráfico pasa a un almacén compartido (P1) |
| `/api/leads` responde 503 en Production si falta Turnstile | Fallar cerrado: nunca publicar un formulario sin antispam |
| CI de GitHub Actions (`.github/workflows/ci.yml`) | Abraham ve las pruebas corriendo en cada PR sin instalar nada |

## Cómo se verificó (21-sep-2026, contenedor de Claude, PostgreSQL 16, Chromium 1194)

- **Migraciones:** `MIGRATION_OK` para 0001, 0002 y 0003; `SEED_OK`.
- **Pruebas de base de datos** (`packages/db/test/flow.test.ts`, 13 casos): idempotencia de eventos y formularios, duplicado por correo sin importar mayúsculas, cuenta sugerida por dominio, reglas de ganar y perder, propuesta completa, proyecto y cliente, reporte canal → ingreso (`google | 1 | 120,000`), RLS (ventas no borra; ventas no lee auditoría; otro inquilino no ve ni inserta), auditoría inmutable, y las restricciones de la base (aviso de privacidad, correo único).
- **E2E:** 15/15. Detectó y corrigió 2 defectos reales durante la construcción: la deduplicación dependía solo de Zod para pasar el correo a minúsculas, y el límite de frecuencia bloqueaba las pruebas (se hizo configurable).
- **Lighthouse móvil** (mediana de 3 corridas, servidor local de producción):

| Página | Rend. | Acces. | Buenas prác. | SEO* | LCP | TBT | CLS |
|---|---|---|---|---|---|---|---|
| `/` | 95 | 100 | 96 | 66 / 100 | 2.77 s | 108 ms | 0 |
| `/desarrollo-de-software` | 97 | 100 | 96 | 66 / 100 | 2.12 s | 179 ms | 0 |
| `/diagnostico` | 95 | 100 | 96 | 66 / 100 | 2.74 s | 119 ms | 0 |
| `/gracias` | 99 | 100 | 96 | 66 | 2.12 s | 61 ms | 0 |
| `/aviso-de-privacidad` | 97 | 100 | 96 | 66 | 2.57 s | 69 ms | 0 |

\* 66 con `noindex` (preview, intencional); 100 con `SITE_INDEXABLE=true`. «Buenas prácticas» 96: Lighthouse señala `'unsafe-inline'` en la CSP (Next.js lo necesita sin *nonces*; mejora P1).

## Pendientes

| Pendiente | Quién | Bloquea |
|---|---|---|
| Publicar el repo y abrir el PR | Erick | Todo lo demás |
| Proyecto Supabase «ti24» + verificar `set role` | Erick | Preview con datos |
| Vercel ×2 + variables | Erick | `PREVIEW_READY` |
| Aprobar la dirección visual y los textos | Abraham | Producción |
| Aviso de privacidad: razón social, domicilio, correo ARCO, proveedores + revisión legal | Abraham + asesor | Producción (`SITE_INDEXABLE=true`) |
| Número de WhatsApp y correo de contacto públicos | Abraham | Botón WhatsApp |
| Turnstile (llaves de Cloudflare) | Erick | Producción |
| Medir LCP en el preview; si > 2.5 s, cambiar `font-display` o precargar la fuente | Claude | Criterio de aceptación 3 |
| Supabase Auth (enlace mágico) en lugar del modo demo | Claude, cuando exista el proyecto | Uso real del CRM |
