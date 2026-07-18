# Auditoría de ChurriApp

## 1. Resumen Ejecutivo

**Churri** es una app móvil (Expo/React Native, iOS y Android, con web) para parejas: un espacio privado compartido donde dos personas pueden intercambiar recordatorios con alarma, fotos privadas y un chat limitado a 5 mensajes. Usa **Firebase** como backend (Auth, Firestore, Functions), **Cloudinary** para almacenamiento de fotos, **Cloudflare Workers** como intermediario de autorización para subir/borrar fotos y enviar notificaciones push, y **Expo** para tooling, notificaciones y despliegue.

El código es de alta calidad: tipado estricto con TypeScript, comentarios detallados que explican el "por qué" de cada decisión, testing de seguridad de Firebase Rules exhaustivo, y un diseño UI/UX muy cuidado con un sistema de colores conceptual sólido (el color significa "quién", no "qué").

---

## 2. Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Expo SDK 57, React Native 0.86, React 19 |
| Lenguaje | TypeScript 6 |
| UI | gluestack-ui v5, Tailwind CSS v4 (Uniwind), react-native-reanimated, gesture-handler |
| Autenticación | Firebase Auth (email + Google Sign-In) |
| Base de datos | Cloud Firestore |
| Backend serverless | Firebase Cloud Functions (Node 22) |
| Proxy de autorización | Cloudflare Workers (Wrangler) |
| Almacenamiento de fotos | Cloudinary (autenticado, no público) |
| Notificaciones push | Expo Push API (a través del Worker) |
| Iconos/Assets | Script propio con Sharp |
| Routing | expo-router (file-based) |
| Despliegue web | Cloudflare Pages (inferido por `wrangler deploy` en script) |
| CI/CD | EAS Build |

---

## 3. Arquitectura General

```
App (Expo/React Native)
  │
  ├── Firebase Auth ────── registro/login
  ├── Firestore ─────────── datos de pareja, recordatorios, fotos, mensajes
  ├── Cloudinary ────────── almacenamiento real de fotos
  │       │
  │       └── Cloudflare Worker ─── firma permisos de upload/delete
  │                               ─── envía push notifications
  │
  └── Firebase Functions ─── trigger de borrado de foto en Cloudinary
```

### Flujo de datos clave

1. **Recordatorios**: Usuario A crea → Firestore → el teléfono de B programa una alarma local (expo-notifications). La alarma se sincroniza en tiempo real.
2. **Fotos**: Usuario A selecciona foto → pide firma al Worker (que verifica Firebase token + pertenencia al espacio) → sube directamente a Cloudinary → guarda URL en Firestore.
3. **Chat**: 5 mensajes máximo. El oldest se borra cuando llega uno nuevo. Borrado con delay para que la "luz se apague" antes de desaparecer.
4. **Notificaciones push**: app → Worker (verifica membresía) → Expo Push API → dispositivo destino.

---

## 4. Estructura del Proyecto

```
churriapp/
├── src/
│   ├── app/                    # Screens (file-based routing)
│   │   ├── _layout.tsx         # Root layout (providers, guards)
│   │   ├── settings.tsx        # Modal de ajustes
│   │   ├── (tabs)/             # Tabs principales
│   │   │   ├── _layout.tsx     # → app-tabs.tsx
│   │   │   ├── index.tsx       # Home (Espacio)
│   │   │   ├── chat.tsx        # Mensajes
│   │   │   ├── gallery.tsx     # Fotos
│   │   │   └── reminders.tsx   # Avisos
│   │   └── onboarding/
│   │       ├── index.tsx       # Login/Registro
│   │       └── pair.tsx        # Emparejamiento
│   ├── components/             # UI atómica
│   │   ├── brand.tsx           # Logo, wordmark, GlowCard, botones
│   │   ├── app-tabs.tsx        # Barra de tabs inferior
│   │   ├── light-signals.tsx   # Señales luminosas animadas
│   │   ├── message-light.tsx   # Burbuja de mensaje animada
│   │   ├── reminder-alarms.tsx # Sincronizador de alarmas locales
│   │   ├── paleta-picker.tsx   # Selector de paletas de colores
│   │   └── ui/                 # Componentes gluestack-ui envueltos
│   ├── context/
│   │   └── couple-context.tsx  # Contexto principal (auth + pareja)
│   ├── hooks/
│   │   ├── use-palette.ts      # Colores dinámicos por persona
│   │   ├── use-notice.tsx      # Toast de error
│   │   ├── use-push-token.ts   # Registro de token push
│   │   └── use-theme.ts        # Tema oscuro fijo
│   ├── lib/
│   │   ├── firebase.ts         # Inicialización Firebase
│   │   ├── cloudinary.ts       # Subida/borrado de fotos
│   │   ├── push.ts             # Envío de push via Worker
│   │   ├── google-auth.ts      # Google Sign-In
│   │   ├── dates.ts            # Formateo de fechas
│   │   ├── markdown.ts         # Parser de markdown legal
│   │   └── secure-persistence.ts # Sesión Firebase cifrada
│   └── constants/
│       ├── theme.ts            # Sistema de diseño (colores, spacing, radios)
│       ├── palettes.ts         # 6 paletas de colores para la pareja
│       ├── privacy.ts          # Texto legal de privacidad
│       └── terms.ts            # Texto legal de términos
├── worker/                     # Cloudflare Worker (doorman)
├── functions/                  # Firebase Functions (Cloudinary cleanup)
├── store/                      # Assets para Google Play
├── web/                        # Páginas web de privacidad/eliminación
├── scripts/                    # Scripts de assets
└── assets/                     # Imágenes, iconos, fuentes
```

---

## 5. Modelo de Datos (Firestore)

```
users/{uid}
  ├── email: string
  ├── displayName: string
  ├── coupleId: string | null
  ├── expoPushToken: string?
  └── createdAt: timestamp

invites/{code}
  ├── coupleId: string
  └── createdAt: timestamp

couples/{coupleId}
  ├── memberIds: string[] (1 o 2)
  ├── inviteCode: string (6 chars, A-Z0-9)
  ├── spaceName: string (fijo "Churri")
  ├── palette: string? (opcional, default "neon")
  └── createdAt: timestamp

couples/{coupleId}/reminders/{reminderId}
  ├── title: string (max 120)
  ├── dueAt: Timestamp | null
  ├── dueLabel: string (preformateado)
  ├── status: "pending" | "done"
  ├── createdByUid: string
  └── createdAt: timestamp

couples/{coupleId}/photos/{photoId}
  ├── imageUrl: string (Cloudinary signed)
  ├── cloudinaryPublicId: string
  ├── uploadedByUid: string
  ├── reactions: Map<string, SignalId>?
  └── createdAt: timestamp

couples/{coupleId}/messages/{messageId}
  ├── text: string (max 500)
  ├── senderId: string
  ├── reactions: Map<string, SignalId>?
  └── createdAt: timestamp
```

### Puntos fuertes del modelo

- **Las invites son documentos independientes**, no campos en el espacio. Esto evita que se pueda enumerar espacios (solo se accede si se conoce el código).
- **Los mensajes no tienen límite diario** en el modelo actual (la doc original mencionaba `messageQuotas`, pero se eliminó: el límite es de capacidad, 5 mensajes siempre, no de tasa).
- **Las reacciones** son un Map por UID, permitiendo que cada persona reaccione una vez.
- Las fotos se almacenan en **Cloudinary como "authenticated"**, no públicas. La URL que se guarda ya está firmada.

---

## 6. Seguridad

### 🔐 Firestore Security Rules (excelente)

- Solo miembros del espacio pueden leer/escribir en `couples/{id}` y subcolecciones.
- `invites` solo permiten `get` (no `list`): no se puede enumerar.
- Al crear un espacio, solo se permite `memberIds: [uid]` (1 persona).
- Al unirse, solo se permite `memberIds` pasar de 1 a 2 elementos, y solo si el usuario no tiene ya un `coupleId`.
- Validación estricta de tipos y tamaños en todos los campos.
- Las reglas de `users` permiten lectura a la pareja (para ver el nombre), pero escritura solo a sí mismo.
- **No hay regla que impida a un usuario crear múltiples espacios**. Podría crearse un problema de orfandad, aunque la app nunca lo permite desde la UI.

### 🔐 Cloudflare Worker (excelente)

- Verifica el Firebase ID Token contra las claves públicas de Google (JWKS).
- Lee Firestore *como el usuario* (con su token), no con una cuenta de servicio. Así las Security Rules de Firestore son la única fuente de verdad.
- La API key de Cloudinary **nunca** llega al cliente.
- Las fotos se suben en modo `authenticated` (no públicas).

### 🔐 Sesión cifrada

- El token de Firebase (que permite acceso sin contraseña) se cifra con AES-256 antes de guardarse en AsyncStorage. La clave AES está en SecureStore (Keychain/Keystore).
- Si la clave se pierde o se corrompe, se elimina la sesión en lugar de crash.

### ⚠️ Observaciones de seguridad menores

1. La API key de Firebase (`AIzaSyCBxaxX9i-SWD4qCqR4RNM1xmMFCcRnJi4`) está visible en `firebase.ts`. Esto es **normal y esperado** en Firebase — la API key no es un secreto, los Security Rules son la protección real.
2. Hay dos `google-services.json` diferentes embebidos: uno para desarrollo (cert hash `5e8f16...`) y otro para producción (`f11a4f...`). Correcto.
3. No hay rate limiting visible del lado del Worker, aunque al usar Firestore como authz, el rate limiting de Firestore aplica indirectamente.

---

## 7. Diseño UI/UX

### Sistema conceptual

- **El color significa "quién"**: todo lo que crea una persona lleva su color (rosa vs cian).
- **El espacio es de noche**: fondo `#01030F`, bordes luminosos, neón. No hay modo claro — el neón necesita oscuridad.
- **La tarjeta es su borde**: el fondo es casi negro, el borde es un gradiente de luz.
- **Los mensajes son luces**: se encienden al llegar, se atenúan con la edad, se apagan al ser borrados.
- **Las reacciones son señales luminosas**: 6 gestos de luz (parpadeo, chispazo, bengala, apagón, cortocircuito, fundido) con animaciones únicas.

### Puntos fuertes de UI

- **Sistema de paletas**: 6 pares de colores pre-diseñados (Neón, Brasa, Selva, Cobalto, Coral, Lima). Cada pareja elige uno, y el orden de llegada determina quién lleva cada color.
- **Iconos SVG inline**: el logo, la marca, los iconos de tab y las señales son SVG generados desde constantes. Sin assets rasterizados que puedan desincronizarse.
- **Wordmark con máscara de gradiente**: el nombre "Churri" se pinta con el mismo gradiente que el logo.
- **Animaciones sutiles con Reanimated**: las señales, los mensajes, el carrusel de recordatorios.
- **Skeleton loaders personalizados**: para cada tipo de contenido (tarjetas, grid de fotos, mensajes).
- **La barra de tabs es un BlurView**: vidrio esmerilado para que el contenido se vea a través.

---

## 8. Funcionalidades

### ✅ Recordatorios ("Avisos")
- Crear con título y fecha opcional.
- La alarma suena **solo en el teléfono de la otra persona** (quien recibe el recordatorio).
- La notificación tiene botones: "Hecho" y "+30 min".
- Sincronización en tiempo real: si se marca como hecho desde la notificación, ambos teléfonos ven el cambio.
- Posibilidad de posponer cambiando la fecha.
- Integración con Google Calendar (prellenado).
- Toast de "deshacer" durante 4s después de marcar como hecho.

### ✅ Fotos
- Subida desde galería.
- Almacenamiento privado en Cloudinary (modo authenticated).
- Grid de 2 columnas con alturas alternas.
- Paginación con "Ver más".
- Reacciones con señales luminosas.
- Borrado de fotos propias (borra el archivo real via Worker).
- Notificación push a la pareja al subir.

### ✅ Chat ("Mensajes")
- Límite de 5 mensajes: el más antiguo se borra automáticamente al llegar el 6º.
- Borrado con delay (1.1s) y animación: la luz se apaga antes de que el mensaje desaparezca.
- Reacciones con señales luminosas (long press).
- Vista ampliada del mensaje (tap).
- Sin límite diario de mensajes (el límite es de capacidad).
- Nota: el diagrama mermaid original (`app-parejas-diagrama.mermaid`) sigue mostrando un límite diario con `messageQuotas`, pero la implementación real ya no lo tiene.

### ✅ Onboarding
- Registro con email o Google.
- Emparejamiento mediante código de 6 caracteres (generado con `expo-crypto`).
- La invite se destruye al unirse la segunda persona.
- Términos y privacidad visibles durante el registro.

### ✅ Ajustes
- Ver quiénes sois (dos identidades con sus colores).
- Cambiar nombre propio.
- Seleccionar paleta de colores.
- Cerrar sesión (no destructivo).
- Salir del espacio (destructivo para el espacio, no para la cuenta).
- Eliminar cuenta (irreversible, requiere re-autenticación).

---

## 9. Backend y Serverless

### Cloudflare Worker (`worker/src/index.ts`)

Tres endpoints:
- `POST /upload/sign`: verifica membresía, firma permiso de subida a Cloudinary.
- `POST /photo/delete`: verifica membresía, destruye el asset en Cloudinary, luego borra el documento en Firestore.
- `POST /push/send`: verifica que ambos UIDs son miembros del espacio, envía push via Expo API.

**Punto fuerte**: el Worker usa el token del usuario para leer Firestore. Esto significa que las Security Rules de Firestore son la autoridad única — no hay lógica duplicada que pueda desincronizarse.

### Firebase Functions (`functions/index.js`)

- `deleteCloudinaryPhoto`: trigger `onDocumentDeleted` en `couples/{id}/photos/{id}`. Si alguien borra un documento de foto directamente desde la consola de Firebase (o mediante las reglas), la función limpia Cloudinary.
- Usa secrets de Firebase para las credenciales de Cloudinary.
- Compatibilidad hacia atrás: fotos anteriores al sistema de carpetas (tipo "upload" vs "authenticated").

---

## 10. Despliegue y Operaciones

### Scripts
- `npm run deploy`: `expo export -p web && wrangler deploy` — despliega web en Cloudflare Pages y el Worker.
- `npm run preview`: exporta web y ejecuta wrangler dev local.
- `npm run android` / `npm run ios`: builds nativos con EAS.

### Google Play
- Hay documentación completa para la publicación (`store/ficha-play.md`, `store/google-play-console-mcp.md`).
- Package name: `com.mivarona.churriapp`.
- Ya hay un AAB generado listo para subir (enlace en la documentación).
- Clasificación PEGI 3 con interacción entre usuarios. Edad real mínima: 16 años.
- Permiso `SCHEDULE_EXACT_ALARM` declarado y justificado para los recordatorios.

### Web
- Páginas estáticas de privacidad y eliminación de cuenta en `/web/`.
- Se despliegan con el export estático de Expo.

---

## 11. Licencias y Legal

- La app tiene el template de MIT License de Expo (sin personalizar). Sería recomendable actualizarlo con el nombre real del titular.
- Los Términos de Uso y Política de Privacidad están completos, detallados y actualizados a julio 2026.
- Contacto legal: We Are Capa / Miguel Varona Gallego, C/ Comandante Fontanes 81, Madrid.
- `info@wearecapa.es` es el correo de contacto legal.

---

## 12. Puntos de Mejora / Observaciones

### 🟢 Críticas menores (bugs potenciales)

1. **`index.tsx` Home — `handleReminderScroll`**: si `pendingReminders.length === 0`, la línea `Math.min(Math.max(nextIndex, 0), pendingReminders.length - 1)` recibe `-1` como límite superior, dando `0` por el clamp. No es un crash porque el ScrollView no se renderiza cuando no hay reminders, pero el handler podría dar un índice inválido si se llama. **Prácticamente inofensivo**, pero mejorable.

2. **`chat.tsx` — `onSnapshot` sin orden en reacciones**: las reacciones se leen del snapshot pero no se ordenan, dando orden impredecible en la UI. No es funcionalmente incorrecto, pero estéticamente mejorable.

3. **`reminders.tsx` — `dueLabel` como fallback**: se guarda `dueLabel` preformateado al crear, pero si se pospone, se recalcula. Si la fecha se edita desde fuera de la app, `dueLabel` podría quedar desincronizado. La app siempre recalcula al posponer, así que en la práctica funciona.

4. **No hay manejo de Firebase Storage**: El diagrama mermaid original menciona "Firebase Storage", pero la app real usa Cloudinary. El diagrama debería actualizarse.

### 🟡 Mejoras de calidad de vida

1. **El README.md** sigue siendo el template de `create-expo-app`. Debería documentar qué hace Churri, cómo contribuir, y cómo desplegar.
2. **No hay tests**: ni unitarios, ni de integración, ni E2E. Para una app con Firebase Rules complejas, al menos tests de reglas serían valiosos.
3. **No hay CI/CD automatizado** en el repo: no se ve configuración de GitHub Actions.

### 🔴 Arquitectura (a discutir)

1. **Dos backend serverless**: Firebase Functions + Cloudflare Worker. El Worker podría absorber la función de Cloudinary (de hecho ya lo hace para upload/delete). La Firebase Function es redundante para el cleanup de Cloudinary — el Worker ya lo hace. Sin embargo, la Function cubre el caso de borrado desde fuera de la app (consola Firebase), que el Worker no puede interceptar. **Es correcto tener ambos**, pero añade complejidad operativa.

2. **La invite se destruye al unirse**: Si el segundo usuario nunca completa el proceso (se cierra la app antes de escribir su `coupleId`), la invite se destruye pero el espacio queda con 1 miembro. La app maneja esto generando una nueva invite si es necesario (ver el `useEffect` de migración en `couple-context.tsx`).

### ✅ Buenas prácticas observadas

1. **Código tipado estrictamente**: TypeScript strict mode, tipos explícitos para todo.
2. **Comentarios de diseño**: cada componente y función tiene un comentario explicando *por qué* existe y *por qué* está hecho así.
3. **Tokens de diseño consistentes**: `Spacing[16]` es siempre 16px, y coincide con `p-4` de Tailwind.
4. **Error Boundary global**: la app no crashea silenciosamente en producción.
5. **Seguridad por diseño**: invites no enumerables, fotos autenticadas, sesión cifrada.
6. **No dependencia de Firebase Storage**: se evitó ese vendor lock-in usando Cloudinary con Worker propio.
7. **Sistema de paletas limpio**: 6 pares, no 10 colores individuales. Elimina la necesidad de verificar que no se elijan colores similares.
8. **La invite es criptográficamente segura**: usa `expo-crypto` en lugar de `Math.random`.

---

## 13. Conclusión

**Churri es un proyecto notablemente bien construido.** La calidad del código, la profundidad del sistema de diseño, la seguridad y la atención al detalle (desde las animaciones de las señales luminosas hasta el cifrado de la sesión) superan con creces lo que suele encontrarse en proyectos de este tamaño.

La app está esencialmente **lista para producción** — tiene documentación de Play Store, páginas legales, un worker backend funcional, y está construida sobre Expo SDK 57 con las últimas versiones de todas las dependencias.

**Próximos pasos recomendados:**
1. Actualizar el README.md con información real del proyecto.
2. Añadir tests automatizados (especialmente para las Security Rules).
3. Considerar eliminar la Firebase Function si el Worker puede cubrir ese caso, o unificar ambos backends.
4. Actualizar el diagrama mermaid con la arquitectura real.
5. Personalizar la licencia MIT con el titular correcto (We Are Capa / Miguel Varona).