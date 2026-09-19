# VotoKiosco (SnakVote)

App de encuesta rápida y anónima-para-el-cliente para medir satisfacción en
el comedor/snack de la empresa. El cliente vota en un kiosko táctil (celular
o tablet) tocando una carita y un motivo rápido; el equipo revisa resultados
en un panel web con gráficos, tendencias y fotos.

## Componentes

```
kiosk-app/     App del kiosko (Tauri + Svelte + TypeScript). Corre en Android
               (y opcionalmente Linux/Windows de escritorio).
admin-panel/   Panel web para RRHH/supervisión (React + TypeScript + Vite).
server/        API backend (Rust + Axum + SQLx + Postgres).
```

### Flujo de datos

1. El kiosko captura el voto (carita + motivo rápido) y una foto de la
   cámara frontal.
2. Todo se guarda primero en una base **SQLite local** en el dispositivo
   (funciona sin internet).
3. Un proceso en segundo plano sincroniza cada ~15s con el servidor: sube el
   voto a **Postgres** y la foto a **Cloudflare R2**.
4. El panel admin consulta la API (`GET /votes`, con filtros de fecha) y
   recibe actualizaciones en vivo por **WebSocket**.

## Stack técnico

| Componente | Tecnología |
|---|---|
| Kiosko | Tauri 2, Svelte 5, TypeScript, SQLite local (rusqlite) |
| Panel admin | React 19, TypeScript, Vite |
| Servidor | Rust, Axum, SQLx (Postgres), JWT (jsonwebtoken), Argon2 |
| Base de datos | PostgreSQL (auto-migraciones al arrancar el server) |
| Fotos | Cloudflare R2 (S3-compatible), regla de borrado automático a los 90 días |
| Autenticación | JWT para el panel admin, clave compartida (`x-kiosk-key`) para el kiosko |

## Variables de entorno del servidor (`server/.env`)

Nunca se commitea (`.gitignore`). Ver `server/.env.example` para la lista de
claves. Resumen:

- `DATABASE_URL` — conexión a Postgres.
- `JWT_SECRET` — firma de los tokens del panel admin.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — se siembra un usuario admin al arrancar
  el server si no existe (o se actualiza la contraseña si ya existe).
- `KIOSK_API_KEY` — clave compartida que usa el kiosko para votar sin login
  de usuario.
- `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET`
  — credenciales de Cloudflare R2 (se puede usar un token de API de
  Cloudflare con permisos de R2: el ID del token es el Access Key ID, y el
  hash SHA-256 del token es el Secret Access Key).

## Desarrollo local

### Servidor
```bash
cd server
cp .env.example .env   # completar con datos reales
cargo run
```
Corre en `http://localhost:3000`. Las migraciones se aplican solas al
arrancar.

### Panel admin
```bash
cd admin-panel
npm install
npm run dev
```
Corre en `http://localhost:5173`. Apunta a `SERVER_URL` definido en
`admin-panel/src/api.ts`.

### Kiosko (desktop, para probar rápido)
```bash
cd kiosk-app
npm install
npm run tauri dev
```
Requiere Rust + dependencias de Tauri para Linux (`webkit2gtk`, etc. — ver
[tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)).

### Kiosko (Android)
Requiere Android SDK + NDK + un JDK 17 (Gradle todavía no soporta JDK más
nuevos) instalados y las variables `ANDROID_HOME`/`NDK_HOME`/`JAVA_HOME`
configuradas.

```bash
cd kiosk-app
npm run tauri android dev            # modo desarrollo, requiere el celular
                                      # y esta PC en la misma red (o USB)
```

Build de release (APK standalone, sin depender de la PC):
```bash
SERVER_URL="https://tu-dominio-real" \
KIOSK_API_KEY="la-clave-real" \
npm run tauri android build -- --apk
```
El APK firmado queda en
`kiosk-app/src-tauri/gen/android/app/build/outputs/apk/universal/release/`.

**Keystore de firma**: vive en `kiosk-app/keystore/` (gitignored, nunca se
sube). Si se pierde, no se pueden instalar actualizaciones sobre una
instalación ya existente — solo desinstalar y reinstalar desde cero
(perdiendo los votos que estén pendientes de sincronizar en ese momento en
ese dispositivo). Hacer backup de esa carpeta en un lugar seguro.

**Modo kiosko**: la app se fija en pantalla sola (`startLockTask`) y no deja
la pantalla bloquearse. Para un bloqueo total sin diálogo de confirmación,
ver `kiosk-app/KIOSK_MODE.md` (requiere configurar el dispositivo como
"Device Owner" antes de agregarle cuentas).

## Despliegue en producción

Arquitectura actual: Windows Server propio (no un PaaS como
Render/Railway), con IIS de proxy reverso hacia el binario del servidor
Rust, y Postgres en otro servidor Windows separado.

- **Servidor Rust**: se compila directo en el Windows Server
  (`cargo build --release`, requiere Visual Studio Build Tools + Rust). El
  `.exe` corre en un puerto local (ej. `3000`) y debería estar registrado
  como Servicio de Windows para que arranque solo.
- **IIS**: hace de proxy reverso (ARR + URL Rewrite) desde el dominio
  público con HTTPS hacia `localhost:3000`, y sirve el panel admin
  (`admin-panel`, build estático) como sitio separado.
- **Postgres**: base y usuario dedicados por app (no se usa el superusuario
  para la conexión de la app). Ver `server/examples/setup_db.rs` para el
  script de aprovisionamiento (crea rol + base con permisos acotados).

### Estado del despliegue (ir actualizando)

- [x] Servidor compilado y corriendo en el Windows Server, conectado a
      Postgres real.
- [x] R2 configurado y probado de punta a punta.
- [ ] IIS como proxy reverso + HTTPS.
- [ ] Servidor registrado como Servicio de Windows.
- [ ] Panel admin desplegado como sitio estático.
- [ ] Kiosko y panel apuntando a la URL/dominio final (hoy apuntan a IPs de
      red local de pruebas).
- [ ] CORS restringido al dominio final (hoy en modo permisivo).

## Notas de seguridad

- Las fotos son datos sensibles (potencialmente identifican empleados/
  clientes) — acceso al panel admin requiere login, y las fotos se sirven
  vía un proxy autenticado del servidor (nunca públicas directamente desde
  R2). Retención automática de 90 días configurada en el bucket.
- `server/.env`, `admin-panel` no tiene secretos propios (solo usa el token
  del login guardado en `localStorage`), y `kiosk-app/keystore/` están
  excluidos de git. Nunca commitear credenciales reales.
