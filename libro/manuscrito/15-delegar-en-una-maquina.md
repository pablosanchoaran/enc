# 15. Delegar en una máquina

> **La pregunta**
> ¿Qué decisiones se le pueden ceder a un sistema automático y cuáles no?
>
> **La idea**
> La pregunta no es si la máquina puede hacerlo. Es si el error es tolerable, detectable y
> reversible, y quién responde cuando ocurra. Si no sabes responder a las cuatro cosas, la
> decisión no es delegable todavía.

> **Estado:** esqueleto. Es el capítulo con mayor riesgo de caducidad: escribir sobre
> estructura de la decisión, nunca sobre capacidades concretas de productos concretos.

---

## El problema

Escena a construir: comité que aprueba un proyecto de IA porque el equipo ha visto una
demostración impresionante. Nadie pregunta qué decisión concreta va a tomar el sistema, con
qué frecuencia se equivocará, quién lo notará cuando lo haga y quién firma el resultado. Seis
meses después funciona técnicamente y nadie lo usa, porque la persona que tendría que
aceptar sus recomendaciones es la que responde si salen mal, y no le compensa.

## El marco

1. **Delegar no es automatizar.** Automatizar es quitar trabajo; delegar es ceder criterio.
   Son decisiones de naturaleza distinta y solo la segunda plantea el problema de la
   responsabilidad. Confundirlas es el origen de la mayor parte del ruido sobre este tema.
2. **Determinista frente a probabilístico.** La diferencia práctica que un directivo necesita
   entender: un sistema tradicional falla de formas repetibles y auditables; un sistema
   probabilístico acierta la mayoría de las veces y falla de formas nuevas. Eso no lo hace
   peor; lo hace **gestionable de otra manera**, y esa otra manera exige medir tasas en lugar
   de comprobar casos.
3. **Los cuatro ejes de delegabilidad.** El marco central del capítulo:
   - *Tolerancia del error:* ¿qué pasa exactamente cuando se equivoca una de cada veinte veces?
   - *Detectabilidad:* ¿alguien se dará cuenta, y en cuánto tiempo?
   - *Reversibilidad:* ¿se puede deshacer, y a qué coste? (conecta con el capítulo 2)
   - *Atribución:* ¿quién responde ante el cliente, el regulador y el consejo?
   Una decisión es delegable cuando las cuatro respuestas son aceptables **a la vez**. Es una
   conjunción, no una media ponderada, y ahí es donde falla la mayoría de los casos de uso.
4. **Los tres modos.** Asistencia (propone, decide una persona), automatización supervisada
   (decide, una persona puede revertir), automatización plena (decide y ejecuta). Criterios
   para elegir modo y —lo importante— para **subir de modo con evidencia acumulada**, que es
   como se hace bien: se empieza asistiendo y se asciende con datos de tasa de error real.
5. **El humano decorativo.** Patología específica y muy extendida: se coloca a una persona a
   validar cientos de decisiones por hora, sin tiempo, sin contexto y sin incentivo para
   discrepar. Formalmente hay supervisión humana; funcionalmente hay automatización plena con
   un responsable designado para cuando falle. Es la peor combinación posible: ni la
   eficiencia de automatizar ni la protección de supervisar.
6. **Dónde queda la ventaja.** Si la capacidad se compra por suscripción, no diferencia
   (capítulo 6). Lo que diferencia es el dato propio, la integración en el flujo de trabajo
   real y la velocidad con la que la organización aprende de los errores del sistema.
7. **Marco regulatorio.** Tratamiento por principios: enfoque basado en riesgo, obligaciones
   crecientes según el impacto sobre las personas, y trazabilidad de la decisión. Se escribe
   en un recuadro fechado y se revisa en cada edición.

## La herramienta

**Ficha de delegación** → `plantillas/15-ficha-de-delegacion.md`

Una ficha por decisión candidata: qué decisión concreta se cede · modo elegido · tasa de
error aceptable, con número · cómo se detecta un error y en cuánto tiempo · cómo se revierte
· **quién responde** · qué evidencia haría subir o bajar de modo · fecha de revisión.

Regla de uso: no se aprueba ningún proyecto de IA sin una ficha por cada decisión afectada.
La mayoría de las iniciativas se caen al intentar rellenar el campo «qué decisión concreta se
cede», y eso es un ahorro, no un fracaso.

## El caso

`[Caso compuesto]` Dos despliegues del mismo tipo de sistema en la misma empresa: uno en
atención al cliente, otro en concesión de crédito. Idéntica tecnología, decisiones opuestas
sobre el modo, por razones que la ficha explicita en cinco minutos.

## Cómo se hace mal

- **Piloto sin decisión asociada.** *Síntoma:* nadie sabe decir qué cambiará si funciona.
- **El humano decorativo.** *Síntoma:* el revisor aprueba más de un caso por minuto.
- **Comprar capacidad y llamarlo estrategia.** *Síntoma:* la ventaja alegada es un producto
  que el competidor puede contratar mañana.
- **Delegar sin dueño.** *Síntoma:* ante un error, la respuesta es «lo decidió el sistema».
- **Medir la precisión y no el impacto.** *Síntoma:* se conoce el porcentaje de acierto y no
  el coste de los fallos, que casi nunca se distribuyen de forma uniforme.
- **Ignorar el efecto sobre quien usa el sistema.** *Síntoma:* nadie preguntó a quien tiene
  que fiarse de él, que es quien decide de verdad si se adopta (capítulo 12).

## Checklist del directivo
*(pendiente)*

### [+ Máster]
Automatización y sus paradojas: el trabajo clásico de Bainbridge (*Ironies of Automation*,
1983) sobre por qué automatizar lo fácil deja al humano solo con lo difícil y sin práctica —
es el texto que mejor anticipa el problema del humano decorativo, cuarenta años antes.
Literatura sobre confianza en sistemas automáticos: infraconfianza y exceso de confianza.
Responsabilidad algorítmica y trazabilidad. Discusión: ¿la exigencia de explicabilidad es un
requisito técnico, jurídico o de gobierno? La respuesta cambia por completo la decisión de
compra.

### [+ Dirección]
Coge tu iniciativa de IA más avanzada y rellena la ficha. Si no puedes nombrar la decisión
concreta que se cede, no tienes un proyecto: tienes una capacidad buscando un problema.
Segunda pregunta, para el comité: si mañana este sistema toma una decisión que perjudica a un
cliente y sale en prensa, ¿quién da la cara y con qué explicación? Si nadie sabe responder,
esa es la tarea de esta semana y no el despliegue.

## Ejercicio
**E15:** identificar tres decisiones delegables en la empresa del proyecto, rellenar la ficha
de cada una y argumentar el modo elegido. Una de las tres debe ser una decisión que el equipo
concluya que **no** debe delegarse, con el razonamiento explícito.

## Para seguir
Bainbridge, *Ironies of Automation* (1983; siete páginas, y sigue siendo lo mejor escrito
sobre esto) · Agrawal, Gans y Goldfarb, *Prediction Machines* (la economía de abaratar la
predicción; el mejor encuadre económico disponible) · Documentación regulatoria vigente en tu
jurisdicción, leída por alguien de negocio y no solo por el área legal.
