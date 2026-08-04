# Guía de estilo

Este documento existe para que el capítulo 12 se parezca al capítulo 1 aunque se escriban
con dos años de diferencia. Es de obligada lectura antes de redactar o revisar cualquier
sección.

---

## 1. La voz

**Quién habla:** alguien que ha dirigido tecnología dentro de una organización y que
también ha entrado desde fuera, como consultor, a diagnosticar por qué la transformación
no avanzaba. Esa doble posición es el activo del libro: se ve el problema desde el
presupuesto y desde el terreno.

**Cómo habla:**

- **Primera persona con moderación.** El «yo» aparece cuando aporta evidencia («la primera
  vez que defendí un plan de plataforma ante un comité, perdí»), no como adorno.
- **Afirmativo.** Se moja. Un libro práctico que no toma posición es un catálogo.
- **Sin épica.** Nada de *disrupción*, *viaje transformacional*, *nueva normalidad*,
  *sinergias*. Si una frase podría aparecer en un folleto corporativo, se reescribe.
- **Respetuoso con el lector técnico y con el que no lo es.** Todo término técnico se
  define la primera vez, en una línea, sin condescendencia.
- **Concreto por defecto.** Antes que «hay que alinear tecnología y negocio», escribir «hay
  que decidir quién firma cuando el CTO y el director comercial no se ponen de acuerdo en
  la fecha».

**Prueba de la frase:** si al leer un párrafo en voz alta suena a alguien explicando algo a
un colega mientras se toma un café, sirve. Si suena a ponencia, se corta.

## 2. Anatomía del capítulo

Todos los capítulos siguen exactamente esta estructura. No es negociable: es lo que
permite que el libro se convierta en asignatura sin reescribirlo.

```
# N. Título

> **La pregunta**          ← una sola pregunta directiva, la que abre el capítulo
> **La idea**              ← la tesis del capítulo en una frase

## El problema             (~600 palabras) Escena concreta. Por qué esto duele.
## El marco                (~1.200 palabras) Teoría mínima viable. Ni una idea de más.
## La herramienta          (~800 palabras) El artefacto. Cómo se usa, paso a paso.
## El caso                 (~800 palabras) Aplicación completa de la herramienta.
## Cómo se hace mal        (~400 palabras) 3-5 antipatrones con su síntoma observable.
## Checklist del directivo  10-12 líneas verificables. Es la página que se fotocopia.

### [+ Máster]             Evidencia, matices, límites del marco, literatura.
### [+ Dirección]          Aplicación a la propia organización del lector. Preguntas incómodas.

## Ejercicio               El entregable que la asignatura evalúa.
## Para seguir             3-5 lecturas, con una línea de por qué cada una.
```

**Extensión objetivo:** 4.000–5.000 palabras de cuerpo, más las capas. Un capítulo se lee
en una sesión de tren.

## 3. Las tres capas

El mismo texto sirve a tres públicos porque la profundidad está **marcada, no mezclada**.

| Capa | Público | Qué contiene | Cómo se marca |
|---|---|---|---|
| **Base** | Grado (ADE, Empresariales, IGE) | Todo el cuerpo del capítulo. Autocontenido. Ningún prerrequisito más allá de un curso de introducción a la empresa. | Sin marca |
| **`[+ Máster]`** | Máster, MBA | Evidencia empírica, condiciones de validez del marco, contraejemplos, tensión con la literatura. Aquí es donde el marco se cuestiona. | Sección propia al final |
| **`[+ Dirección]`** | Ejecutivos, in-company | Traslado a la organización real del lector: qué mirar, a quién preguntar, qué conversación evitar tener sin datos. | Sección propia al final |

Regla: **nunca meter una capa dentro del cuerpo**. Si un matiz de máster se cuela en «El
marco», el estudiante de grado se pierde y el capítulo deja de servir para dos asignaturas.

## 4. Reglas de rigor

Esto es lo que separa un libro que aguanta diez años de uno que envejece en dieciocho meses.

1. **Cifras con fuente o sin cifra.** No se escribe «el 70 % de las transformaciones
   fracasan» sin referencia verificable. Si no hay fuente sólida, se dice cualitativamente.
2. **Casos: tres categorías, siempre etiquetadas.**
   - `[Caso público]` — hechos verificables de una empresa real, con fuente. Nunca cifras
     internas inventadas.
   - `[Caso compuesto]` — construido a partir de patrones observados en varias
     organizaciones. Se declara explícitamente como tal.
   - `[Caso anonimizado]` — organización real con permiso, datos alterados en escala pero
     no en proporción. Se declara.

   **Nunca** presentar un caso compuesto como si fuera real. Es la línea roja del libro.
3. **Tecnología concreta con fecha de caducidad marcada.** Cuando se cite una herramienta,
   un modelo o un proveedor, va en un recuadro `Al cierre de esta edición:`. El argumento
   nunca depende del producto.
4. **Un marco por capítulo.** Si un capítulo necesita tres marcos, son tres capítulos o es
   un marco mal elegido.
5. **Atribución honesta.** Cuando una idea es de Rumelt, Christensen, Porter, Conway o de
   quien sea, se dice. El valor del libro está en la síntesis y la aplicación, no en
   fingir originalidad.

## 5. Convenciones de formato

- Ficheros de manuscrito: `NN-slug-corto.md`, numeración con cero a la izquierda.
- Un `#` por fichero (el título del capítulo). Jerarquía: `##` secciones, `###` subsecciones.
- Citas en bloque (`>`) reservadas para **La pregunta / La idea** y para citas literales.
- Tablas para comparaciones; listas para secuencias; nunca al revés.
- Las plantillas viven en `plantillas/` y el capítulo **enlaza** a la plantilla, no la
  duplica. Una sola fuente de verdad por artefacto.
- Idioma: español de España. Términos técnicos consolidados en inglés se dejan en inglés y
  en cursiva la primera vez (*trade-off*, *stack*, *pipeline*), con glosa entre paréntesis.

## 6. Lista de comprobación antes de dar un capítulo por cerrado

- [ ] ¿La idea cabe en una frase y esa frase está escrita literalmente arriba?
- [ ] ¿El capítulo entrega **un** artefacto y está en `plantillas/`?
- [ ] ¿El caso aplica esa herramienta concreta, de principio a fin, con sus números?
- [ ] ¿Los antipatrones tienen **síntoma observable**, no solo nombre?
- [ ] ¿El checklist es verificable? (cada línea se puede responder sí/no)
- [ ] ¿Las dos capas están fuera del cuerpo y aportan algo real?
- [ ] ¿El ejercicio es evaluable con la rúbrica de `docencia/evaluacion-y-rubricas.md`?
- [ ] ¿Sobrevive a la prueba de la frase leída en voz alta?
- [ ] ¿Toda cifra tiene fuente y todo caso tiene etiqueta?
