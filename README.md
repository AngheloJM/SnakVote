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
   voto a **Postgres** y la foto a una carpeta del servidor (`PHOTOS_DIR`).
4. El panel admin consulta la API (`GET /votes`, con filtros de fecha) y
   recibe actualizaciones en vivo por **WebSocket**.

## Stack técnico

| Componente | Tecnología |
|---|---|
| Kiosko | Tauri 2, Svelte 5, TypeScript, SQLite local (rusqlite) |
| Panel admin | React 19, TypeScript, Vite |
| Servidor | Rust, Axum, SQLx (Postgres), JWT (jsonwebtoken), Argon2 |
| Base de datos | PostgreSQL (auto-migraciones al arrancar el server) |
| Fotos | Carpeta del servidor (`PHOTOS_DIR`), borrado automático a los 90 días |
| Autenticación | JWT para el panel admin, clave compartida (`x-kiosk-key`) para el kiosko |

## Variables de entorno del servidor (`server/.env`)

Nunca se commitea (`.gitignore`). Ver `server/.env.example` para la lista de
claves. Resumen:

- `DATABASE_URL` — conexión a Postgres.
- `JWT_SECRET` — firma de los tokens del panel admin.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD` — opcionales, solo para el primer
  arranque: crean ese usuario si no existe (nunca sobrescriben una
  contraseña). Para crear usuarios o cambiar contraseñas:
  `server crear-admin <correo>` (pide la contraseña por consola, mínimo 12
  caracteres). Después del primer arranque conviene borrar
  `ADMIN_PASSWORD` del `.env`.
- `KIOSK_API_KEY` — clave compartida que usa el kiosko para votar sin login
  de usuario.
- `BIND_ADDR` — dirección y puerto donde escucha (por defecto `0.0.0.0:3000`;
  en producción `127.0.0.1:<puerto libre>`).
- `PHOTOS_DIR` — carpeta donde se guardan las fotos (obligatoria). En
  producción, ruta absoluta fuera de las carpetas de IIS.
- `PHOTO_RETENTION_DAYS` — fotos más viejas se borran una vez al día (por
  defecto 90).

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
Corre en `http://localhost:5173`. La URL del servidor sale de
`VITE_SERVER_URL`: `admin-panel/.env.development` para desarrollo y
`admin-panel/.env.production` para el
build de producción.

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

Windows Server propio con IIS; Postgres en otro
servidor. Repo clonado en `C:\inetpub\SnakVote`.

```
Internet / red interna ──443──► IIS, sitio "votokiosco" (votokiosco.conecta.com.bo)
                                 ├─ /auth /votes /uploads /ws /health ─► proxy ARR ─► 127.0.0.1:3000
                                 │                                        (servicio "VotoKiosco", NSSM)
                                 └─ resto ─► C:\inetpub\SnakVote\admin-panel\dist
```

- **Sitio IIS**: enlaces `https *:443` y `http *:80` con nombre de host
  `votokiosco.conecta.com.bo`, certificado comodín `*.conecta.com.bo`
  (compartido con los demás sitios del servidor). Requiere URL Rewrite, ARR
  con proxy habilitado y la característica "Protocolo WebSocket".
  Reglas en `admin-panel/public/web.config` (se copia a `dist/` al compilar).
- **Acceso**: panel y API accesibles desde la red interna y desde internet
  (los kioskos pueden sincronizar por datos móviles).
- **Servicio**: `VotoKiosco` (NSSM, `C:\Program Files\nssm\nssm.exe`),
  cuenta `NT SERVICE\VotoKiosco`, ejecuta
  `C:\inetpub\SnakVote\server\target\release\server.exe` con
  `AppDirectory` = `C:\inetpub\SnakVote\server` (ahí está el `.env`).
  Logs en `server\logs\server.log`.
- **Fotos**: `E:\FotoKiosco` (en `.env`: `PHOTOS_DIR='E:\FotoKiosco'`, con
  comillas simples).

### Actualizar

```powershell
$nssm = "C:\Program Files\nssm\nssm.exe"
& $nssm stop VotoKiosco
cd C:\inetpub\SnakVote; git pull
cd server; cargo build --release
cd ..\admin-panel; npm ci; npm run build
& $nssm start VotoKiosco
```

No ejecutar `git reset --hard` ni restaurar `server/migrations`: en el
servidor esos archivos tienen finales de línea CRLF y los checksums
guardados en la base corresponden a esa versión.

### Estado del despliegue (ir actualizando)

- [x] Servidor compilado y corriendo como Servicio de Windows (NSSM).
- [x] IIS como proxy reverso + HTTPS (probado con `curl --resolve`).
- [x] Panel admin desplegado como sitio estático.
- [x] CORS restringido (vacío en producción: mismo dominio).
- [ ] Registro DNS `votokiosco.conecta.com.bo` (interno y público) — pedido a IT.
- [ ] APK del kiosko compilado con `SERVER_URL` y `KIOSK_API_KEY` de producción.
- [ ] Backups de `E:\FotoKiosco` y de la base.
- [ ] Probar reinicio del servidor (el servicio debe arrancar solo).

## Notas de seguridad

- Las fotos son datos sensibles (potencialmente identifican empleados/
  clientes) — acceso al panel admin requiere login, y las fotos se sirven
  vía un proxy autenticado del servidor (nunca públicas directamente desde
  la carpeta de fotos). Retención automática de 90 días (tarea diaria del
  server). La carpeta de fotos debe tener permisos solo para la cuenta del
  servicio y estar incluida en los backups.
- Login del panel: tras 5 intentos fallidos una IP queda bloqueada 15
  minutos (respuesta 429).
- `server/.env`, `admin-panel` no tiene secretos propios (solo usa el token
  del login guardado en `localStorage`), y `kiosk-app/keystore/` están
  excluidos de git. Nunca commitear credenciales reales.
