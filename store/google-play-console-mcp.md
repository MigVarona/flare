# Google Play Console — Datos para publicar Flare

Documento pensado para copiar/pegar en Google Play Console o para entregarselo a un MCP/agente de navegador. Usar exactamente estos valores salvo que el usuario indique lo contrario.

## Identidad de la app

| Campo | Valor |
|---|---|
| Nombre de la aplicacion | Flare |
| Nombre del paquete Android | com.mivarona.churriapp |
| Tipo | Aplicacion |
| Precio | Gratis |
| Idioma predeterminado | Espanol (Espana) - es-ES |
| Categoria | Estilo de vida |
| Correo de contacto | info@wearecapa.es |
| Politica de privacidad | https://churri.pages.dev |
| Eliminacion de cuenta | https://churri.pages.dev/eliminar-cuenta.html |

## Release / pruebas

| Campo | Valor |
|---|---|
| Track inicial recomendado | Prueba interna |
| Factor de forma | Telefonos, Tablets, Chrome OS, Android XR |
| Version | 1.0.0 |
| Version code actual | 4 |
| Archivo a subir | Android App Bundle `.aab` |
| AAB de EAS | https://expo.dev/artifacts/eas/kJPNlM7BMxXG25HRqOjjyxAMed03wbKkdaR9mV6GpDA.aab |
| Canal EAS | production |
| Runtime version | 1.0.0 |

Notas de version:

```text
Primera version de prueba de Flare.
```

## Testers internos

Crear una lista de correo llamada:

```text
churri
```

Con estos emails si el usuario no indica otros:

```text
migvaronag@gmail.com
cristinaagomezz@gmail.com
```

Nota: Google Play permite hasta 100 testers en prueba interna. Dos testers son suficientes para una prueba interna.

## Ficha de Play Store

### Nombre corto

```text
Flare
```

### Descripcion corta

```text
Avisos, fotos y cinco mensajes. Un espacio privado para dos personas.
```

### Descripcion completa

```text
Flare es un espacio compartido entre dos personas. No hay feed, no hay audiencia, no hay nadie mas: entras con una llave que solo tiene la otra persona, y todo lo que hay dentro es de los dos.

AVISOS QUE LLEGAN A SU HORA
Deja un aviso y a la otra persona le suena el movil en el momento. A la hora senalada, su telefono se lo recuerda con una alarma exacta, y puede marcarlo como hecho o posponerlo media hora directamente desde la notificacion, sin abrir la app. Si el aviso lo merece, se pasa al calendario con un toque.

FOTOS SOLO PARA VOSOTROS
Las fotos se guardan cifradas en transito y se sirven en privado: no hay enlaces publicos. Cada foto lleva el color de quien la trajo.

CINCO MENSAJES
El espacio guarda solo los cinco ultimos mensajes. Cuando llega uno nuevo, el mas antiguo se apaga para los dos a la vez. Lo que os decis tiene que valer el sitio que ocupa.

EL COLOR DICE QUIEN
Cada persona lleva una luz. Todo lo que haces en el espacio lleva tu color, y donde vuestras dos luces se cruzan aparece un tercero que no es de ninguno. Elegis la pareja de colores del espacio entre seis combinaciones.

PRIVADO POR DISENO
Solo se entra con llave. Un espacio no se puede buscar ni listar. Sin publicidad, sin analitica de uso, sin vender datos. Y si os vais, todo se borra de verdad: tambien los archivos.

Flare es para dos: una pareja, dos hermanas, dos amigos a distancia. El numero lo pone la app; el vinculo lo poneis vosotros.
```

## Assets de ficha

| Asset | Archivo local |
|---|---|
| Icono alta resolucion 512x512 | `store/icon-512.png` |
| Grafico de funciones 1024x500 | `store/feature-1024x500.png` |
| Captura telefono | `store/screenshots/01-espacio.png` |

## Datos de inicio de sesion para revision

La app esta restringida porque requiere cuenta y espacio privado. Marcar:

```text
Si
```

Nombre del conjunto de datos:

```text
Reviewer test account
```

Usuario:

```text
RELLENAR_CON_EMAIL_DE_CUENTA_DE_PRUEBA
```

Contrasena:

```text
RELLENAR_CON_CONTRASENA_DE_CUENTA_DE_PRUEBA
```

Informacion adicional para acceder a la app, en ingles:

```text
Open the app and sign in with the test account above. If the app asks for a pairing code, create a new space from the onboarding screen. The app can also be tested with a second account by joining the space using the generated pairing code. There are no paid features.
```

Si no existe todavia una cuenta de prueba, crear una en la app antes de guardar esta seccion. Se puede usar un alias Gmail, por ejemplo:

```text
migvaronag+review@gmail.com
```

## Contenido de usuario / clasificacion

Respuestas recomendadas:

| Pregunta | Respuesta |
|---|---|
| Los usuarios pueden interactuar o intercambiar contenido | Si |
| El contenido generado por usuarios es el principal origen del contenido | Si |
| Permite compartir desnudos publicamente | No |
| Permite compartir publicamente violencia grafica real | No |
| Incluye capacidad de bloquear usuarios o contenido | No, salvo que Google acepte borrar cuenta/contenido propio como suficiente |
| Incluye capacidad de informar/reportar usuarios o contenido | No |
| Incluye moderacion de chat | No |
| Las interacciones pueden limitarse solo a amigos invitados | Si |
| Comparte ubicacion con otros usuarios | No |
| Permite compras digitales | No |
| Violencia, miedo, sexo, drogas, apuestas | No a todo |

Resultado esperado aproximado (clasificacion de contenido, IARC): PEGI 3, con aviso de interaccion entre usuarios. Esto solo describe el contenido (sin violencia, sexo, etc.), no la edad minima para usarla.

Importante: los Terminos de uso y la Politica de Privacidad de la app exigen tener 16 anos o mas. Esto se declara aparte en "Publico objetivo y contenido" de Play Console: marcar los rangos 16-17 y 18+ (no marcar "menores de 13" ni "13-15"), y responder que la app no esta dirigida a ni resulta atractiva para ninos.

## Seguridad de datos

### Recogida de datos y seguridad

| Pregunta | Respuesta |
|---|---|
| La app recoge o comparte datos de usuario de los tipos requeridos | Si |
| Los datos se cifran en transito | Si |
| Metodos de creacion de cuenta | Nombre de usuario, contrasena y otros metodos de autenticacion |
| URL de eliminacion de cuentas | https://churri.pages.dev/eliminar-cuenta.html |

### Datos recogidos

Declarar los datos que aplican:

| Tipo de dato | Se recoge | Uso principal | Compartido con terceros |
|---|---:|---|---:|
| Correo electronico | Si | Gestion de cuenta, autenticacion | No |
| Nombre | Si | Identificacion dentro del espacio privado | No |
| Fotos del usuario | Si | Funcionalidad de la app: album privado | No |
| Mensajes | Si | Funcionalidad de la app: mensajes privados | No |
| Recordatorios/avisos | Si | Funcionalidad de la app: avisos y alarmas | No |
| Token push / ID de dispositivo | Si | Enviar notificaciones | No |
| Identificador de usuario Firebase | Si | Gestion de cuenta y sincronizacion | No |

No declarar:

- Ubicacion.
- Contactos.
- Historial de busqueda.
- Datos de salud.
- Datos financieros.
- Publicidad.
- Analitica comercial, salvo que se anada una herramienta de analytics mas adelante.

### Propositos

Usar estos propositos donde aplique:

- Funcionalidad de la app.
- Gestion de cuentas.
- Comunicaciones del desarrollador solo para notificaciones operativas necesarias.

### Eliminacion de datos

La app permite borrar cuenta y datos asociados.

URL:

```text
https://churri.pages.dev/eliminar-cuenta.html
```

Resumen:

```text
Users can delete their account from the app settings. If they no longer have access to the app, they can request deletion by email from the same account address. Account data, profile data, photos, reminders and messages are deleted. Requests by email are handled within 30 days.
```

## Permisos sensibles / alarmas exactas

Si Play Console pregunta por `SCHEDULE_EXACT_ALARM`, usar esta justificacion:

```text
La funcion principal de la app son recordatorios que la otra persona debe recibir a la hora exacta que se ha fijado. Una alarma inexacta puede retrasarse minutos u horas y haria inutil la funcion.
```

## Anuncios, monetizacion y pagos

| Campo | Respuesta |
|---|---|
| Contiene anuncios | No |
| Compras en la app | No |
| App de pago | No |
| Monetizacion con Play | No configurada |

## Privacidad y politicas

| Campo | Valor |
|---|---|
| Politica de privacidad | https://churri.pages.dev |
| Eliminacion de cuenta | https://churri.pages.dev/eliminar-cuenta.html |
| Contacto desarrollador | info@wearecapa.es |

## Notas importantes para el MCP del navegador

- Si Google Play muestra `com.mivarona.churriapp (unreviewed)`, no subir otra build. Ese nombre temporal desaparece cuando la ficha se completa y Google la revisa.
- Si pide subir archivo, descargar el `.aab` desde la URL de EAS y subir el archivo local, no pegar la URL en el selector de archivos.
- Si pide testers internos, usar lista `churri`.
- Si el boton de guardar no se activa al crear lista de testers, pulsar Enter despues de escribir cada email para que aparezcan como direcciones anadidas.
- Si pide idioma o pais, priorizar Espana / Espanol.
- No inventar credenciales de revision. Pedir al usuario una cuenta de prueba real si falta email o contrasena.
