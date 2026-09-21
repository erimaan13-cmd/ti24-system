# CI de GitHub Actions (pendiente de activar)

GitHub rechazó subir `.github/workflows/ci.yml` porque la sesión de git de la laptop no tiene el permiso `workflow`
(«refusing to allow an OAuth App to create or update workflow … without `workflow` scope»).

Para activarlo, desde el sitio de GitHub (que sí tiene ese permiso):
1. En el repositorio: **Add file → Create new file** (agregar archivo → crear archivo nuevo).
2. Nombre: `.github/workflows/ci.yml`.
3. Pega el contenido de `docs/ci/ci.yml` y confirma en la rama `feat/p0-vertical-slice`.
