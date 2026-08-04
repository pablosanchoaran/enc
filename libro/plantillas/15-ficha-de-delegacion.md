# Ficha de delegación a un sistema automático

**Capítulo 15** · Entregable E15 · Una ficha **por decisión**, no por proyecto

Regla de gobierno: **no se aprueba ninguna iniciativa de IA sin una ficha por cada decisión
afectada**. La mayoría de las iniciativas se caen al intentar rellenar el primer campo. Eso
es un ahorro, no un fracaso.

---

## 1. La decisión

**¿Qué decisión concreta se cede?**
> ______________________________________________________________________

*Formulación válida:* «decidir qué reclamaciones de menos de 200 € se abonan sin revisión».
*Formulación inválida:* «usar IA en atención al cliente». Eso es una capacidad, no una
decisión.

**¿Quién la toma hoy?** ______   **¿Cuántas veces al día/mes?** ______
**¿Cuánto tiempo consume hoy?** ______

## 2. Modo

| Modo | Quién decide | Quién ejecuta | Cuándo es apropiado |
|---|---|---|---|
| ☐ **Asistencia** | Persona | Persona | Siempre que se empieza. Error caro, poco frecuente o difícil de detectar |
| ☐ **Automatización supervisada** | Sistema | Sistema, reversible por persona | Error tolerable y detectable a tiempo |
| ☐ **Automatización plena** | Sistema | Sistema | Error barato, frecuente, detectable en agregado |

**Modo elegido:** ______   **Por qué este y no el siguiente:** ______________________

> Se empieza siempre por asistencia y se **sube de modo con evidencia**, nunca con
> entusiasmo. La evidencia es la tasa de error real medida en producción, no la de la
> demostración del proveedor con sus propios datos.

## 3. Los cuatro ejes de delegabilidad

Los cuatro deben ser aceptables **a la vez**. Es una conjunción, no una media ponderada: un
solo eje inaceptable basta para no delegar.

### Eje 1 · Tolerancia del error

**¿Qué pasa exactamente cuando se equivoca?** ____________________________________
**Tasa de error aceptable:** ______ % *(con número; «baja» no es una respuesta)*
**¿Los errores se distribuyen de forma uniforme, o se concentran en algún grupo?**
> ______________________________________________________________________
*(Un 3 % de error repartido al azar y un 3 % que cae siempre sobre el mismo tipo de cliente
son riesgos completamente distintos.)*
**Coste del peor error imaginable:** ______ €

### Eje 2 · Detectabilidad

**¿Cómo nos enteramos de que se ha equivocado?** _________________________________
**¿En cuánto tiempo?** ______
**¿Depende de que alguien se queje?** Sí / No
*(Si depende de la queja, solo detectarás los errores de quien tiene voz. Los demás
existirán igual.)*
**¿Quién mira la tasa de error, con qué frecuencia y en qué informe?** ____________

### Eje 3 · Reversibilidad

**¿Se puede deshacer una decisión concreta ya tomada?** Sí / No
**Coste y plazo de deshacerla:** ______
**¿Se puede apagar el sistema entero y volver al proceso anterior?** Sí / No
**¿Cuánto tardaríamos y quién sabe hacerlo?** ______
*(Si nadie recuerda cómo se hacía antes, no hay vuelta atrás. Documentarlo forma parte del
despliegue, no es opcional.)*

### Eje 4 · Atribución

| Ante quién | Quién responde |
|---|---|
| El cliente afectado | |
| El regulador | |
| El consejo / la prensa | |

**Si mañana este sistema perjudica a un cliente y sale publicado, ¿quién da la cara y con
qué explicación?**
> ______________________________________________________________________

> Si nadie sabe responder a esto, esa es la tarea de esta semana y no el despliegue.

## 4. La supervisión, si la hay

**¿Hay una persona revisando?** Sí / No
**¿Cuántos casos por hora?** ______
**¿Tiene contexto suficiente para discrepar?** Sí / No
**¿Qué le pasa si aprueba un error?** ______
**¿Y si rechaza demasiadas propuestas del sistema?** ______

> **Prueba del humano decorativo:** si el revisor aprueba más de un caso por minuto, o si
> discrepar le cuesta y aprobar no, la supervisión es formal y no funcional. Estás en
> automatización plena con un responsable designado para cuando falle, que es la peor
> combinación posible: ni la eficiencia de automatizar ni la protección de supervisar.
> Reconócelo y elige uno de los dos modos de verdad.

## 5. Evidencia para cambiar de modo

**Subiríamos de modo si:** ______________________________________________________
**Bajaríamos de modo si:** ______________________________________________________
**Quién decide el cambio de modo:** ______   **Fecha de revisión:** ______

## 6. Ventaja

**¿Esta capacidad se compra por suscripción?** Sí / No
**Si es sí, ¿qué es lo nuestro que el competidor no puede contratar mañana?**
> ______________________________________________________________________
*(Dato propio · integración en el flujo real · relación con el cliente · velocidad con la que
aprendemos de los errores. Si no hay nada, esto es una mejora de coste. Puede estar
perfectamente bien; solo hay que no llamarlo estrategia.)*

---

## Veredicto

☐ **Delegable en el modo elegido** — los cuatro ejes son aceptables
☐ **Delegable solo en asistencia** — falla detectabilidad, reversibilidad o atribución
☐ **No delegable hoy** — falta: ______________________
☐ **No es una decisión** — es una capacidad buscando un problema. Volver al capítulo 5.
