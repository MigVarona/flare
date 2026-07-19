# Flare 2.0 — De "un espacio para dos" a "el espacio de los tuyos"

**Propuesta de pivote de producto.** Julio 2026.

---

## 1. La tesis

Flare hoy es una app para parejas. Eso tiene dos problemas que no se arreglan con más features:

1. **No sirve de nada en soledad.** El onboarding termina en una pared: "invita a tu pareja". Si no tienes a quién invitar —o no quieres una app *de pareja*— la app no existe para ti.
2. **"Pareja" es a la vez el mercado y el techo.** Las apps de pareja compiten en lo emocional (Paired, Agapé, Between…) y viven de contenido: preguntas del día, juegos, rituales. Flare no es eso ni quiere serlo. Lo que Flare hace bien es **práctico**, y lo práctico no es exclusivo de las parejas.

La tesis del pivote:

> **El valor real de Flare nunca fue "pareja". Es un primitivo que casi ninguna app tiene: hacer sonar un aviso en el móvil de la persona correcta, a la hora correcta, con un color que dice quién y acciones que evitan abrir la app.**

Todo lo demás —fotos, mensajes, reacciones— orbita alrededor de eso. Y ese primitivo es útil para una persona sola, para una pareja, para un piso compartido, para una familia y para un grupo de amigos organizando un viaje.

El pivote no es "quitar lo de pareja". Es **quitar la condición de pareja**: la app pasa a ser útil desde el minuto uno en solitario, y cada persona que añades la hace mejor.

---

## 2. Lo que se conserva (porque es oro)

Antes de tocar nada, inventario de lo que ya es diferencial y **no se negocia**:

| Activo | Por qué es oro |
|---|---|
| **Avisos que suenan en otro móvil** | La mayoría de apps de recordatorios son *para ti*. Pedirle algo a otra persona pasa por el chat ("¿puedes sacar la basura?") y muere ahí. Flare convierte "pedir algo" en un objeto de primera clase: suena en su móvil, con "Hecho" y "+30 min" desde la propia notificación. |
| **Color = quién, no qué** | Cada persona es un color; todo lo que crea lo lleva. Es un sistema de identidad visual que no necesita avatares, nombres ni etiquetas. Escala de 2 a N sin cambiar de idea. |
| **Anti-feed por diseño** | El chat de 5 mensajes no es una limitación: es la promesa de que aquí no se acumula ruido. Esa promesa vale aún más en grupos, donde todo degenera en un WhatsApp infinito. |
| **Seguridad verificable en servidor** | Rules como única fuente de autorización, Worker sin cuenta de servicio, invitaciones no enumerables, sesión cifrada. Nada de esto cambia; todo se reaprovecha. |
| **Simplicidad radical** | Tres taps para cualquier cosa. El pivote no puede costar ni un tap más. |

Y el nombre: **Flare encaja mejor con el pivote que con el producto actual.** Una bengala es exactamente esto: una señal que lanzas para que la vea quien tiene que verla. El aviso *es* la bengala. La metáfora de luces (cada persona una luz, el espacio donde se cruzan) sobrevive intacta y gana sentido.

---

## 3. El nuevo concepto: Espacios

La palabra "pareja" desaparece del modelo. Nace el **Espacio**: un círculo pequeño de 1 a 8 personas con un propósito práctico.

### 3.1 Solo-first: útil desde el minuto uno

El cambio más importante de todos, y el más barato:

- Te registras → **tu espacio personal ya existe y ya funciona**. Sin pared, sin invitación pendiente, sin "esperando a tu pareja".
- En solitario, Flare es: tus avisos con alarma exacta (que ya suenan con acciones directas), tu tablón de notas que importan *ahora*, y tu archivo de fotos útiles (el ticket, el contador de la luz, dónde aparcaste).
- Invitar a alguien no es un requisito: es un **upgrade natural**. El día que compartes piso, o planificas un viaje, el espacio compartido está a un código de distancia.

Esto invierte el funnel: hoy el 100% del valor está detrás de conseguir que *otra persona concreta* se instale la app. Con solo-first, el valor está delante, y la invitación llega cuando hay un motivo real.

### 3.2 Espacios múltiples

Una persona vive en varios círculos a la vez. Flare lo refleja:

- **Personal** (solo tú) — siempre existe, no se puede borrar.
- **Casa** — con tu pareja o compañeros de piso.
- **Familia** — padres, hermanos, la logística de los abuelos.
- **Viaje a Lisboa** — temporal, se archiva al volver.

Cada espacio tiene su propia paleta, su propio tablón, sus propios avisos. Cambiar de espacio es un gesto (selector arriba, estilo cuentas de Gmail). El límite de 8 miembros no es técnico: es identidad de producto. Flare es para **círculos donde todos se conocen**, no para comunidades. Ese límite es lo que mantiene el color como identidad viable y el tablón como algo legible.

### 3.3 El color escala con el orden de llegada

El mecanismo actual ya generaliza gratis: hoy `memberIds[0]` es la primera luz y `memberIds[1]` la segunda. Mañana, **tu posición en la lista de llegada es tu color**. Cada paleta pasa de un par a una rampa ordenada de hasta 8 luces diseñadas para convivir (las dos primeras coinciden con las actuales, para que las parejas existentes no noten el cambio).

Nada que negociar, nada que almacenar por persona, nada que configurar. Igual que hoy.

---

## 4. El primitivo central: el Aviso dirigido

Aquí está el producto. Todo lo que genera interés sale de enriquecer este objeto, no de añadir features alrededor.

### 4.1 Lo que ya hace (y casi nadie más hace)

- Suena en el móvil de la otra persona a la hora exacta.
- "Hecho" / "+30 min" desde la notificación, sin abrir la app.
- Sincronizado en tiempo real: si lo edito, tu alarma cambia sola.

### 4.2 Lo que le falta para ser imparable

**Dirigido a quien sea.** Hoy un aviso es implícitamente "para la otra persona". Pasa a tener destinatario explícito: **para mí** (autorecordatorio, el caso solo), **para X** (el actual), o **para todos** (la reunión del piso, la salida del viaje). El aviso se pinta del color de quien lo debe hacer.

**Recurrencia.** La vida práctica es recurrente: la basura los martes, la medicación a las 9, el alquiler el día 1, regar las plantas. Sin recurrencia, Flare es para excepciones; con ella, es para la vida diaria. Es la feature #1 en impacto/esfuerzo.

**Rotación.** La feature estrella del pivote, y la que mejor usa lo que Flare ya tiene. Un aviso recurrente puede **rotar entre miembros**: la basura suena esta semana en tu móvil (con tu color), la siguiente en el mío (con el mío). El color deja de ser decoración y pasa a responder la pregunta eterna de toda convivencia: *¿a quién le toca?* Ninguna app popular hace esto bien sin convertirse en un gestor de proyectos.

**Visibilidad del "Hecho".** Cuando marcas "Hecho", yo lo veo — un destello de tu color en mi pantalla, sin mensaje, sin chat. Esto elimina la conversación más repetida del mundo: "¿lo hiciste?". Pedir → sonar → hecho → visto, sin una sola palabra escrita.

**Pásalo.** Un aviso se reasigna con un gesto. "No llego a recoger el paquete" → lo deslizas hacia el color de otro. La notificación se lo cuenta.

### 4.3 La narrativa

> *"Lanza una bengala. Suena en el móvil de quien tiene que verla. Cuando esté hecho, lo verás brillar."*

El vocabulario de producto ya existe (señales luminosas, destellos, apagones). No hay que inventar marca nueva: hay que apuntarla a lo práctico.

---

## 5. Los tres pilares, reencuadrados

La estructura de tabs sobrevive; cambia el encuadre de cada pilar de *íntimo* a *práctico*.

### Avisos → el corazón (sin cambios de encuadre, con superpoderes nuevos)
Todo lo del punto 4. Es la razón de instalar Flare.

### Chat de 5 mensajes → **el Tablón**
El límite de capacidad se reencuadra como lo que siempre fue: **la puerta de la nevera, digital**. Un espacio tiene N huecos (5–7) para lo que importa *ahora*: "la llave está en el buzón", "el wifi es X", una foto del horario. Una nota nueva apaga la más antigua. Las notas pueden ser texto o foto, y llevan el color de quien las puso.

- No es un chat. No hay historial, no hay scroll infinito, no hay "escribiendo…". Eso es WhatsApp, y WhatsApp ya existe.
- Una nota se puede **fijar** (no la apaga la rotación) — máximo 1–2 fijadas, para que el límite siga siendo real.
- Las reacciones luminosas viven aquí tal cual están.

### Fotos → **el Archivo**
De "galería de recuerdos" a "memoria práctica del espacio": el DNI del niño, el contrato del alquiler, la matrícula del coche, dónde aparcamos, el ticket de la garantía. La infraestructura no cambia ni una línea (Cloudinary authenticated, subida firmada por el Worker) — cambia el propósito. Los recuerdos de pareja siguen cabiendo; simplemente dejan de ser el único caso.

---

## 6. Casos de uso (la prueba del algodón)

| Quién | Qué hace con Flare | Qué feature lo sostiene |
|---|---|---|
| **Una persona sola** | Sus alarmas con "Hecho/+30", sus notas de ahora, sus fotos útiles | Solo-first, espacio personal |
| **Una pareja** | Exactamente lo de hoy, más recurrencia y "¿a quién le toca?" | Todo lo actual + rotación |
| **Un piso compartido** | Basura rotativa, alquiler el día 1, "no hay papel", el wifi en el tablón | Rotación, avisos a todos, tablón |
| **Una familia** | Recoger a los niños, medicación de los abuelos, el calendario de quién cocina | Dirigido a X, recurrencia, archivo |
| **Un viaje entre amigos** | "Salimos a las 9" a todos, la reserva en el archivo, cuentas en el tablón | Espacio temporal, avisos a todos |
| **Un mini-equipo** (2–4 autónomos) | "Factura antes del 20", entregas con dueño y color | Dirigido, hecho-visible |

La primera fila es la que cambia el destino del producto: **todas las demás filas empiezan por ella**. Nadie instala una app porque otro se lo pida dos veces; la instala porque le sirve, y luego arrastra a los suyos.

---

## 7. Por qué esto genera interés (y contra quién juega)

**El hueco real:** entre las apps de listas (Todoist, Google Keep, Apple Reminders) y los organizadores familiares (Cozi, FamilyWall) hay un vacío enorme:

- Las apps de listas son **para ti**; compartir es un añadido incómodo y nada "suena" en el móvil del otro con acciones directas.
- Los organizadores familiares son **armarios llenos**: calendario + listas + comidas + fotos + chat, con anuncios y diseño de 2015. Nadie los quiere, se los resignan.
- WhatsApp es donde van a morir las peticiones: "¿puedes…?" queda enterrado bajo 40 mensajes en una hora.

**El pitch de Flare en una frase:**

> *La app donde pedir algo hace que suene en el móvil correcto — y donde ves brillar el "hecho" sin preguntar.*

**Los ganchos concretos (ordenados por potencial de "quiero eso"):**

1. **Rotación con color** — "¿a quién le toca?" resuelto visualmente. Compartible en redes: la captura se explica sola.
2. **"Hecho" sin conversación** — el fin del "¿lo hiciste?". Es un beneficio emocional (menos fricción en la convivencia) con mecánica práctica.
3. **El tablón de capacidad fija** — anti-Slack, anti-grupo-de-WhatsApp. "Solo caben 7 cosas" es un titular, no una limitación.
4. **Privacidad verificable** — sin feed, sin anuncios, sin analítica de terceros; llaves criptográficas, espacios no enumerables. Para familias, esto es un argumento de compra, no una nota al pie.
5. **Widget de Android** (fase 3): lanzar una bengala desde la pantalla de inicio en dos taps.

---

## 8. Cambios técnicos

La noticia importante: **el stack entero sobrevive.** Firebase Auth, Firestore, Worker de Cloudflare, Cloudinary, Expo Push — la arquitectura de seguridad (Rules como única autorización, Worker leyendo con el token del usuario) funciona igual con N miembros que con 2. Lo que cambia es el **modelo de dominio**, no la tecnología.

### 8.1 Modelo de datos

```
users/{uid}
  ├── email, displayName, expoPushToken?
  ├── spaceIds: string[]          ← antes: coupleId (string | null)
  └── activeSpaceId: string       ← el espacio en pantalla

spaces/{spaceId}                   ← antes: couples/{coupleId}
  ├── memberIds: string[] (1..8)  ← el orden ES el color
  ├── kind: 'personal' | 'shared'
  ├── name: string                ← "Casa", "Viaje a Lisboa"…
  ├── inviteCode: string | null   ← reutilizable hasta llenarse o revocarse
  └── palette?

spaces/{id}/reminders/{id}
  ├── title, dueAt, status, createdByUid
  ├── targetUids: string[] | 'all'     ← NUEVO: a quién le suena
  ├── repeat?: { freq: 'daily'|'weekly'|'monthly', interval: number }
  └── rotation?: boolean               ← alterna targetUid en cada ciclo

spaces/{id}/board/{id}            ← antes: messages (misma forma + type)
  ├── type: 'text' | 'photo', text? , imageUrl?
  ├── pinned: boolean
  └── senderId, reactions

spaces/{id}/photos/{id}           ← sin cambios
```

### 8.2 Reglas de Firestore

La forma no cambia (`request.auth.uid in resource.data.memberIds`); cambian los invariantes:

- Miembros: de "1→2 y solo si no perteneces a otra" a "hasta 8, y puedes pertenecer a varios espacios".
- Invitaciones: el código deja de ser de un solo uso; se invalida al llenarse el espacio o al revocarlo un miembro. Sigue siendo `get`-only, nunca `list`.
- El espacio personal (`kind: 'personal'`) no admite invitaciones ni segundo miembro.

### 8.3 Ciclo de vida del espacio

El modelo actual "quien sale, disuelve" es correcto para una pareja y erróneo para un grupo:

- **Salir** de un espacio compartido con más gente: te vas tú, tus colores quedan huérfanos en lo ya creado (se atenúan a gris), el espacio sigue.
- **El último en salir** dispara la disolución completa (la lógica de `dissolveCouple` actual, reaprovechada tal cual: borrar invite → contenido → espacio → alarmas).
- El espacio **personal** muere solo con la cuenta.

### 8.4 Alarmas locales

`reminder-alarms.tsx` hoy programa alarmas para lo que creó la otra persona. Generaliza a: *programa alarma para todo aviso donde `targetUids` me incluya* (incluido yo mismo — el caso solo). La recurrencia se apoya en `expo-notifications` (soporta triggers repetitivos) con el siguiente `dueAt` materializado en Firestore al marcar "Hecho", para que la rotación pueda cambiar el destinatario en cada ciclo.

### 8.5 Paletas

Cada paleta pasa de `{left, right, lens}` a una rampa ordenada `lights: string[8]`, donde `lights[0]` y `lights[1]` son los actuales `left`/`right`. `usePalette()` pasa de `amFirst` a `myIndex = memberIds.indexOf(uid)`. Es el cambio de UI más delicado (6 paletas × 8 luces que convivan bien) y el más agradecido: es puro diseño, sin riesgo técnico.

### 8.6 Migración

La base instalada es pequeña y reciente (lanzamiento en Play hace poco): migración dura, sin doble lectura:

1. Script (Cloud Function admin, una vez): cada `couples/{id}` → `spaces/{id}` con `kind: 'shared'`, `name: 'Casa'`; cada `users/{uid}.coupleId` → `spaceIds: [id]`, `activeSpaceId: id`.
2. Crear el espacio personal de cada usuario existente en su primer login con la versión nueva (lazy, en el cliente).
3. Rules nuevas + versión mínima forzada de la app. Sin periodo de convivencia de esquemas.

### 8.7 Estimación de fases

| Fase | Contenido | Resultado |
|---|---|---|
| **1 — El pivote** | Solo-first + espacio personal, `spaces` con 1..8 miembros, avisos dirigidos (`targetUids`), selector de espacios, paletas de 8 luces, migración | Flare ya no necesita a nadie más. Todo lo demás son mejoras. |
| **2 — La vida diaria** | Recurrencia, rotación, "hecho" visible, pásalo | Las features que generan retención e interés orgánico. |
| **3 — Los ganchos** | Tablón (evolución del chat), archivo reencuadrado, espacios temporales/archivables, widget Android | Diferenciación completa y material de marketing. |

Fase 1 es la única con riesgo estructural (modelo + rules + migración). Las fases 2 y 3 son incrementales sobre ella.

---

## 9. Riesgos y cómo se mitigan

| Riesgo | Realidad | Mitigación |
|---|---|---|
| **Perder la identidad íntima** | Cierta. "Para dos" era un posicionamiento nítido. | El nuevo posicionamiento también lo es: *círculos pequeños, cosas que suenan, cero ruido*. El límite de 8 y el anti-feed son la nueva intimidad: esto sigue sin ser una red social. |
| **Convertirse en "otra app de tareas"** | El peligro real del pivote. | La brújula: si una feature no hace que algo *suene en el móvil correcto* o no reduce ruido, no entra. Nada de proyectos, etiquetas, prioridades, subtareas. |
| **Complejidad de UI con N personas** | El diseño actual respira porque hay 2 colores. | El tope de 8, paletas diseñadas (no colores libres), y el tablón de capacidad fija mantienen la legibilidad. Probar con 4–5 antes de permitir 8. |
| **La migración rompe parejas existentes** | Base pequeña, pero son los usuarios más fieles. | Sus espacios migran con sus dos colores intactos (las rampas empiezan por los pares actuales). Para ellos, el único cambio visible es que ganan un espacio personal. |
| **Recurrencia + rotación mal hechas** | Es donde apps grandes se han ahogado. | Recortar sin piedad: diaria/semanal/mensual, rotación = alternancia simple por orden de llegada. Sin reglas raras ("el tercer martes salvo festivos"). |

---

## 10. Modelo de negocio (esbozo)

El pivote abre por primera vez un modelo freemium honesto:

- **Gratis:** espacio personal + 1 espacio compartido, avisos ilimitados, recurrencia básica.
- **Flare+** (suscripción baja, 1–2 €/mes): espacios ilimitados, rotación, archivo ampliado, espacios temporales archivables.

La línea de corte es sana: nadie paga por lo esencial; se paga por *vivir en varios círculos*, que es exactamente el comportamiento del usuario que más valor recibe. Sin anuncios jamás — la privacidad es parte del producto, no un plan de precios.

---

## 11. Decisiones que hay que tomar (en orden)

1. **¿Tagline?** Propuestas: *"Flare — suena donde tiene que sonar"* / *"El espacio de los tuyos"* / *"Pide, suena, hecho"*.
2. **¿Tope de miembros?** Propuesto: 8. Alternativa conservadora: 5 (una familia), ampliable después. Bajar es imposible; subir es gratis.
3. **¿Capacidad del tablón?** Propuesto: 7 huecos + 2 fijadas. Hoy son 5 mensajes.
4. **¿El chat actual muere en fase 1 o en fase 3?** Propuesto: se queda tal cual hasta la fase 3; el pivote de modelo no debe cargar también con un pivote de UI.
5. **¿Se renombra el paquete Android?** El `slug` y el applicationId dicen "churriapp". Cambiar el applicationId en Play significa app nueva (perder instalaciones). Propuesto: mantener el id interno, todo lo visible ya dice Flare.

---

## 12. En una página

- **Qué era:** un espacio privado para dos personas, con avisos, fotos y un chat mínimo.
- **Qué pasa a ser:** la app donde un círculo pequeño (empezando por ti solo) se organiza con avisos que suenan en el móvil correcto, un tablón sin ruido y un archivo privado.
- **Qué lo hace distinto:** el aviso dirigido con "Hecho" visible, el color que dice *quién*, la rotación que dice *a quién le toca*, y la ausencia deliberada de feed, historial y ruido.
- **Qué se tira:** solo la palabra "pareja" y la pared del onboarding. Ni una línea de la arquitectura de seguridad, ni el sistema de diseño, ni el stack.
- **Cuál es el primer paso:** Fase 1 — solo-first, espacios de 1..8, avisos con destinatario. Con eso, Flare deja de necesitar que exista otra persona para existir él.

> Flare 1.0 era un espacio para dos. Flare 2.0 es un espacio para los tuyos — aunque, de momento, seas solo tú.
