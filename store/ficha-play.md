# Ficha de Google Play — Churri

Todo listo para copiar y pegar en Play Console. Los límites de caracteres van marcados.

## Nombre (máx. 30)

```
Churri
```

La marca sola, sin coletilla. Lo que hace la app lo cuentan la descripción
corta y las capturas; el nombre no tiene que explicarse.

## Descripción corta (máx. 80)

```
Avisos, fotos y cinco mensajes. Un espacio privado para dos personas.
```

## Descripción completa (máx. 4000)

```
Churri es un espacio compartido entre dos personas. No hay feed, no hay
audiencia, no hay nadie más: entras con una llave que solo tiene la otra
persona, y todo lo que hay dentro es de los dos.

AVISOS QUE LLEGAN A SU HORA
Deja un aviso y a la otra persona le suena el móvil en el momento. A la hora
señalada, su teléfono se lo recuerda con una alarma exacta — y puede marcarlo
como hecho o posponerlo media hora directamente desde la notificación, sin
abrir la app. Si el aviso lo merece, se pasa al calendario con un toque.

FOTOS SOLO PARA VOSOTROS
Las fotos se guardan cifradas en tránsito y se sirven en privado: no hay
enlaces públicos. Cada foto lleva el color de quien la trajo.

CINCO MENSAJES
El espacio guarda solo los cinco últimos mensajes. Cuando llega uno nuevo, el
más antiguo se apaga — para los dos a la vez. Lo que os decís tiene que valer
el sitio que ocupa.

EL COLOR DICE QUIÉN
Cada persona lleva una luz. Todo lo que haces en el espacio lleva tu color, y
donde vuestras dos luces se cruzan aparece un tercero que no es de ninguno.
Elegís la pareja de colores del espacio entre seis combinaciones.

PRIVADO POR DISEÑO
Solo se entra con llave. Un espacio no se puede buscar ni listar. Sin
publicidad, sin analítica de uso, sin vender datos. Y si os vais, todo se
borra de verdad: también los archivos.

Churri es para dos: una pareja, dos hermanas, dos amigos a distancia. El
número lo pone la app; el vínculo lo ponéis vosotros.
```

## Datos de la ficha

| Campo | Valor |
|---|---|
| Categoría | Estilo de vida |
| Correo de contacto | info@wearecapa.es |
| Política de privacidad | https://churri.pages.dev |
| Borrado de cuenta | https://churri.pages.dev/eliminar-cuenta.html |
| Icono 512 | `store/icon-512.png` |
| Gráfico de portada | `store/feature-1024x500.png` |

## Cuestionario de clasificación (IARC) — respuestas

- Violencia, miedo, sexo, drogas, apuestas: **No** a todo.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí**
  (mensajes y fotos entre dos usuarios que se emparejan con un código).
- ¿Comparte la ubicación del usuario con otros? **No**
- ¿Permite compras digitales? **No**
- Resultado esperado (clasificación de contenido, IARC): **PEGI 3** con aviso
  de "interacción entre usuarios" — el contenido en sí no tiene violencia,
  sexo, ni nada restringido, así que la clasificación de contenido se queda
  en PEGI 3.
- **Importante — no confundir con la edad mínima real:** los Términos de uso
  y la Política de Privacidad de la app exigen tener **16 años o más**. Eso
  se declara aparte, en la sección "Público objetivo y contenido" de Play
  Console: marca los rangos de edad **16-17** y **18+** (no "menores de 13"
  ni "13-15"), y responde que la app **no** está dirigida a ni resulta
  atractiva para niños. La clasificación PEGI 3 de arriba no significa "para
  todos" en este caso — solo describe el contenido, no quién puede
  registrarse.

## Seguridad de los datos — resumen (detalle ya preparado en conversación)

- Recoge: correo, nombre, fotos, mensajes/recordatorios, ID de dispositivo
  (token push). No comparte con terceros. Cifrado en tránsito: Sí.
  Solicitud de borrado: Sí (URL de arriba).

## Alarmas exactas (SCHEDULE_EXACT_ALARM) — declaración

> La función principal de la app son recordatorios que la otra persona debe
> recibir a la hora exacta que se ha fijado. Una alarma inexacta puede
> retrasarse minutos u horas y haría inútil la función.

## El camino (en orden)

1. **Cuenta de desarrollador** (25 $, verificación de identidad) — solo tú.
2. **Pruebas internas**: subir el AAB, añadir vuestros correos → enlace privado,
   actualizaciones automáticas. Mismo día.
3. **Prueba cerrada**: ~20 testers optados durante 14 días seguidos (requisito
   de Google para cuentas personales nuevas). Reclutar amigos/familia; con el
   enlace de opt-in les cuesta un minuto. El reloj corre solo.
4. **Solicitar producción** desde la consola cuando se cumpla el plazo.
5. **Revisión de Google** (días) → **Churri aparece en el buscador de Play**.
