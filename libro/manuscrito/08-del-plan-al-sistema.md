# 8. Del plan al sistema

> **La pregunta**
> ¿Por qué un plan aprobado por unanimidad no se ejecuta?
>
> **La idea**
> Porque la estructura no cambió. Una organización produce sistemas que reproducen su propia
> estructura de comunicación; cuando el plan exige algo que la estructura no puede producir,
> la estructura gana siempre.

---

## El problema

Diciembre. El comité aprueba el plan estratégico por unanimidad, después de cuatro meses de
trabajo, dos jornadas fuera de la oficina y un documento de sesenta páginas que todo el mundo
considera el mejor que ha hecho la empresa.

Diciembre del año siguiente. La revisión anual sitúa el cumplimiento en torno al 30 %. El
análisis oficial de las causas menciona, por este orden, la falta de recursos, el cambio de
prioridades derivado de la coyuntura y la dificultad para atraer determinados perfiles. Se
aprueba un plan nuevo, mejor enfocado, y se pasa al siguiente punto.

Lo que no aparece en ese análisis es el dato que lo explica casi todo. Las tres iniciativas
principales del plan requerían, cada una, la actuación coordinada de cinco o más equipos con
presupuestos distintos, prioridades distintas y jefes distintos. Ninguna de las tres tenía a
nadie con autoridad para resolver un conflicto entre dos de esos equipos sin escalarlo al
comité. Y el comité se reunía una vez al mes.

Haz la cuenta. Una iniciativa que atraviesa cinco fronteras organizativas y en la que cada
conflicto entre áreas tarda un mes en resolverse no fracasa por falta de talento ni por falta
de compromiso: fracasa por aritmética. Se aprobó un plan que la estructura de la empresa era
incapaz de producir, y nadie lo comprobó porque **nadie considera la estructura organizativa
parte del plan**.

Esa comprobación es lo que hace este capítulo. Es el que cierra la Parte II y el que la
conecta con la Parte III, porque a partir de aquí la estrategia deja de ser un problema de
análisis y pasa a ser un problema de personas y de diseño.

## El marco

### La ley de Conway

En 1968, Melvin Conway publicó un artículo de ocho páginas con una observación que hoy se cita
constantemente y se aplica poco:

> «Las organizaciones que diseñan sistemas están abocadas a producir diseños que son copias de
> las estructuras de comunicación de esas organizaciones.»

No es una metáfora ni una advertencia moral. Es una observación sobre cómo funciona el diseño
cuando lo hacen varias personas: las interfaces del producto acaban coincidiendo con las
fronteras de la organización, porque las decisiones se toman dentro de los equipos y se
negocian entre ellos, y negociar es más caro que decidir. Si tres equipos construyen un
sistema, el sistema tendrá tres partes con costuras entre ellas, esté eso justificado
técnicamente o no.

La evidencia posterior lo respalda. Los trabajos de MacCormack, Baldwin y Rusnak sobre la
«hipótesis del espejo» comparan la arquitectura de productos desarrollados por organizaciones
concentradas y por organizaciones distribuidas y encuentran diferencias sistemáticas de
modularidad. No es una ley física, pero es una regularidad robusta.

Para un directivo, la consecuencia es una sola frase, y es la más importante de este capítulo:

> **La estructura organizativa es una decisión de arquitectura, aunque quien la toma no lo
> sepa.**

Cuando se reorganiza un área por razones de gestión de personas —para dar un equipo a alguien
que lo merece, para separar a dos que no se llevan bien, para simplificar el organigrama— se
está decidiendo, sin saberlo, cómo se van a partir los sistemas durante los próximos cinco
años y qué cosas van a ser fáciles y difíciles de cambiar. Es la decisión de arquitectura más
importante que toma una empresa y habitualmente se toma en una conversación de recursos
humanos.

Y funciona en los dos sentidos. Una empresa cuya estructura está partida por producto
producirá sistemas partidos por producto, y por tanto le costará muchísimo ofrecer al cliente
una experiencia unificada, por muy convincente que sea el plan que dice que el cliente está en
el centro. El plan no puede contra la estructura. La estructura es el plan que se ejecuta de
verdad.

### La maniobra inversa

Si la estructura determina el resultado, la jugada es evidente: **diseñar primero el resultado
que se quiere y después la estructura que lo produce**. En la literatura técnica esto se llama
maniobra inversa de Conway y consiste en organizar los equipos según la arquitectura deseada,
en lugar de aceptar la arquitectura que produzca la organización actual.

Tiene una trampa, y hay que decirla porque es cara. Reorganizar no es gratis. Cada
reorganización destruye contexto acumulado, rompe relaciones informales que funcionaban,
consume varios meses de productividad y genera rotación. Una empresa que reorganiza cada
dieciocho meses no está aplicando la maniobra inversa: está impidiendo que ninguna estructura
llegue a producir nada.

La forma sensata de usarlo es como criterio de decisión, no como programa de cambio continuo:
cuando haya que reorganizar de todas formas —y hay que hacerlo de vez en cuando—, que la
arquitectura deseada sea uno de los criterios de diseño y no una consecuencia accidental. Y
cuando el plan estratégico exija algo que la estructura no puede producir, poner la
reorganización **dentro del plan**, con su coste explícito, en lugar de esperar que el plan se
ejecute solo.

### Las dependencias son el freno

Aquí está la parte operativa y la que puede aplicarse mañana.

El tiempo que tarda una iniciativa en completarse depende menos de la capacidad de cada equipo
que del **número de fronteras organizativas que hay que cruzar**. Es una afirmación fuerte y la
sostengo: en la mayoría de las organizaciones que he visto por dentro, el tiempo de espera
—esperando a que otro equipo tenga hueco, a que se resuelva un conflicto de prioridades, a que
alguien apruebe— supera ampliamente al tiempo de trabajo efectivo. En las peores, la
proporción es de cinco a uno o más.

Esto tiene tres consecuencias prácticas que casi nunca se sacan:

**Añadir personas a un equipo bloqueado no acelera nada.** Si el freno es la espera, más
capacidad produce más trabajo en curso, no más entregas. Es la versión organizativa de lo que
Brooks describió en 1975 para los proyectos de software.

**El número de fronteras es más predictivo que cualquier estimación.** Si quieres saber cuánto
va a tardar una iniciativa, cuenta cuántos equipos con jefes distintos tienen que actuar. Es
un dato objetivo, se obtiene en veinte minutos y predice mejor que la suma de las estimaciones
de cada equipo, que siempre estiman su parte y nunca la espera.

**Por encima de cuatro fronteras, o se cambia la estructura o se cambia el plan.** No es una
ley, es una regla práctica. Lo que no funciona es dejar los dos intactos, que es la opción que
se elige casi siempre.

### OKR como sistema de alineación

Los objetivos y resultados clave se han popularizado como sistema de gestión y se usan mal con
enorme frecuencia. Conviene ser preciso sobre para qué sirven.

**Para lo que sirven:** para que un equipo pueda decidir localmente sin preguntar. Si un
equipo sabe cuál es el resultado que se espera de él y cómo se medirá, puede resolver por sí
mismo las decenas de decisiones pequeñas que de otro modo tendría que escalar. Un buen sistema
de OKR es, en el fondo, **una máquina de reducir dependencias de decisión**, y por eso está en
este capítulo y no en el de métricas.

**Para lo que no sirven:** para evaluar el desempeño individual. Y ahí es donde se rompen.

Los tres fallos habituales, por frecuencia:

**La cascada mecánica hasta el individuo.** Cada nivel deriva sus objetivos del superior hasta
llegar a la persona. El resultado es que nadie mira los objetivos del equipo, que son los que
importaban, y que el sistema se convierte en un mecanismo de reparto de responsabilidad en
lugar de en uno de alineación.

**La vinculación a la retribución.** En cuanto el bonus depende del objetivo, los objetivos se
vuelven sospechosamente alcanzables. Es la ley de Goodhart del capítulo 14 aplicada al sistema
de gestión completo, y es predecible: nadie se compromete voluntariamente con una meta
ambiciosa si eso le cuesta dinero.

**Confundir objetivo con lista de tareas.** «Lanzar el nuevo portal» no es un resultado clave:
es una tarea. El resultado clave sería «que el 40 % de los pedidos de clientes pequeños entren
por autoservicio». La diferencia importa porque la primera formulación se cumple lanzando algo
que nadie usa.

### Ritmo

Un sistema de ejecución no es un documento: es **un calendario de conversaciones**. Qué se
revisa semanalmente, qué mensualmente, qué trimestralmente, y qué se decide en cada una.

La ausencia de ritmo es la razón por la que muchos planes correctos no se ejecutan: se aprueban
en diciembre, se revisan en junio y para entonces han pasado seis meses en los que la
organización ha estado respondiendo a lo urgente, que es lo que hace toda organización que no
tiene otra cosa en la agenda.

Un ritmo mínimo viable, que cabe en cualquier empresa:

| Cadencia | Qué se mira | Qué se decide |
|---|---|---|
| **Semanal** (equipo) | Qué está bloqueado | Desbloquear o escalar |
| **Mensual** (dirección) | Progreso de las iniciativas del plan y dependencias en conflicto | Prioridad entre equipos |
| **Trimestral** (comité) | Cartera de apuestas (cap. 7), criterios de parada, indicadores | Continuar, parar, reasignar |
| **Anual** (consejo) | Diagnóstico (cap. 5) y ventaja (cap. 6) | ¿Sigue siendo válido el núcleo? |

Lo importante no es la tabla concreta, sino que cada nivel tenga **una decisión asignada**. Una
reunión de seguimiento en la que no se decide nada es un informe leído en voz alta, y consume
el recurso más caro de la empresa para producir cero.

## La herramienta

**Mapa de dependencias de iniciativa** →
[`plantillas/08-mapa-de-dependencias.md`](../plantillas/08-mapa-de-dependencias.md)

Se aplica a las tres iniciativas principales del plan, no a todas. Toma unos noventa minutos
por iniciativa y hay que hacerlo con gente de los equipos implicados, no en el despacho.

**Paso 1 — Listar los equipos que deben actuar.** Todos, incluidos los que solo tienen que
aprobar algo. Una aprobación es una dependencia y suele ser la más lenta.

**Paso 2 — Marcar las fronteras.** Una frontera es un cambio de jefe con presupuesto propio.
Dos equipos que dependen de la misma persona no constituyen una frontera; dos que dependen de
directores distintos, sí. Se cuentan.

**Paso 3 — Identificar quién resuelve los conflictos.** Para cada par de equipos que tenga que
coordinarse: si mañana discrepan sobre prioridad, ¿quién decide, y sin escalar a quién? Esta
es la columna que produce el diagnóstico. Cuando la respuesta es «el comité» o «nadie», ya
sabes dónde va a atascarse.

**Paso 4 — Marcar las decisiones que requieren autorización externa al equipo.** Cada una es
una espera.

**Paso 5 — Calcular la métrica de salida: fronteras cruzadas por iniciativa.** Y aplicar la
regla: por encima de cuatro, o se cambia la estructura o se cambia el plan.

**Paso 6 — Elegir.** Tres opciones legítimas y una ilegítima. Legítimas: cambiar la estructura
(mover personas para que la iniciativa quede dentro de menos fronteras), cambiar el plan
(reducir el alcance a lo que la estructura puede producir), o nombrar a alguien con autoridad
real sobre todas las partes implicadas. Ilegítima: dejar las dos cosas como están y confiar en
la coordinación, que es lo que se hace habitualmente y lo que produce el 30 % de cumplimiento
del principio de este capítulo.

## El caso

`[Caso anonimizado]` *Empresa real, con permiso. Cifras alteradas en escala, proporciones
respetadas.*

Una empresa de seguros de tamaño medio. Su plan estratégico tenía una iniciativa central:
permitir que un cliente contratara, modificara y reclamara desde un único sitio, sin llamar a
nadie. Llevaba dos años en el plan. El avance real era escaso y la explicación interna era que
faltaba capacidad de desarrollo.

### Lo que mostró el mapa

La organización técnica estaba estructurada por función, que es la forma más común y la más
natural de organizar: un equipo de front-end, uno de back-end, uno de datos, uno de
integraciones y uno de infraestructura. Cinco equipos, cinco responsables, cinco presupuestos.
Cada uno excelente en lo suyo.

Cualquier cosa que un cliente pudiera percibir requería a los cinco. Literalmente cualquiera:
un cambio en el formulario de alta necesitaba front-end (la pantalla), back-end (la lógica),
datos (el modelo), integraciones (el sistema de pólizas) e infraestructura (el despliegue).

El mapa de dependencias de la iniciativa principal dio **cinco fronteras** y esta columna de
resolución de conflictos:

| Par de equipos | ¿Quién resuelve un conflicto de prioridad? |
|---|---|
| Front-end ↔ Back-end | Director de Tecnología |
| Back-end ↔ Datos | Director de Tecnología |
| Datos ↔ Integraciones | Director de Tecnología |
| Integraciones ↔ Infraestructura | Director de Tecnología |
| Cualquiera ↔ Negocio | Comité de dirección (mensual) |

Una sola persona resolvía todos los conflictos internos y el comité mensual resolvía los
demás. El director de tecnología no era un cuello de botella por incompetencia: lo era por
diseño. Su agenda estaba compuesta casi enteramente por decisiones de prioridad entre equipos,
que es exactamente el síntoma que describe el capítulo 13.

El dato que cerró la discusión fue de archivo: el tiempo medio entre que se aprobaba un cambio
visible para el cliente y que estaba en producción era de **catorce semanas**, de las cuales el
trabajo efectivo sumaba unos once días. El resto era espera.

### El rediseño

Se pasó de cinco equipos funcionales a **tres equipos alineados al flujo de valor** —
contratación, gestión de póliza y siniestros—, cada uno con todas las capacidades necesarias
para entregar sin pedir permiso, más **un equipo de plataforma** que da servicio a los tres:
infraestructura, despliegue, seguridad y las integraciones comunes.

La diferencia clave no fue el organigrama: fue que cada equipo de flujo podía poner algo
delante del cliente sin depender de otro equipo. Las fronteras por iniciativa pasaron de cinco
a una o dos.

### Qué mejoró y qué empeoró

**Mejoró:** a los nueve meses, el tiempo medio de un cambio visible bajó de catorce semanas a
poco menos de cuatro. La agenda del director de tecnología se vació de decisiones de prioridad
—que ahora se toman dentro de cada equipo— y se llenó de decisiones de arquitectura y de
proveedor, que es donde aportaba.

**Empeoró, y hay que decirlo:** durante los primeros cuatro meses la productividad cayó de
forma visible. Se duplicaron esfuerzos: tres equipos resolviendo por separado problemas
parecidos, con tres soluciones distintas. La coherencia técnica se degradó y hubo que
recuperarla después, ya con el equipo de plataforma consolidado. Y dos personas del antiguo
equipo de datos, que eran las referencias técnicas de su especialidad y ahora estaban
repartidas en equipos donde eran las únicas de su disciplina, se marcharon en el primer año.

Ese bache de cuatro meses es completamente previsible y hay que presupuestarlo. La mayoría de
las reorganizaciones de este tipo que he visto fracasar no fracasaron por el diseño: fracasaron
porque el bache llegó, nadie lo había anunciado, y a los tres meses se abortó el cambio y se
volvió a la estructura anterior con el coste pagado y el beneficio sin cobrar.

**La lección de dirección:** si vas a hacer este cambio, anuncia el bache antes de que ocurra,
con su duración estimada, y comprométete públicamente a no revertir antes de la fecha. Es la
única protección contra tu propia impaciencia dentro de tres meses.

## Cómo se hace mal

**Reorganizar sin tocar dependencias.** *Síntoma:* cambian los organigramas y no cambian las
reuniones. *Por qué falla:* si después de la reorganización las mismas personas siguen
teniendo que ponerse de acuerdo para lo mismo, no se ha cambiado nada salvo los títulos.

**Aprobar un plan sin comprobar si la estructura puede producirlo.** *Síntoma:* no hay ninguna
diapositiva sobre estructura en la presentación del plan estratégico. *Por qué falla:* es el
error central del capítulo. La estructura es parte del plan, y si no aparece es que se ha dado
por buena la actual sin examinarla.

**OKR en cascada hasta el individuo.** *Síntoma:* cada persona tiene sus propios OKR. *Por qué
falla:* deja de ser un mecanismo de alineación entre equipos y se convierte en un sistema de
evaluación individual, que es otra cosa y que además funciona peor que los sistemas diseñados
para eso.

**Vincular OKR a retribución.** *Síntoma:* el porcentaje de cumplimiento de objetivos ronda
sospechosamente el 95 %. *Por qué falla:* has creado un incentivo a fijar objetivos fáciles y
lo has llamado sistema de gestión por objetivos.

**El comité como resolvedor de dependencias.** *Síntoma:* el orden del día del comité está
lleno de desbloqueos operativos. *Por qué falla:* es la señal más fiable de que la estructura
está mal diseñada, y además consume en coordinación el tiempo que debería dedicarse a dirigir.

**Estrategia nueva, estructura antigua.** *Síntoma:* el plan habla de cliente y la organización
sigue dividida por producto. *Por qué falla:* la estructura gana. Siempre. El plan producirá
como mucho un equipo transversal sin autoridad que se pasará dos años intentando coordinar a
gente que no le reporta.

**Reorganizar cada año.** *Síntoma:* la tercera reorganización en cuatro años. *Por qué falla:*
ninguna estructura llega a producir nada, porque el contexto acumulado se destruye antes de
rendir. Cuidado con este capítulo: la maniobra inversa es un criterio de diseño, no una
invitación a mover el organigrama cada vez que algo va lento.

## Checklist del directivo

- [ ] Para mi iniciativa estratégica principal, ¿cuántas fronteras organizativas hay que cruzar?
- [ ] ¿Quién resuelve un conflicto de prioridad entre dos de esos equipos sin escalármelo a mí?
- [ ] Si la respuesta anterior es «nadie» o «yo», ¿por qué me sorprende que el plan vaya lento?
- [ ] ¿Qué porcentaje del orden del día de mi comité son desbloqueos operativos?
- [ ] ¿Cuánto tarda un cambio visible para el cliente, y qué parte de ese tiempo es trabajo efectivo?
- [ ] ¿Aparece la estructura organizativa en alguna parte del plan estratégico aprobado?
- [ ] ¿Nuestra organización está partida de la misma forma en que queremos que el cliente nos perciba?
- [ ] ¿Nuestros OKR están vinculados a retribución? ¿Y por qué?
- [ ] ¿Nuestros resultados clave son resultados o son tareas con fecha?
- [ ] ¿Cada nivel de nuestro calendario de seguimiento tiene una decisión asignada?
- [ ] Si hicimos una reorganización el año pasado, ¿cambió alguna dependencia real o solo los títulos?
- [ ] ¿He presupuestado el bache de productividad del cambio que estoy a punto de aprobar?

---

### [+ Máster]

**Conway y la hipótesis del espejo.** El artículo original (*How Do Committees Invent?*, 1968)
es breve, informal y no aporta evidencia sistemática: es una conjetura bien argumentada. La
evidencia llegó después. MacCormack, Rusnak y Baldwin (2012) compararon la arquitectura de
productos funcionalmente equivalentes desarrollados por organizaciones concentradas
(empresariales) y distribuidas (código abierto) y encontraron diferencias sistemáticas de
modularidad en la dirección predicha. Colfer y Baldwin revisaron después la evidencia acumulada
y encontraron respaldo mayoritario pero no universal, con excepciones interesantes: las
organizaciones que rompen el espejo deliberadamente son precisamente aquellas que están
intentando cambiar de arquitectura. Es decir, **la ley se cumple salvo cuando se la ataca a
propósito**, que es exactamente lo que propone la maniobra inversa.

**Chandler y la dirección de la causalidad.** *Structure follows strategy* (1962) estableció
que las grandes empresas estadounidenses adoptaron la estructura multidivisional como
consecuencia de estrategias de diversificación. La literatura posterior ha argumentado
persistentemente la inversión —*strategy follows structure*—: las estructuras existentes
condicionan qué estrategias se llegan siquiera a considerar. Este capítulo asume implícitamente
la segunda dirección, o más bien un bucle: la estructura restringe las estrategias pensables, y
las estrategias que sobreviven al proceso son las que la estructura puede ejecutar. Discutir si
eso es determinismo estructural o simplemente realismo.

**OKR: adopción amplia, evidencia escasa.** Conviene decirlo con claridad porque es un caso
notable de práctica extendida sin base empírica publicada. El origen está en la dirección por
objetivos de Drucker (1954), pasa por Grove en Intel y se populariza con Doerr. La
investigación académica sobre fijación de objetivos (Locke y Latham, cinco décadas de
evidencia) sí respalda que objetivos específicos y ambiciosos mejoran el rendimiento en tareas
bien definidas, pero también documenta efectos adversos —comportamiento no ético,
estrechamiento del foco, deterioro de la cooperación— cuando los objetivos son numéricos, están
vinculados a recompensas y las tareas son complejas. La aplicación honesta de esa literatura al
trabajo directivo apoya, precisamente, las dos advertencias de este capítulo: no vincular a
retribución y no cascadear al individuo.

**El coste de la reorganización.** Rara vez entra en el caso de negocio y es sustancial:
pérdida de productividad durante el periodo de transición, destrucción de redes informales de
coordinación, rotación voluntaria de personas cuya posición relativa empeora. **Pregunta de
discusión:** si el coste de reorganizar es alto y el beneficio tarda entre seis y doce meses en
aparecer, ¿cuál es la frecuencia óptima de reorganización? ¿Y qué dice sobre las empresas que
reorganizan anualmente —que están optimizando, o que están evitando decidir otra cosa?

### [+ Dirección]

**Cuenta las fronteras de tu iniciativa principal.** No estimes: cuenta. Coge la iniciativa más
importante de tu plan y lista los equipos que tienen que actuar, incluidos los que solo
aprueban. Cuenta cuántos jefes distintos con presupuesto propio hay en esa lista. El número que
salga explica el ritmo de tu plan mejor que cualquier informe de seguimiento.

**Averigua quién resuelve los conflictos.** Para cada par de equipos que tenga que coordinarse,
pregunta —a ellos, no a sus jefes— quién decide cuando discrepan sobre prioridad. Si la
respuesta más frecuente eres tú, has encontrado a la vez por qué el plan va lento y por qué tu
agenda está llena de cosas que no deberían llegarte.

**Mide el tiempo de espera.** Coge el último cambio visible para el cliente que hayáis
entregado y reconstruye su cronología: fecha de aprobación, fechas en que cada equipo trabajó
en él, fecha de salida. Separa tiempo de trabajo de tiempo de espera. La proporción entre los
dos es el diagnóstico, y en la mayoría de las organizaciones sorprende a la dirección y no
sorprende en absoluto a los equipos.

**Mira el orden del día de tus últimos seis comités.** Clasifica cada punto en «decidir algo
que solo el comité puede decidir» o «desbloquear algo que se ha atascado entre dos áreas». El
porcentaje del segundo tipo es tu factura mensual por una estructura mal diseñada.

**Y una advertencia, más que una pregunta.** Si al terminar este capítulo tu impulso es
reorganizar, espera dos semanas. La reorganización es la intervención más visible, más cara y
más fácil de justificar, y también la que más a menudo se hace para no hacer las otras tres
—nombrar a alguien con autoridad real, reducir el alcance del plan, o resolver el conflicto de
prioridades que llevas seis meses evitando—. Comprueba primero si alguna de esas tres resuelve
el problema, porque las tres son más baratas.

---

## Ejercicio

**Entregable E8 del proyecto integrador.**

Para la empresa asignada a tu equipo y para la iniciativa principal del plan que propusiste en
E5 y E7:

1. Construye el **mapa de dependencias** completo: equipos o áreas que deben actuar, fronteras
   organizativas cruzadas, quién resuelve cada conflicto potencial y qué decisiones requieren
   autorización externa. Con información pública tendrás que estimar: **declara las
   estimaciones**.
2. Calcula la métrica de salida: **número de fronteras cruzadas**.
3. Aplica la regla. Si el resultado es superior a cuatro, elige y argumenta **una** de las tres
   salidas legítimas: cambiar la estructura, reducir el alcance del plan, o nombrar a alguien
   con autoridad real sobre todas las partes. Justifica por qué esa y no las otras dos.
4. Si tu propuesta es cambiar la estructura, **cuantifica el coste**: qué se pierde, cuánto dura
   el bache y qué harías para que la organización no revierta el cambio a los tres meses.
5. Comprueba la coherencia con E5: si tu plan estratégico exige algo que la estructura actual no
   puede producir y tu documento no lo menciona, corrígelo ahora.

*Extensión:* 3 páginas más el mapa. *Se evalúa con la rúbrica R1*, con peso especial en el
realismo de ejecución y en el reconocimiento explícito de los costes del cambio propuesto.

## Para seguir

- **Conway, *How Do Committees Invent?* (1968).** Ocho páginas, se lee en un café y sigue
  siendo la mejor inversión de tiempo de esta lista.
- **Skelton y Pais, *Team Topologies*.** El desarrollo práctico de todo esto. Es también la base
  del capítulo 10, así que léelo ahora y te sirve dos veces.
- **Brooks, *The Mythical Man-Month* (1975).** Por qué añadir gente a un proyecto retrasado lo
  retrasa más. Escrito hace cincuenta años sobre desarrollo de software y aplicable
  íntegramente a cualquier trabajo con dependencias.
- **Doerr, *Measure What Matters*.** Léelo con espíritu crítico y con Locke y Latham al lado.
- **El orden del día de tus últimos seis comités.** La lectura más informativa de la lista, y la
  única que trata de tu empresa.
