# 2. Anatomía de la decisión

> **La pregunta**
> ¿Por qué las organizaciones tardan meses en decisiones que se pueden deshacer y minutos en
> las que no?
>
> **La idea**
> El error caro no es decidir mal: es aplicar a una decisión reversible el proceso de una
> irreversible. La primera pregunta ante cualquier decisión no es «¿qué hacemos?», sino
> «¿qué tipo de decisión es esta?».

> **Estado:** esqueleto. Redacción pendiente sobre el estándar del capítulo 1.

---

## El problema

Escena a construir: un comité dedica cinco reuniones y dos informes externos a elegir
herramienta de gestión de campañas —decisión reversible en tres meses con coste de salida
moderado— y resuelve en veinte minutos, al final del orden del día y con dos personas
ausentes, la firma de un contrato de plataforma a cinco años con penalización de salida.
Ambas cosas ocurren el mismo trimestre y nadie percibe la asimetría.

Tesis del apartado: **el esfuerzo deliberativo de una organización no se asigna según lo que
está en juego, sino según lo visible que es el error**. Un error en la herramienta de
campañas se ve y tiene culpable; un error en el contrato a cinco años se materializa cuando
quien lo firmó ya no está.

## El marco

1. **Los dos ejes.** Reversibilidad (¿cuánto cuesta deshacerlo?) e impacto (¿qué se pone en
   juego?). Cuatro cuadrantes, cuatro procesos distintos. La formulación popular de puertas
   «de una dirección» y «de dos direcciones» (atribuida a Jeff Bezos en su carta a
   accionistas de 2015) es una simplificación útil de la que conviene conocer los límites.
2. **La tercera variable que se olvida: el coste de la demora.** No decidir es decidir, y
   tiene precio. Formular el coste de demora en euros/semana convierte la prudencia en un
   número comparable con el riesgo del error.
3. **El valor de la información adicional.** Cuándo esperar merece la pena: solo si la
   información que llegará puede cambiar la decisión *y* llega antes de que el coste de
   demora la anule. Regla operativa: si nadie sabe decir qué dato concreto haría cambiar de
   opinión, esperar no es prudencia, es evitación.
4. **Cómo cambia todo esto con la tecnología.** Lo digital ha movido masivamente decisiones
   del cuadrante irreversible al reversible (probar un precio, lanzar a un segmento, retirar
   una función). Pero ha creado una categoría nueva y peligrosa: decisiones que *parecen*
   reversibles y no lo son —elección de plataforma, modelo de datos, dependencia de un
   proveedor, y hoy, dependencia de un modelo—. Punto central del capítulo.
5. **Quién decide.** Distinguir decidir, ser consultado, ser informado y tener veto.
   La mayor parte de la lentitud organizativa es ambigüedad no resuelta sobre esto.

## La herramienta

**Ficha de decisión de una página** → `plantillas/02-ficha-de-decision.md`

Campos: decisión en una frase · tipo de puerta · impacto estimado · coste de demora por
semana · quién decide / consultados / informados · qué dato haría cambiar de opinión ·
fecha de revisión · qué haremos si nos equivocamos.

Regla de uso: la ficha se escribe **antes** de la reunión y circula. La reunión se dedica a
lo que la ficha no resuelve. Su segundo valor aparece meses después: es el único registro
de qué se sabía cuando se decidió, lo que permite distinguir una mala decisión de un mal
resultado (capítulo 16).

## El caso

`[Caso anonimizado]` Contrato plurianual con un proveedor de plataforma firmado como si
fuera reversible. Reconstrucción del coste real de salida a los tres años. Contraste con la
decisión de producto que el mismo comité sobreanalizó el mismo trimestre.

## Cómo se hace mal

- **El comité como seguro de responsabilidad.** *Síntoma:* decisiones sin dueño nominal.
- **Parálisis por datos.** *Síntoma:* se pide otro informe sin saber qué respondería.
- **Prudencia asimétrica.** *Síntoma:* rigor proporcional a la visibilidad, no al riesgo.
- **La reversibilidad supuesta.** *Síntoma:* «si no funciona, lo cambiamos» sin haber
  calculado nunca el coste de cambiarlo.
- **Reabrir sin información nueva.** *Síntoma:* la decisión vuelve al orden del día porque
  a alguien le sigue sin gustar.

## Checklist del directivo
*(10-12 líneas, pendientes de redacción)*

### [+ Máster]
Teoría de la decisión y racionalidad limitada (Simon); *satisficing* frente a optimización.
Evidencia sobre calibración y exceso de confianza. Crítica a la dicotomía de puertas: la
reversibilidad es un continuo y depende del contexto competitivo, no solo del contrato.
Coste de demora en la literatura de desarrollo de producto (Reinertsen) y su discutible
traslado a decisiones estratégicas.

### [+ Dirección]
Auditoría de tus últimas diez decisiones de comité: clasifícalas en los cuatro cuadrantes y
mide el tiempo de deliberación de cada una. La correlación —o su ausencia— entre esfuerzo y
reversibilidad es el diagnóstico. Segunda tarea: identifica las tres dependencias actuales
de tu empresa que crees reversibles y pide por escrito el coste real de salida de cada una.

## Ejercicio
**E2:** clasificar tres decisiones documentadas de la empresa del proyecto, redactar la
ficha retrospectiva de una de ellas y estimar su coste de demora.

## Para seguir
Kahneman, *Pensar rápido, pensar despacio* (los sesgos que afectan al comité, no al
individuo aislado) · Reinertsen, *The Principles of Product Development Flow* (coste de
demora) · Cartas a accionistas de Amazon, 2015-2016 (la formulación original de las
puertas) · Simon, *Administrative Behavior*.
