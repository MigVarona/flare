# Flare Web

Aplicación web de Flare construida con Next.js App Router.

## Desarrollo

Desde la raíz del monorepo:

```bash
npm run dev:web
```

La interfaz base compila sin credenciales. Para conectar autenticación y Firestore, copia
`.env.example` como `.env.local` y completa la configuración de una aplicación web registrada
en el mismo proyecto Firebase que usa la aplicación móvil.
