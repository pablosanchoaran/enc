# 13. Gobernar la tecnología

> **La pregunta**
> ¿Qué significa gobernar la tecnología, más allá de aprobar presupuestos y revisar
> incidencias?
>
> **La idea**
> Gobernar no es controlar: es asignar derechos de decisión. Quién decide qué, con qué
> información y con qué consecuencia. Casi todos los problemas de gobierno son ambigüedad
> sobre esas tres cosas.

> **Estado:** esqueleto. Apertura de la Parte IV.

---

## El problema

Escena a construir: un comité de arquitectura creado para dar coherencia técnica que se ha
convertido en una aduana. Todo pasa por él, su cola crece, los equipos aprenden a esquivarlo
—no por rebeldía, sino porque tienen fechas— y el resultado es exactamente el contrario del
buscado: menos coherencia y más lentitud. El fallo no es de las personas del comité: es que
se le dieron derechos de veto sin darle responsabilidad sobre la fecha de entrega.

## El marco

1. **Derechos de decisión.** Base declarada: el trabajo de Weill y Ross sobre gobierno de TI.
   Cinco dominios de decisión —principios, arquitectura, infraestructura, necesidades de
   negocio, inversión— y la pregunta clave para cada uno: quién decide y quién aporta.
   Aplicado bien, este marco resuelve más conflictos que cualquier reorganización.
2. **La regla de oro del gobierno.** Quien tiene derecho de veto debe soportar consecuencia
   por la demora que causa. Un veto sin coste se ejerce siempre, porque bloquear nunca es
   arriesgado para quien bloquea. Es la idea más útil del capítulo y la más difícil de
   implantar.
3. **Deuda técnica como pasivo.** Cómo hacerla visible en lenguaje financiero: principal
   (coste de arreglarlo), interés (sobrecoste que pagamos cada mes por no arreglarlo) y
   vencimiento (cuándo deja de ser una molestia y pasa a ser un bloqueo). Cómo mantener un
   registro que el comité pueda leer sin traducción.
4. **Proveedores y dependencia.** Qué se externaliza y qué no. Regla: se puede externalizar
   la ejecución, nunca el criterio. Cómo evaluar la dependencia real —coste de salida, tiempo
   de salida, conocimiento que se va con el proveedor— y por qué se subestima siempre.
5. **Riesgo y seguridad como decisión de negocio.** Sacar la seguridad del terreno técnico:
   todo riesgo aceptado tiene importe, dueño y firma. Cómo se lleva un riesgo al comité de
   forma que se pueda decidir en lugar de asustarse.
6. **El órgano de gobierno que sí funciona.** Composición, cadencia, qué decide y qué no, y
   —crítico— qué información recibe. Un comité que recibe presentaciones decide sobre
   presentaciones.

## La herramienta

**Matriz de derechos de decisión + registro de deuda** → `plantillas/13-derechos-de-decision.md`

Matriz: dominios de decisión en filas, órganos y roles en columnas, y en cada celda quién
decide, quién aporta y quién es informado. Rellenarla en grupo es el ejercicio: los
desacuerdos sobre las celdas son el mapa real de los conflictos de la organización.

Registro de deuda: elemento · principal estimado · interés mensual estimado · qué bloquea ·
vencimiento previsto · dueño.

## El caso

`[Caso compuesto]` Empresa que sustituye su comité de arquitectura-aduana por un modelo de
principios y excepciones: se publican las reglas, los equipos deciden dentro de ellas sin
pedir permiso, y solo las excepciones se debaten. Efecto sobre tiempo de entrega y sobre
coherencia técnica —los dos, porque conviene mostrar también lo que empeora—.

## Cómo se hace mal

- **Gobierno como aduana.** *Síntoma:* la cola de aprobación crece cada trimestre.
- **Veto sin consecuencia.** *Síntoma:* quien bloquea nunca responde por la fecha.
- **Externalizar el criterio.** *Síntoma:* el proveedor propone, evalúa y ejecuta su propia
  propuesta.
- **Deuda técnica como queja.** *Síntoma:* se menciona en todas las reuniones y no está en
  ningún registro con importe.
- **Seguridad sin importe.** *Síntoma:* los riesgos se presentan en colores y no en euros, y
  por tanto no se pueden priorizar frente a nada.
- **Gobernar por presentación.** *Síntoma:* el comité no ha visto nunca un dato que no venga
  ya interpretado.

## Checklist del directivo
*(pendiente)*

### [+ Máster]
Weill y Ross, *IT Governance*: los seis arquetipos de gobierno y la evidencia sobre su
relación con el rendimiento. Teoría de la agencia aplicada a la relación negocio-tecnología
y a la relación con proveedores. Coste de transacción (Williamson) como marco para decidir
qué se internaliza. Literatura sobre deuda técnica: el concepto es de Ward Cunningham y su
formalización económica sigue siendo débil —discutir si es una metáfora útil o una analogía
que se ha estirado demasiado.

### [+ Dirección]
Rellena la matriz de derechos de decisión con tu comité, cada uno por separado y después en
común. Las celdas donde no haya acuerdo son, literalmente, la lista de los conflictos que se
repiten en tu organización. Segunda tarea: pide el coste y el tiempo de salida de tus tres
mayores proveedores tecnológicos, por escrito. La cara que ponga el equipo al recibir la
petición ya es información.

## Ejercicio
**E13:** matriz de derechos de decisión y registro de deuda técnica para la empresa del
proyecto, con propuesta de órgano de gobierno: composición, cadencia y ámbito.

## Para seguir
Weill y Ross, *IT Governance* · Cunningham, sobre la metáfora de la deuda técnica (el texto
original es muy corto) · Schwartz, *A Seat at the Table* · Cualquier informe anual, sección
de riesgos: para ver cómo se redacta un riesgo que alguien firma.
