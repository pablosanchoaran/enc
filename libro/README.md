# Dirigir con criterio

**Liderazgo y estrategia en la empresa intensiva en tecnología**

Proyecto de libro + asignatura. Este repositorio contiene el manuscrito, el material
docente derivado y las herramientas prácticas que sostienen ambos.

---

## 1. La tesis

Durante un siglo, dirigir consistió en **asignar recursos escasos con información escasa**.
La tecnología ha invertido las dos escaseces: la información es hoy abundante y barata, y
la capacidad de ejecutar es, en buena medida, programable. Lo que se ha vuelto escaso es
otra cosa:

> **El criterio: saber qué problema merece resolverse, qué apuesta merece capital, y qué
> decisión no se puede delegar —ni a un subordinado, ni a un proveedor, ni a un modelo.**

Este libro no va de tecnología. Va de **dirigir cuando la tecnología ha dejado de ser una
función de soporte y se ha convertido en el sustrato sobre el que se toma cada decisión**:
el precio, el producto, el canal, la estructura del equipo, el riesgo y la propia
capacidad de cambiar de opinión.

## 2. Qué lo diferencia

La estantería de management está saturada. Este libro se sostiene sobre tres decisiones
deliberadas:

| Decisión | Qué significa en la práctica |
|---|---|
| **Escrito desde dentro, no desde la tribuna** | La voz es la de quien ha tenido que defender un presupuesto de tecnología ante un comité que no entendía la deuda técnica, y la de quien ha entrado en decenas de organizaciones a diagnosticar por qué la transformación no avanzaba. Doble perspectiva: dirección de tecnología + consultoría de transformación. |
| **Herramienta antes que anécdota** | Cada capítulo entrega **un artefacto utilizable el lunes por la mañana**: un lienzo, una plantilla de decisión, un checklist de comité. La teoría es el mínimo necesario para que la herramienta no se use mal. |
| **Tres capas de profundidad en el mismo texto** | El cuerpo del capítulo funciona para un estudiante de grado. Cada capítulo cierra con dos ampliaciones marcadas: `[+ Máster]` (rigor, evidencia, matices) y `[+ Dirección]` (aplicación a la propia organización del lector). El mismo libro sirve para ADE, para un MBA y para un comité. |

## 3. Arquitectura del libro

Cuatro partes, dieciséis capítulos. La secuencia responde a las cuatro preguntas que un
directivo se hace, en este orden: *¿dónde estoy?*, *¿hacia dónde voy?*, *¿con quién?*,
*¿cómo sé que funciona?*

### Parte I — El terreno *(¿dónde estoy?)*
Cómo la tecnología cambió la naturaleza de la decisión directiva.

1. **De coste a estructura** — por qué la tecnología dejó de ser una partida del presupuesto
2. **Anatomía de la decisión** — velocidad, reversibilidad e información
3. **El mapa de valor** — dónde se crea y dónde se captura valor en un negocio digitalizado
4. **Alfabetización no negociable** — datos, nube, IA y seguridad para quien decide

### Parte II — Estrategia *(¿hacia dónde voy?)*
5. **El problema bien planteado** — del DAFO decorativo al diagnóstico útil
6. **Ventaja competitiva hoy** — efectos de red, datos, costes de cambio y sus límites
7. **La cartera de apuestas** — opciones reales, horizontes y presupuesto de riesgo
8. **Del plan al sistema** — estructura, OKR y por qué la organización dibuja el producto

### Parte III — Liderazgo *(¿con quién?)*
9. **Liderar a quien sabe más que tú** — autoridad sin dominio técnico total
10. **Diseñar equipos que entregan** — autonomía, carga cognitiva y alineación
11. **Decidir en desacuerdo** — sesgos, disenso productivo y coste del consenso
12. **El cambio que sí ocurre** — adopción, resistencia y política organizativa

### Parte IV — Gobierno y ejecución *(¿cómo sé que funciona?)*
13. **Gobernar la tecnología** — inversión, deuda técnica, riesgo y proveedores
14. **Métricas que no mienten** — del indicador decorativo al sistema de medición
15. **Delegar en una máquina** — qué decisiones ceder a la IA y cuáles no
16. **El criterio se entrena** — cómo se forma un directivo que envejece bien

## 4. Estado del proyecto

| Pieza | Estado |
|---|---|
| Tesis, arquitectura y guía de estilo | ✅ Cerrado |
| Introducción | ✅ Escrita |
| Capítulo 1 (capítulo modelo, fija el estándar) | ✅ Escrito |
| **Parte II completa — capítulos 5, 6, 7 y 8** | ✅ **Escrita** |
| Capítulos 2–4 (resto de la Parte I) | 🟡 Esqueleto detallado listo para redacción |
| Capítulos 9–16 (Partes III y IV) | 🟡 Esqueleto detallado listo para redacción |
| Guía docente de la asignatura (6 ECTS) | ✅ Completa |
| Plan de 15 sesiones | ✅ Completo |
| Evaluación y rúbricas | ✅ Completo |
| Proyecto integrador | ✅ Completo |
| Plantillas y lienzos | ✅ 9 de 16 |
| Casos | 🟡 Guía de redacción + 1 caso modelo |

## 5. Mapa del repositorio

```
libro/
├── README.md                  ← este documento: tesis, arquitectura, estado
├── GUIA-DE-ESTILO.md          ← voz, anatomía de capítulo, reglas de rigor
├── manuscrito/                ← el libro
│   ├── 00-introduccion.md             (completa)
│   ├── 01-de-coste-a-estructura.md    (capítulo modelo, completo)
│   ├── 05..08-*.md                    (Parte II completa)
│   └── 02-04, 09-16-*.md              (esqueletos detallados)
├── docencia/                  ← la asignatura derivada del libro
│   ├── guia-docente.md
│   ├── plan-de-sesiones.md
│   ├── evaluacion-y-rubricas.md
│   ├── proyecto-integrador.md
│   └── casos/
└── plantillas/                ← los artefactos que entrega cada capítulo
```

## 6. Del libro a la asignatura

El libro está diseñado para **desencadenar** en una asignatura, no para adaptarse a ella a
posteriori. La correspondencia es directa:

- **16 capítulos → 15 sesiones** de 4 horas (6 ECTS, 60 h presenciales), más la semana de
  defensas. Cada sesión son dos bloques: concepto y discusión (2 h) + taller de herramienta (2 h).
- **1 herramienta por capítulo → 1 entregable por sesión**, que se acumula en el proyecto.
- **El proyecto integrador** («Comité de Dirección») consiste en que cada equipo asuma la
  dirección de una empresa y produzca, semana a semana, las piezas de un plan
  estratégico-tecnológico defendible. Al final del curso, el proyecto **es** el libro
  aplicado.

Encaja en ADE, Empresariales, IGE y programas de máster/ejecutivos ajustando qué capas se
exigen (`base` / `[+ Máster]` / `[+ Dirección]`). Ver [`docencia/guia-docente.md`](docencia/guia-docente.md).

## 7. Títulos en evaluación

1. **Dirigir con criterio** — *Liderazgo y estrategia en la empresa intensiva en tecnología* ← trabajo actual
2. **La escasez nueva** — *Qué queda por decidir cuando el software ya ejecuta*
3. **Comité de dirección** — *Estrategia y liderazgo tecnológico, en la práctica*

## 8. Próximos pasos

1. **Cerrar los capítulos 2, 3 y 4** para completar la Parte I. El 4 —alfabetización— es el
   más delicado: hay que escribirlo sobre conceptos y no sobre productos, o caduca en un año.
2. **Redactar la Parte III** (caps. 9–12). Es la que sostiene la tesis de que la mitad del
   problema tecnológico es un problema de personas y estructura.
3. Escribir las **7 plantillas** que faltan (03, 04, 09, 10, 12, 13, 16).
4. Escribir **3 casos largos** más, uno por parte, con nota docente propia.
5. **Piloto:** impartir las sesiones 1 y 5–8 —las que ya tienen capítulo completo— y medir.
