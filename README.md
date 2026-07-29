# Flare

**Avisos que suenan en el móvil correcto. Espacios pequeños, sin ruido.**

<p align="center">
  <img src="docs/screenshots/churri-closeup-01-home.png" width="250" alt="Pantalla de inicio" />
  <img src="docs/screenshots/churri-closeup-02-fotos.png" width="250" alt="Galería de fotos" />
  <img src="docs/screenshots/churri-closeup-03-mensajes-avisos.png" width="250" alt="Mensajes y avisos" />
</p>

Flare es una aplicación multiplataforma organizada en **espacios**: círculos privados de 1 a 8 personas — tú solo, tu casa, tu familia, un viaje. El repositorio es un monorepo con la aplicación móvil en Expo / React Native y la aplicación web en Next.js. Su primitivo central es el **aviso dirigido**: pides algo y suena en el móvil de quien tiene que hacerlo, a la hora exacta, con "Hecho" y "+30 min" desde la propia notificación. No hay feed, no hay audiencia, no hay historial infinito: a un espacio compartido se entra con una llave, y cada persona lleva un color que dice *quién* en todo lo que crea.

El proyecto está construido con especial atención a la seguridad y a la coherencia del sistema de diseño: cada decisión de arquitectura —desde cómo se firman las subidas de fotos hasta cómo se cifra la sesión en disco— está tomada para que la privacidad no dependa de la buena fe de un cliente, sino de reglas verificables en el servidor.

---

## Arquitectura

```
Apps (Expo móvil + Next.js web)
  │
  ├── Firebase Auth ──────── registro y login
  ├── Cloud Firestore ────── espacios, avisos, fotos, mensajes
  ├── Cloudflare Worker ──── firma subidas/borrados, envía notificaciones push
  │       │
  │       └── Cloudinary ─── almacenamiento de fotos (modo authenticated)
  │
  └── Firebase Cloud Functions ─── limpieza de Cloudinary si una foto se borra fuera de la app
```

**Decisión clave:** el Worker de Cloudflare no usa una cuenta de servicio para leer Firestore — lee con el token del propio usuario. Esto significa que las Firestore Security Rules son la única fuente de autorización en todo el sistema; no existe una segunda capa de lógica de permisos que pueda desincronizarse de la primera.

### Flujo de datos

1. **Avisos**: se crean en Firestore con destinatarios explícitos (`targetUids`: para mí, para alguien, para todos); cada teléfono destinatario programa una alarma local (`expo-notifications`) que se mantiene sincronizada en tiempo real, en todos los espacios a la vez.
2. **Fotos**: el cliente pide una firma de subida al Worker (que verifica el token de Firebase y la pertenencia al espacio) y sube directamente a Cloudinary; la API key de Cloudinary nunca llega al dispositivo.
3. **Mensajes**: las notas admiten texto y GIFs buscados directamente en GIPHY; solo se guarda en Firestore la referencia devuelta por el proveedor.
4. **Notificaciones push**: la app llama al Worker, que verifica membresía y lee el token del destinatario del propio documento del espacio antes de reenviar a la Expo Push API.

---

## Funcionalidades

**Espacios (1 a 8 personas)**
Cada cuenta nace con un espacio personal que funciona desde el primer minuto, sin necesidad de nadie más. Los espacios compartidos — casa, familia, un viaje — se abren con una llave criptográfica y admiten hasta 8 personas. Una misma cuenta vive en varios a la vez.

**Avisos dirigidos con hora exacta**
Un aviso suena en el móvil de quien tiene que hacerlo — el tuyo, el de otra persona o el de todos — en el momento programado, con acciones directas desde la notificación ("Hecho" / "+30 min") y sin necesidad de abrir la app. Si el aviso lo merece, pasa al calendario con un toque.

**Fotos privadas**
Almacenamiento cifrado en tránsito y servido en modo `authenticated` en Cloudinary — sin enlaces públicos. Cada foto queda asociada al color de quien la subió.

**Tablón con texto y GIFs**
Las notas admiten texto, reacciones y GIFs animados buscados directamente en GIPHY.

**Reacciones luminosas**
Seis señales animadas (parpadeo, chispazo, bengala, apagón, cortocircuito, fundido) para reaccionar a mensajes y fotos sin gastar un mensaje.

**Identidad por color**
Cada persona lleva un color fijo; todo lo que crea en el espacio lo lleva. El color viene del orden de llegada al espacio: cada paleta (Neón, Brasa, Selva, Cobalto, Coral, Lima) es una rampa ordenada de 8 luces, y tu posición en la lista de miembros es tu luz.

---

## Seguridad

- Acceso a los espacios compartidos exclusivamente mediante una llave de 6 caracteres generada con `expo-crypto` (criptográficamente segura, no `Math.random`).
- Los espacios no son enumerables ni listables por id: solo se descubren por pertenencia (`memberIds array-contains uid`), y las invitaciones son documentos independientes que solo permiten `get`, nunca `list`.
- Firestore Security Rules validan de forma estricta tipos, tamaños y transiciones de estado: unirse es exactamente *añadirse a uno mismo* al final de la lista, salir es *quitarse a uno mismo*, y solo el último miembro puede borrar el espacio.
- El perfil de cada cuenta (email incluido) es legible solo por su dueño: lo que otros miembros necesitan — nombre y token de push — viaja en el mapa `members` del propio espacio, donde cada uno solo puede escribir su entrada.
- El Worker de Cloudflare verifica cada petición contra las claves públicas de Google (JWKS) antes de firmar cualquier operación sobre Cloudinary.
- La sesión de Firebase se cifra con AES-256 antes de escribirse en disco; la clave vive en el Keychain/Keystore del sistema (`expo-secure-store`).
- Sin publicidad ni venta de datos. GIPHY recibe las búsquedas y solicitudes técnicas necesarias para mostrar su catálogo de GIFs.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework móvil | [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) + React Native 0.86 |
| Framework web | Next.js 16, App Router |
| Lenguaje | TypeScript (strict mode) |
| UI | gluestack-ui v5, Tailwind CSS v4 (Uniwind), react-native-reanimated |
| Autenticación | Firebase Auth (email + Google Sign-In) |
| Base de datos | Cloud Firestore |
| Proxy de autorización | Cloudflare Workers |
| Almacenamiento de fotos | Cloudinary (modo authenticated) |
| Buscador de GIFs | GIPHY API |
| Notificaciones push | Expo Push API |
| Backend serverless | Firebase Cloud Functions (Node 22) |
| Rutas | expo-router (file-based) |
| Plataformas | Android (Google Play) y web |

---

## Modelo de datos (Firestore)

```
users/{uid}  (solo legible por su dueño)   spaces/{spaceId}
  ├── email, displayName                     ├── kind: 'personal' | 'shared'
  └── expoPushToken?                         ├── name
                                             ├── memberIds: string[] (1..8, orden = color)
invites/{code}                               ├── members: Map<uid, {name, expoPushToken?}>
  ├── spaceId                                ├── inviteCode: string | null
  └── createdAt                              └── palette?

spaces/{spaceId}/reminders/{id}            spaces/{spaceId}/messages/{id}
  ├── title, dueAt, status                   ├── text (max 500)
  │                                          ├── o kind: 'gif' + gif: Map
  ├── createdByUid                           ├── senderId
  └── targetUids: string[]                   └── reactions: Map<uid, SignalId>

spaces/{spaceId}/photos/{id}
  ├── imageUrl (Cloudinary, firmada)
  ├── uploadedByUid
  └── reactions: Map<uid, SignalId>
```

El espacio personal tiene id determinista (`personal_{uid}`): su creación es idempotente y no puede duplicarse entre dispositivos.

---

## Estructura del proyecto

```
churriapp/
├── apps/
│   ├── mobile/               # Expo SDK 57 / React Native
│   │   ├── src/              # Rutas, componentes, contexto y adaptadores nativos
│   │   ├── assets/           # Iconos e imágenes de la aplicación
│   │   ├── app.json          # Configuración Expo
│   │   └── eas.json          # Build, Update y Submit (ejecutar EAS desde aquí)
│   └── web/                  # Next.js 16 / App Router
│       ├── src/app/          # Layouts y rutas web
│       └── public/           # Assets públicos
├── packages/
│   └── core/                 # Lógica compartida: fechas, repetición y rotaciones
├── worker/                   # Cloudflare Worker
├── functions/                # Firebase Functions
├── store/                    # Assets para Google Play
├── web/                      # Sitio estático anterior (se retirará al migrar sus rutas)
└── package.json              # npm workspaces y comandos del monorepo
```

---

## Primeros pasos (desarrollo)

```bash
# Instalar dependencias
npm install

# Configurar GIPHY para la aplicación móvil
cp apps/mobile/.env.example apps/mobile/.env.local

# Iniciar Expo
npm run dev:mobile

# Iniciar Next.js (otro terminal)
npm run dev:web

# Comprobar todos los workspaces
npm run typecheck

# Build web de producción
npm run build:web
```

Los comandos EAS se ejecutan desde la raíz de la aplicación móvil, por ejemplo:

```bash
cd apps/mobile
eas update --branch production --platform android --environment production
```

### Requisitos

- Node.js 22+
- Expo CLI
- Una cuenta de Firebase con proyecto configurado (Auth + Firestore)
- Una cuenta de Cloudinary
- Una cuenta de Cloudflare (para el Worker)
- Una cuenta de desarrollador de GIPHY

---

## Licencia

Todos los derechos reservados © 2026 We Are Capa / Miguel Varona Gallego.

El código de este repositorio es público para su revisión (portfolio), pero no está bajo una licencia de código abierto: no está permitido su uso, copia, modificación o redistribución sin autorización previa. Ver [LICENSE](LICENSE).

---

<p align="center">Flare — el espacio de los tuyos.</p>
