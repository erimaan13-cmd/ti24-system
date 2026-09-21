# TI24 Commercial & Operations System

Monorepo con la **web pública** de TI24 y su **CRM**, que comparten un solo contrato de eventos, reglas de negocio y sistema visual.

> **Estado: P0 (vertical slice), prototipo en MODO ENSAYO.** Datos DEMO, textos en borrador, aviso de privacidad con campos PENDIENTE. Nada de esto está en producción.

## Qué hace el P0

El flujo completo funciona y lo prueba Playwright de punta a punta:

**Google → `/desarrollo-de-software` → «Agenda tu diagnóstico» → `/diagnostico` → Lead (canal Google) → calificar → convertir en Cuenta + Contacto + Oportunidad → Propuesta aceptada → Ganada → Proyecto.**

| Parte | Qué incluye |
|---|---|
| `apps/web` (Next.js 16) | `/`, `/desarrollo-de-software`, `/diagnostico`, `/gracias`, `/aviso-de-privacidad`, 404, `/en` (estructura). Captura de atribución (UTM, referrer, click ids, código REF de WhatsApp). API `/api/events` (idempotente) y `/api/leads` (Zod, honeypot, Turnstile, límite de frecuencia, control de origen) |
| `apps/crm` (Next.js 16) | Login (modo demo), bandeja de leads, deduplicación, conversión, pipeline (tablero y lista con filtros), actividades y tareas, propuestas con estados, ganar → proyecto, ficha 360 de cuenta, búsqueda, tablero canal → ingreso, auditoría (solo admin) |
| `packages/contracts` | Contrato de eventos `ti24.events/v1` y formulario de diagnóstico en Zod. Si la web o el CRM cambian un campo, el otro deja de compilar |
| `packages/domain` | Reglas puras: normalización de atribución, deduplicación, transiciones de lead, etapa y propuesta, totales, métricas con «datos insuficientes» |
| `packages/db` | Núcleo del CRM sobre Postgres: cada consulta del CRM corre con el rol `authenticated`, así **las políticas RLS se aplican de verdad** |
| `packages/ui` | Tokens y componentes del sistema visual «precisión tranquila» (AT-12 §6), compartidos por web y CRM |
| `supabase/` | Migraciones `0001` (modelo, AT-13), `0002` (RLS), `0003` (ajustes del P0) y `seed.sql` |

## Correr en local (5 pasos)

Requisitos: Node 22, pnpm 10 y PostgreSQL 15 o superior.

```bash
pnpm install                                   # 1. dependencias
cp .env.example .env                           # 2. variables (ver comentarios en el archivo)
createdb ti24_dev                              # 3. base local
DATABASE_URL=postgres://postgres:postgres@localhost:5432/ti24_dev pnpm db:reset   # 4. migraciones + catálogos + usuarios demo
pnpm dev:web   # http://localhost:3000        # 5. web
pnpm dev:crm   # http://localhost:3001        #    CRM (usuarios: admin@ti24.example y ventas@ti24.example; contraseña = CRM_DEMO_PASSWORD)
```

## Pruebas

```bash
TEST_DATABASE_URL=postgres://…/ti24_test pnpm test   # 43 pruebas: contrato, dominio y flujo real contra Postgres (incluye RLS)
pnpm build && pnpm test:e2e                          # 15 pruebas E2E (móvil y escritorio); reinicia la base ti24_e2e
```

Las capturas del flujo quedan en `docs/evidencia/`.

## Documentos

- `docs/P0-INFORME.md`: qué se construyó, cómo se verificó, qué falta y qué cambió respecto a AT-13.
- `docs/DESPLIEGUE.md`: Supabase y Vercel paso a paso (lo ejecuta Erick; MODO REAL).
- `docs/PR.md`: texto del pull request.

## Reglas que no se rompen

- El navegador **nunca** envía nombre, correo ni teléfono en eventos; el esquema los rechaza.
- `audit_events` es solo de agregar: la base impide editar o borrar, incluso al dueño.
- Ningún secreto en el repositorio: todo va en variables de entorno de Vercel.
- El sitio pide `noindex` mientras `SITE_INDEXABLE` no sea `true` (aviso de privacidad incompleto, D-21).
- Cambios de DNS: solo el registro A/CNAME de la web; **nunca** los MX del correo (AT-12 §2).
