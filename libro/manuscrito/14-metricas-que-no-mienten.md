# 14. Métricas que no mienten

> **La pregunta**
> ¿Por qué los paneles de mando están llenos de indicadores en verde en empresas que van mal?
>
> **La idea**
> Porque toda métrica que se convierte en objetivo deja de medir lo que medía. Un sistema de
> medición honesto se diseña contando con eso desde el principio, no lamentándolo después.

> **Estado:** esqueleto.

---

## El problema

Escena a construir: panel de dirección con sesenta indicadores, cincuenta y cuatro en verde,
y una empresa que pierde cuota trimestre a trimestre. Ninguno de los indicadores miente por
separado. El sistema, en conjunto, sí: mide actividad de las áreas y no resultado de la
empresa, porque cada área eligió los indicadores que sabía que iba a cumplir.

## El marco

1. **La ley de Goodhart.** Cuando una medida se convierte en objetivo, deja de ser una buena
   medida. No es una curiosidad académica: es la restricción de diseño principal de cualquier
   sistema de medición. Corolario práctico: no se puede diseñar un buen indicador sin
   preguntarse cómo lo va a manipular una persona razonable que quiere cumplirlo.
2. **Tres familias, tres usos.** Resultado (¿estamos consiguiendo lo que queremos?),
   actividad (¿estamos haciendo lo previsto?) y salud (¿nos estamos rompiendo por el camino?).
   La mayoría de los paneles son todo actividad, que es la familia más fácil de medir y la
   menos informativa.
3. **Pares tensionados.** El mecanismo central del capítulo: ningún indicador viaja solo.
   Velocidad con calidad, crecimiento con margen, satisfacción con coste de servicio. Un
   indicador solo se puede optimizar destructivamente; un par tensionado, no. Regla:
   **si un indicador no tiene pareja, no entra en el panel**.
4. **Adelantados y retrasados.** Por qué los indicadores que un directivo puede accionar son
   casi siempre los peores para evaluar el resultado, y por qué se necesitan los dos tipos con
   funciones distintas.
5. **Métrica y decisión.** Regla de admisión al panel: todo indicador debe tener asociada una
   decisión concreta que se tomaría si cambiara. Si no la hay, es información, no indicador,
   y su sitio es un informe, no el panel. Esta sola regla suele eliminar el 70 % de un cuadro
   de mando.
6. **Lo que nunca se debe medir.** Producción individual en trabajo creativo, líneas de
   código, horas, número de tickets. No porque sean groseros, sino porque son fáciles de
   cumplir sin producir valor, y el equipo lo descubre antes que la dirección.

## La herramienta

**Cuadro de mando directivo en una página** → `plantillas/14-cuadro-de-mando.md`

Máximo ocho indicadores, organizados en cuatro pares tensionados. Para cada uno: definición
exacta · fuente · dueño · **decisión asociada** · cómo se manipularía si alguien quisiera
hacerlo. Esta última columna es la aportación del libro y la que hace que el ejercicio sea
serio: obliga a anticipar el juego antes de que empiece.

## El caso

`[Caso compuesto]` Reducción de un panel de sesenta indicadores a ocho. Qué desapareció, qué
se descubrió al no poder esconderse detrás del volumen y qué conflicto interno provocó —porque
lo provoca siempre: quitar el indicador de alguien es quitarle su defensa—.

## Cómo se hace mal

- **El panel-catálogo.** *Síntoma:* nadie sabe decir qué haría si el indicador 34 se pusiera
  en rojo.
- **Indicadores solitarios.** *Síntoma:* se mide velocidad de entrega sin medir defectos.
- **Medir personas en trabajo creativo.** *Síntoma:* comparativas individuales de producción.
- **Cambiar la definición sin avisar.** *Síntoma:* la serie histórica tiene un salto que
  nadie explica y que casualmente coincide con un cambio de responsable.
- **El indicador que solo mejora.** *Síntoma:* lleva tres años subiendo; casi siempre está
  midiendo el esfuerzo de medirlo.
- **Confundir satisfacción con valor.** *Síntoma:* el NPS es el único indicador de cliente.

## Checklist del directivo
*(pendiente)*

### [+ Máster]
Goodhart, Campbell y la literatura sobre el efecto de las métricas de gestión en el sector
público (Bevan y Hood: *gaming* en el sistema sanitario británico, uno de los cuerpos de
evidencia más ilustrativos que existen). Crítica al cuadro de mando integral (Kaplan y
Norton): utilidad frente a proliferación. Discusión sobre métricas DORA como indicadores
organizativos y el riesgo de convertirlas en objetivo, que es exactamente el error que el
propio marco advierte.

### [+ Dirección]
Coge tu panel actual y tacha todo indicador para el que no puedas nombrar, en menos de diez
segundos, la decisión que tomarías si se moviera. Lo que quede es tu cuadro de mando real.
Después, para cada superviviente, escribe cómo lo manipularías tú si tu variable dependiera
de él. Si alguna respuesta es fácil, ya está pasando.

## Ejercicio
**E14:** diseñar el cuadro de mando directivo de la empresa del proyecto: ocho indicadores en
pares tensionados, con decisión asociada y análisis de manipulabilidad de cada uno.

## Para seguir
Bevan y Hood, *What's Measured Is What Matters* · Kaplan y Norton, *The Balanced Scorecard*
(el original, no las versiones posteriores) · Muller, *The Tyranny of Metrics* · Doerr,
*Measure What Matters*, releído junto con Muller: el contraste es más instructivo que
cualquiera de los dos por separado.
