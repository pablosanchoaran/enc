# 4. Alfabetización no negociable

> **La pregunta**
> ¿Qué tiene que entender de tecnología alguien que dirige, y dónde está exactamente la
> frontera con lo que no necesita saber?
>
> **La idea**
> La frontera no la marca la curiosidad: la marcan las decisiones. Hay que entender aquello
> cuyo desconocimiento hace que firmes mal, y solo eso.

> **Estado:** esqueleto. Es el capítulo con más riesgo de envejecer mal; escribirlo sobre
> conceptos, nunca sobre productos.

---

## El problema

Dos fracasos simétricos y ambos habituales. El directivo que **abdica** («de eso que decida
el CTO») y acaba firmando compromisos cuyo coste no sabe leer. Y el directivo que
**microgestiona** («yo he programado, esto se hace así») y destruye la autonomía del equipo
sin aportar criterio actualizado. Entre los dos hay un espacio estrecho y es el objeto del
capítulo.

## El marco: cinco dominios, cinco decisiones

Cada dominio se justifica por **la decisión directiva concreta que depende de entenderlo**.
Nada se explica por interés general.

| Dominio | Lo mínimo que hay que entender | La decisión que depende de ello |
|---|---|---|
| **Datos** | Qué es un modelo de datos, por qué la calidad no se arregla después, qué significa que dos sistemas «no hablan» | Cualquier proyecto de cliente único, informes fiables, o venta de una unidad de negocio |
| **Nube y coste marginal** | Qué se paga realmente, por qué el coste crece con el uso y no con la compra, qué es la dependencia de proveedor | Firmar contratos plurianuales; decidir precios de un servicio digital |
| **Software como activo vivo** | Que el software se degrada si no se toca, qué es la deuda técnica y por qué tiene intereses | Presupuesto (capítulo 1), plazos, y la pregunta de por qué «esto antes se hacía en dos semanas» |
| **IA y lo probabilístico** | La diferencia entre un sistema que siempre da la misma respuesta y uno que da la más probable; qué es un error tolerable | Qué automatizar, qué revisar y quién responde (capítulo 15) |
| **Seguridad y riesgo** | Que la seguridad es un intercambio, no un estado; qué es una superficie de exposición | Aceptar o no un riesgo con nombre, importe y firma |

Sección de cierre del marco: **lo que NO hace falta entender**, con ejemplos explícitos. Es
la parte que da credibilidad al capítulo ante lectores técnicos y alivio a los que no lo son.

## La herramienta

**Las ocho preguntas** → `plantillas/04-ocho-preguntas.md`

Ocho preguntas que cualquier directivo puede hacer sin saber tecnología y cuyas respuestas
—o la incomodidad que generen— revelan el estado real de un sistema, un proyecto o un
proveedor. Ejemplos del conjunto: *¿qué pasa si esto se cae un martes a las diez?* · *¿cuánto
tardaríamos en cambiar de proveedor?* · *¿quién es el único que sabe cómo funciona esto?* ·
*¿qué haríamos distinto si tuviéramos que empezar hoy?*

Se acompaña de un **autodiagnóstico de 20 ítems** para situar al lector antes de leer el
resto del libro y volver a medirse al terminarlo.

## El caso

`[Caso compuesto]` Compra de una plataforma decidida por demostración. Reconstrucción de las
tres preguntas que nadie hizo y del coste de no haberlas hecho, con el calendario real de
cómo se fue manifestando.

## Cómo se hace mal

- **Comprar por demostración.** *Síntoma:* la decisión se toma después de ver el producto
  funcionando con datos del proveedor.
- **El directivo traductor.** *Síntoma:* toda comunicación entre negocio y técnica pasa por
  una persona, que se convierte en cuello de botella y en punto único de fallo.
- **Formación como coartada.** *Síntoma:* un curso de dos días sobre IA sustituye a decidir
  qué se va a hacer con ella.
- **Preguntar solo cuando algo falla.** *Síntoma:* el vocabulario técnico del comité es
  exclusivamente vocabulario de incidencias.

## Checklist del directivo
*(pendiente)*

### [+ Máster]
Literatura sobre *absorptive capacity* (Cohen y Levinthal): la capacidad de una organización
para asimilar conocimiento externo depende de su conocimiento previo, lo que implica que la
alfabetización directiva tiene retornos crecientes. Discusión sobre composición de consejos
de administración y competencia digital: evidencia mixta, revisar con cuidado antes de citar.

### [+ Dirección]
Haz el autodiagnóstico y comparte el resultado con tu equipo técnico. La conversación que
genera reconocer los tres huecos concretos vale más que cerrarlos. Después, adopta una regla:
en la próxima compra tecnológica de más de X euros, las ocho preguntas se responden por
escrito antes de la demostración, no después.

## Ejercicio
**E4:** aplicar las ocho preguntas a un sistema real de la empresa del proyecto (o a un
producto que el equipo use a diario) y redactar el informe de una página que se llevaría al
comité.

## Para seguir
Cohen y Levinthal, *Absorptive Capacity* · Fowler, sobre deuda técnica (breve y clarificador)
· Un informe anual de una empresa tecnológica cotizada, leyendo solo la sección de riesgos:
es el mejor curso gratuito de alfabetización tecnológica que existe.
