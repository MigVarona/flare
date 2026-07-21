# Ficha de Google Play — Flare

Todo listo para copiar y pegar en Play Console. Los límites de caracteres van marcados.

## Nombre (máx. 30)

```
Flare
```

La marca sola, sin coletilla. Lo que hace la app lo cuentan la descripción
corta y las capturas; el nombre no tiene que explicarse.

## Descripción corta (máx. 80)

```
Avisos que suenan en el móvil correcto. Espacios de 1 a 8, sin ruido.
```

## Descripción completa (máx. 4000)

```
Flare es el espacio de los tuyos: solo, en pareja, con tu familia o con quien
compartas piso. Cada cuenta empieza con un espacio personal que ya funciona
desde el primer minuto — invitar a alguien es un paso más, no un requisito.
Los espacios compartidos admiten hasta 8 personas, con una llave que caduca
en una semana y nunca es de un solo uso.

AVISOS QUE SUENAN EN EL MÓVIL CORRECTO
Deja un aviso para ti, para alguien concreto o para todo el espacio, y suena
en el teléfono que corresponde a la hora exacta — con "Hecho" y "+30 min"
directamente desde la notificación, sin abrir la app. Puede repetirse cada
día, semana o mes, y rotar entre las personas del espacio: la basura le toca
esta semana a uno, la siguiente a otro, y el color dice de quién es el turno.
Cuando alguien lo completa, los demás lo ven sin tener que preguntar.

EL TABLÓN
No es un chat que se pierde entre miles de mensajes: es la puerta de la
nevera. Deja lo que importa ahora — el wifi, la llave en el buzón — y fija
hasta dos notas para que no se entierren entre las demás.

EL ARCHIVO
Fotos privadas, cifradas en tránsito y sin enlaces públicos. Cada una lleva
el color de quien la subió, y las que fijes se encuentran aunque sean de
hace meses: el DNI, el contrato, la matrícula del coche.

EL COLOR DICE QUIÉN
Cada persona lleva una luz fija desde el momento en que entra al espacio.
Todo lo que crea la lleva puesta. Elegís la paleta del espacio entre seis
combinaciones diseñadas para convivir, tenga el espacio 2 personas o 8.

PRIVADO POR DISEÑO
Solo se entra con llave, y esa llave caduca. Un espacio no se puede buscar
ni listar. Sin publicidad, sin analítica de uso, sin vender datos. Si sales
de un espacio con más gente dentro, sigue existiendo para ellos; si eras el
último, se borra de verdad — también los archivos.

Flare es para los tuyos, sean cuantos sean. El número lo pones tú.
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
  (mensajes y fotos entre las personas de un mismo espacio, de hasta 8, que
  se unen con una llave de acceso).
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

> La función principal de la app son recordatorios que la persona destinataria
> debe recibir a la hora exacta que se ha fijado. Una alarma inexacta puede
> retrasarse minutos u horas y haría inútil la función.

## El camino (en orden)

1. **Cuenta de desarrollador** (25 $, verificación de identidad) — solo tú.
2. **Pruebas internas**: subir el AAB, añadir vuestros correos → enlace privado,
   actualizaciones automáticas. Mismo día.
3. **Prueba cerrada**: ~20 testers optados durante 14 días seguidos (requisito
   de Google para cuentas personales nuevas). Reclutar amigos/familia; con el
   enlace de opt-in les cuesta un minuto. El reloj corre solo.
4. **Solicitar producción** desde la consola cuando se cumpla el plazo.
5. **Revisión de Google** (días) → **Flare aparece en el buscador de Play**.
