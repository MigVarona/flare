# Churri

**Un espacio privado para dos personas.**

<p align="center">
  <img src="churri-closeup-01-home.png" width="250" alt="Pantalla de inicio" />
  <img src="churri-closeup-02-fotos.png" width="250" alt="Galería de fotos" />
  <img src="churri-closeup-03-mensajes-avisos.png" width="250" alt="Mensajes y avisos" />
</p>

Churri es una aplicación Android que crea un espacio digital compartido entre dos personas. No hay feed, no hay audiencia, no hay nadie más: entras con una llave que solo tiene la otra persona, y todo lo que hay dentro es de los dos.

---

## Funcionalidades

### 📋 Avisos que llegan a su hora
Deja un aviso y a la otra persona le suena el móvil en el momento exacto. Puede marcarlo como hecho o posponerlo media hora directamente desde la notificación, sin abrir la app. Si el aviso lo merece, se pasa al calendario con un toque.

### 📷 Fotos solo para vosotros
Las fotos se guardan cifradas en tránsito y se sirven en privado (Cloudinary en modo authenticated). No hay enlaces públicos. Cada foto lleva el color de quien la trajo.

### 💬 Cinco mensajes
El espacio guarda solo los cinco últimos mensajes. Cuando llega uno nuevo, el más antiguo se apaga — para los dos a la vez. Lo que os decís tiene que valer el sitio que ocupa.

### ✨ Señales de luz
Reacciona a mensajes y fotos con señales luminosas animadas (parpadeo, chispazo, bengala, apagón, cortocircuito, fundido). Cuestan cero — puedes decir "estoy aquí" sin gastar un mensaje.

### 🎨 El color dice quién
Cada persona lleva una luz. Todo lo que haces en el espacio lleva tu color, y donde vuestras dos luces se cruzan aparece un tercero que no es de ninguno. Elegís la pareja de colores del espacio entre seis combinaciones (Neón, Brasa, Selva, Cobalto, Coral, Lima).

### 🔒 Privado por diseño
- Solo se entra con una llave de 6 caracteres generada criptográficamente.
- Un espacio no se puede buscar ni listar.
- Sin publicidad, sin analítica de uso, sin vender datos.
- Las fotos se almacenan como privadas en Cloudinary y se sirven con URLs firmadas.
- La sesión de Firebase se cifra con AES-256 antes de tocar el disco.
- Si os vais, todo se borra de verdad: también los archivos en Cloudinary.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) + React Native 0.86 |
| Lenguaje | TypeScript |
| UI | gluestack-ui v5, Tailwind CSS v4 (Uniwind), react-native-reanimated |
| Autenticación | Firebase Auth (email + Google Sign-In) |
| Base de datos | Cloud Firestore |
| Proxy de autorización | Cloudflare Workers |
| Almacenamiento de fotos | Cloudinary (modo authenticated) |
| Notificaciones push | Expo Push API |
| Backend serverless | Firebase Cloud Functions (Node 22) |
| Rutas | expo-router (file-based) |
| Plataforma | **Android** |

---

## Estructura del proyecto

```
churriapp/
├── src/
│   ├── app/                  # Screens (file-based routing)
│   │   ├── _layout.tsx       # Layout raíz (providers, guards, error boundary)
│   │   ├── settings.tsx      # Ajustes
│   │   ├── (tabs)/           # Tabs principales
│   │   │   ├── index.tsx     # Espacio (home)
│   │   │   ├── chat.tsx      # Mensajes
│   │   │   ├── gallery.tsx   # Fotos
│   │   │   └── reminders.tsx # Avisos
│   │   └── onboarding/       # Registro y emparejamiento
│   ├── components/           # UI atómica
│   │   ├── brand.tsx         # Logo, wordmark, GlowCard, botones
│   │   ├── app-tabs.tsx      # Barra de tabs inferior
│   │   ├── light-signals.tsx # Señales luminosas animadas
│   │   ├── message-light.tsx # Burbuja de mensaje animada
│   │   ├── reminder-alarms.tsx # Sincronizador de alarmas locales
│   │   └── ui/               # Componentes gluestack-ui
│   ├── context/
│   │   └── couple-context.tsx # Contexto principal (auth + pareja)
│   ├── hooks/                # Custom hooks
│   ├── lib/                  # Firebase, Cloudinary, push, auth, persistencia
│   └── constants/            # Tema, paletas, textos legales
├── worker/                   # Cloudflare Worker
├── functions/                # Firebase Functions
├── store/                    # Assets para Google Play
├── web/                      # Páginas de privacidad y eliminación de cuenta
└── assets/                   # Imágenes, iconos, fuentes
```

---

## Primeros pasos (desarrollo)

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npx expo start
```

### Requisitos

- Node.js 22+
- Expo CLI
- Una cuenta de Firebase con proyecto configurado (Auth + Firestore)
- Una cuenta de Cloudinary
- Una cuenta de Cloudflare (para el Worker)

---

## Licencia

MIT © We Are Capa

---

<p align="center">Churri — un espacio para dos.</p>