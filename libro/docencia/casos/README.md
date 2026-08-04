# Casos

## Cómo se escribe un caso para este libro

Un caso no es una historia con moraleja. Es **una situación de decisión con información
insuficiente**, construida para que un grupo competente pueda llegar razonablemente a
conclusiones opuestas. Si todos los equipos del aula llegan a lo mismo, el caso está mal
escrito.

### Reglas

1. **Etiqueta obligatoria en la primera línea.** `[Caso público]`, `[Caso anonimizado]` o
   `[Caso compuesto]`. Un caso compuesto presentado como real es la línea roja del proyecto.
2. **El caso termina antes de la decisión.** Nunca se cuenta qué pasó después en el
   documento del estudiante. El desenlace, cuando existe, va en la nota docente.
3. **Información incompleta y algo contradictoria.** Como en la realidad: dos fuentes
   internas que no coinciden, un dato que nadie sabe de dónde salió, una cifra desactualizada.
4. **Sin villanos.** Toda persona del caso actúa de forma racional dados sus incentivos. Si
   hay alguien que se comporta de forma absurda, falta información sobre sus incentivos.
5. **La tecnología nunca es el tema.** Es la restricción o la palanca. El tema siempre es
   una decisión de dirección.
6. **Extensión:** 4–8 páginas para caso de sesión, 10–15 para caso largo de máster. Anexos
   con datos brutos aparte, para que los equipos tengan que decidir qué mirar.

### Estructura

```
[Etiqueta]
Título

1. La situación            La empresa, el momento, quién decide y cuándo
2. Antecedentes            Cómo se llegó aquí. Incluir al menos una decisión pasada
                           que pareciera razonable entonces y hoy no lo parezca
3. Las posiciones          2-3 actores internos con posturas distintas y bien fundadas
4. Los datos               Lo que hay, con sus lagunas explícitas
5. La decisión             Qué hay que decidir, para cuándo y quién firma
Anexos                     Datos brutos, organigrama, cuentas
```

### Nota docente (documento separado, nunca se entrega al aula)

- Qué se pretende que descubran y en qué orden.
- Las tres o cuatro respuestas típicas y qué tiene de bueno y de malo cada una.
- Los datos que casi nadie usa y que cambian la conclusión.
- Preguntas de conducción, cronometradas.
- Qué pasó realmente, si se sabe, y —más importante— por qué eso **no** convierte en
  correcta la decisión que se tomó.

---

## Catálogo

| Caso | Cap. | Tipo | Estado |
|---|---|---|---|
| **El recorte que nadie decidió** | 1 | Compuesto | ✅ Redactado (abajo) |
| El contrato reversible | 2 | Anonimizado | 🟡 Pendiente |
| El fabricante que conectó sus máquinas | 3 | Compuesto | 🟡 Pendiente |
| El plan intercambiable | 5 | Anonimizado | 🟡 Pendiente |
| La apuesta zombi | 7 | Compuesto | 🟡 Pendiente |
| Cuatro equipos, ningún dueño | 10 | Anonimizado | 🟡 Pendiente |
| Sesenta indicadores en verde | 14 | Compuesto | 🟡 Pendiente |
| El revisor que aprobaba uno por minuto | 15 | Compuesto | 🟡 Pendiente |

---

# El recorte que nadie decidió

`[Caso compuesto]` *Construido a partir de patrones observados en varias empresas
distribuidoras de tamaño medio. Las proporciones son representativas; ninguna cifra
corresponde a una empresa concreta.*

**Capítulo 1 · Sesión 1 · Duración recomendada: 50 minutos**

## 1. La situación

Suministros Aranda es una distribuidora industrial con 412 empleados, siete delegaciones y
un catálogo de unas 40.000 referencias que vende a instaladores, talleres y pequeñas
industrias. Facturó 96 millones de euros el año pasado con un margen de explotación del
4,1 %, dos décimas por debajo del ejercicio anterior.

Es 14 de octubre. El comité de dirección se reúne para cerrar el presupuesto del año
siguiente. El consejo ha pedido una mejora de 0,5 puntos de margen. La dirección financiera
ha propuesto un plan de contención que incluye un recorte del 20 % en el presupuesto de
tecnología, que este año asciende a 2,3 millones de euros —un 2,4 % de la facturación,
frente a un 2,1 % que un informe sectorial atribuye a la media del sector—.

Hay que decidir hoy.

## 2. Antecedentes

Suministros Aranda instaló su ERP actual hace catorce años. Fue un buen proyecto: se hizo a
tiempo, dentro de presupuesto, y desde entonces el sistema no ha tenido caídas relevantes.
Tres de las siete delegaciones proceden de adquisiciones y siguen operando con sistemas
propios integrados mediante procesos nocturnos de sincronización.

Hace cuatro años, un director de sistemas que ya no está en la empresa propuso un plan de
modernización del motor de facturación por 1,1 millones repartidos en tres años. El comité
lo aplazó dos veces —«el sistema funciona, no hay urgencia»— y finalmente lo retiró del
plan. Nadie discutió el fondo: simplemente nunca fue lo más urgente.

El actual responsable de sistemas lleva año y medio en el puesto. En su primer comité
presentó un documento titulado «Riesgos de la base tecnológica actual» que ocupaba once
páginas. Consta en acta que se dio por recibido.

## 3. Las posiciones

**Dirección financiera.** El gasto está por encima de la media del sector y la empresa
necesita margen. Propone un recorte lineal del 20 % sobre todas las partidas: es
transparente, no requiere una discusión partida por partida que llevaría semanas que no
hay, y evita que la decisión parezca arbitraria o dirigida contra alguien. Señala, con
razón, que en los dos últimos ejercicios se aprobaron incrementos del presupuesto de
tecnología sin que ningún indicador de negocio mejorara de forma atribuible.

**Dirección de sistemas.** Sostiene que el 20 % no se puede aplicar de forma uniforme
porque las partidas no son equivalentes. Advierte de que el motor de facturación y los
procesos de sincronización de las tres delegaciones adquiridas están en una situación que
califica de frágil. Cuando se le pide que cuantifique el riesgo, responde que no puede darlo
en euros. Ha llevado a este comité alguna versión de esta advertencia tres veces en año y
medio.

**Dirección comercial.** No tiene opinión sobre el presupuesto de tecnología. Sí menciona,
en el punto anterior del orden del día, que los tres mayores clientes —que suman el 11 % de
la facturación— han preguntado en los últimos meses por la posibilidad de facturación por
consumo en lugar de por pedido, un modelo que dos competidores ya ofrecen. Lo plantea como
una tendencia a vigilar, no como una petición formal, y nadie conecta ese punto con el
siguiente.

## 4. Los datos

Presupuesto de tecnología del ejercicio en curso (2,3 M€):

| Partida | Importe | Notas |
|---|---|---|
| Licencias y suscripciones | 640.000 € | ERP, ofimática, correo, herramientas de delegación |
| Infraestructura y nube | 380.000 € | Mitad centro de datos propio, mitad nube |
| Personal interno (9 personas) | 610.000 € | Incluye 2 personas dedicadas a los procesos de sincronización nocturna |
| Mantenimiento de aplicaciones (proveedor) | 340.000 € | Contrato anual, renovación en marzo |
| Proyectos | 250.000 € | Dos en curso: portal de cliente y cuadro de mando comercial |
| Seguridad | 80.000 € | Auditoría anual y herramientas |

Datos adicionales disponibles en anexo (no todos relevantes):
- Ninguna incidencia grave registrada en los últimos 24 meses.
- Tiempo medio desde aprobación de un cambio comercial hasta su puesta en producción en los
  últimos tres casos documentados: 4, 7 y 11 meses.
- La sincronización nocturna de las delegaciones adquiridas falla, de media, dos noches al
  mes; se corrige manualmente antes de las 9:00 y no se registra como incidencia.
- De las 9 personas del equipo interno, 1 conoce el motor de facturación.
- El informe sectorial que fija la media en el 2,1 % tiene tres años y agrupa empresas de
  entre 20 y 3.000 empleados.

## 5. La decisión

El comité debe cerrar hoy el presupuesto de tecnología del ejercicio siguiente. Tiene tres
horas y otros seis puntos en el orden del día.

**Preguntas para el equipo:**

1. ¿Recortar un 20 %? Si la respuesta es sí, ¿de dónde exactamente y por qué de ahí?
2. ¿Qué opciones futuras vende la empresa con vuestra propuesta, y qué valen?
3. ¿Qué información pediríais antes de decidir, sabiendo que la decisión es hoy y que
   pedirla también tiene un coste?
4. Redactad la diapositiva única que llevaríais al consejo para justificar la decisión.

---

### Nota docente

*(Documento separado. No se entrega al aula.)*

**Lo que se pretende que descubran, en este orden:**

1. Que el recorte lineal es una decisión, no una ausencia de decisión, y que afirma
   implícitamente que todas las partidas valen lo mismo.
2. Que los datos del anexo contienen ya el diagnóstico —la ausencia de incidencias convive
   con un tiempo de cambio de 4 a 11 meses, dos noches de fallo al mes normalizadas y una
   sola persona que conoce el sistema crítico— y que casi ningún equipo usa esos tres datos
   en su primera respuesta.
3. Que la petición de los tres clientes grandes, mencionada en un punto distinto del orden
   del día, es el vínculo que nadie establece. Cuando un equipo lo establece, la sesión
   cambia de nivel: conviene esperar a que salga de ellos y no señalarlo antes de los 30
   minutos.
4. Que el *benchmark* sectorial es inutilizable —tres años de antigüedad, rango de tamaño
   absurdo—, y que casi ningún equipo cuestiona su validez porque viene en la tabla.

**Respuestas típicas y qué hacer con ellas:**

- *«No recortar, es demasiado arriesgado»* → Pedir la cuantificación del riesgo. Es la misma
  posición del director de sistemas y falla por lo mismo: sin importe, no compite con una
  necesidad de margen que sí lo tiene.
- *«Recortar donde no duela: proyectos y seguridad»* → Es lo que hace la mayoría. Preguntar
  qué opción se vende. Suele revelar que se ha recortado precisamente el gasto que compra
  futuro, porque es el único cuyo efecto a tres meses es nulo y visible.
- *«Recortar el mantenimiento del proveedor y hacerlo con el equipo interno»* → Buena
  intuición de eficiencia. Contrastar con el dato de que 1 de 9 personas conoce el sistema
  crítico.
- *«Recortar 20 % y aceptar el riesgo, declarándolo»* → Es la mejor respuesta posible si va
  acompañada de qué opciones concretas se venden y a qué precio estimado. Premiar la
  declaración explícita mucho más que la cifra elegida.

**Conducción (50 min):** 10 min de lectura individual · 15 min en equipo · 15 min de puesta
en común por rondas, empezando por el equipo que recorte más · 10 min de cierre
introduciendo el lienzo del capítulo 1 sobre lo que ellos ya han descubierto.

**Cierre:** el caso continúa en la sesión 3 (dónde se captura el valor en este sector) y
vuelve a aparecer en la sesión 13 (la deuda del motor de facturación, con principal e
interés estimados). Conviene anunciarlo: los equipos toman notas distintas cuando saben que
volverán.
