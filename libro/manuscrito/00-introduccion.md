# Introducción. Lo que todavía hay que decidir

> **La pregunta**
> Si la tecnología ejecuta cada vez más cosas por nosotros, ¿qué queda que sea
> irreductiblemente del que dirige?
>
> **La idea**
> Lo que se ha vuelto escaso no es la información ni la capacidad de ejecutar, sino el
> criterio: saber qué problema merece resolverse, qué apuesta merece capital, y qué
> decisión no se puede delegar.

---

## Dos escaseces que se invirtieron

La teoría clásica de la dirección de empresas se construyó sobre dos supuestos que hoy son
falsos.

El primero: **la información es cara**. Durante casi todo el siglo XX, saber qué estaba
pasando en la propia empresa era un proyecto. Un director de operaciones esperaba al cierre
mensual para conocer márgenes por producto. La estructura jerárquica de las organizaciones
—niveles de mando que agregan y filtran información hacia arriba— era, en buena medida,
una tecnología de compresión de datos construida con personas. Existía porque no había
otra forma de que el de arriba supiera lo que pasaba abajo.

El segundo: **ejecutar es lento y lineal**. Aumentar la capacidad de servicio significaba
contratar. Entrar en un mercado significaba abrir una oficina. Cambiar un precio
significaba reimprimir un catálogo. El coste marginal de hacer una cosa más era
sustancial, y por tanto la decisión de hacerla se tomaba con cuidado y una sola vez.

Los dos supuestos han caído. Hoy la información sobre el negocio es abundante hasta el
punto de resultar ruidosa: el problema del directivo no es conseguir el dato, sino decidir
cuál de los cuatrocientos indicadores del panel significa algo. Y la ejecución es, en una
proporción creciente, programable: un cambio de precio es un despliegue, entrar en un
mercado nuevo puede ser una configuración, y atender a diez mil clientes más puede no
requerir contratar a nadie.

Cuando se invierten las dos escaseces sobre las que se construyó una disciplina, la
disciplina no desaparece: **se desplaza**. Y se desplaza hacia lo que sigue siendo escaso.

## Lo que sigue siendo escaso

Tres cosas, y las tres son el objeto de este libro.

**Saber qué problema merece resolverse.** La abundancia de datos y la facilidad de
ejecución han abaratado tanto el «cómo» que el cuello de botella se ha mudado por completo
al «qué». Una organización moderna puede construir casi cualquier cosa; lo que no puede es
construirlo todo. La mayoría de los fracasos que he visto de cerca no fueron fracasos de
ejecución. Fueron equipos excelentes construyendo, con enorme competencia, algo que no
había que construir.

**Saber qué apuesta merece capital.** Cuando ejecutar era caro y lento, la estrategia
consistía en elegir bien una vez. Cuando ejecutar es barato y rápido, la estrategia
consiste en gestionar una cartera de apuestas con horizontes distintos, sabiendo que la
mayoría no saldrá. Eso es un oficio distinto: se parece más a gestionar opciones que a
dibujar un plan a cinco años. Requiere decidir de antemano cuánto se está dispuesto a
perder, y —lo más difícil— matar lo que no funciona sin castigar a quien lo intentó.

**Saber qué no se puede delegar.** Este es el punto en el que la tecnología se ha vuelto
incómoda. Un modelo puede ya redactar el informe, priorizar la lista, proponer el precio y
recomendar el despido. La pregunta de qué decisiones se ceden a una máquina —y quién
responde cuando la máquina se equivoca— ha dejado de ser filosófica y se ha convertido en
una cuestión operativa que aparece en los comités de dirección de cualquier empresa
mediana. El capítulo 15 se dedica entero a ella, pero la sombra recorre todo el libro.

Llamo **criterio** a la capacidad de responder esas tres preguntas bien y a tiempo. No es
carisma, no es visión y no es dominio técnico. Es una habilidad, y como toda habilidad se
puede entrenar. Eso es lo que este libro intenta hacer.

## Por qué no es un libro de tecnología

Conviene decirlo pronto: aquí no se aprende a programar, ni a diseñar una arquitectura de
datos, ni a evaluar un modelo de lenguaje. Hay libros excelentes para eso y este no compite
con ellos.

Lo que sí se aprende es **lo que un directivo necesita entender de la tecnología para no
tomar malas decisiones**. Esa frontera existe y es más precisa de lo que parece. Un
director general no necesita saber qué es una base de datos vectorial; sí necesita entender
por qué una decisión de arquitectura tomada hoy va a determinar durante cinco años a qué
velocidad puede lanzar productos. No necesita saber escribir *tests*; sí necesita entender
por qué un equipo que no los escribe le va a costar más caro dentro de dieciocho meses.

El capítulo 4 traza esa frontera de forma explícita y la convierte en un temario mínimo. Es
el capítulo que más lectores técnicos van a discutir y el que más lectores no técnicos van
a agradecer.

## Cómo usar este libro

**Si lo lees para tu trabajo.** Cada capítulo entrega un artefacto —un lienzo, una
plantilla de decisión, un checklist— pensado para usarse en una reunión real, no para
admirarse. Léelo con un caso propio en la cabeza y rellena la herramienta con datos de tu
organización, aunque sean malos. Una herramienta rellenada con datos imperfectos enseña más
que una leída con datos perfectos. Las secciones marcadas `[+ Dirección]` están escritas
directamente para ti y contienen las preguntas incómodas.

**Si lo lees para una asignatura.** El cuerpo de cada capítulo es autocontenido y no
presupone experiencia laboral. El material docente completo —guía, sesiones, rúbricas y un
proyecto integrador de curso— vive junto al manuscrito y está abierto: cualquier docente
puede tomarlo, adaptarlo e impartirlo. Las secciones `[+ Máster]` son las que convierten el
mismo capítulo en material de posgrado, porque es ahí donde el marco se cuestiona en lugar
de aplicarse.

**Si lo enseñas.** El libro está construido para desencadenar en una asignatura de 6 ECTS:
dieciséis capítulos, quince sesiones, un entregable por sesión que se acumula en un plan
estratégico-tecnológico defendible ante un tribunal que hace de comité de dirección. No
hace falta seguir ese diseño, pero está probado y viene con rúbricas.

## Una advertencia sobre los casos

Este libro usa tres tipos de casos y los etiqueta siempre. Los `[Caso público]` se apoyan
en hechos verificables con fuente. Los `[Caso anonimizado]` son organizaciones reales cuyos
datos he alterado en escala pero no en proporción, con permiso. Y los `[Caso compuesto]`
están construidos a partir de patrones que he visto repetirse en varias organizaciones
distintas, y se declaran como lo que son.

Insisto en esto porque la literatura de management está llena de historias demasiado
redondas: empresas cuyo éxito se explica *a posteriori* por la única variable que el autor
quería defender. Un caso construido no es un defecto si se dice que está construido; un
caso construido que se presenta como real sí lo es. Aquí se dice siempre.

## El recorrido

Cuatro partes que responden, en orden, a las cuatro preguntas que uno se hace al sentarse
en una silla con responsabilidad:

**¿Dónde estoy?** (Parte I) Qué ha cambiado realmente en la naturaleza de la decisión, dónde
se crea y se captura valor en un negocio digitalizado, y cuál es la alfabetización mínima
que ya no es opcional.

**¿Hacia dónde voy?** (Parte II) Cómo se plantea bien un problema estratégico, en qué
consiste hoy una ventaja competitiva defendible, cómo se construye una cartera de apuestas
y cómo se convierte un plan en un sistema que se ejecuta solo.

**¿Con quién?** (Parte III) Cómo se lidera a gente que sabe más que tú de su oficio, cómo
se diseñan equipos que entregan, cómo se decide cuando no hay acuerdo y cómo se consigue
que un cambio ocurra de verdad y no solo en el anuncio.

**¿Cómo sé que funciona?** (Parte IV) Cómo se gobierna la inversión en tecnología, cómo se
mide sin engañarse, qué se le delega a una máquina y qué no, y cómo se entrena el criterio
a lo largo de una carrera.

---

Una última cosa. Este libro sostiene que el criterio se entrena, y eso implica que se
entrena **equivocándose en un entorno donde equivocarse es barato**. Si eres estudiante,
ese entorno es la asignatura y el proyecto de curso: aprovéchalo, porque no volverá a ser
tan barato. Si diriges, ese entorno lo tienes que construir tú, y el capítulo 7 va
precisamente de cuánto debe costar.
