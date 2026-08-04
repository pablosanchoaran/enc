# 10. Diseñar equipos que entregan

> **La pregunta**
> ¿Por qué un equipo con buenos profesionales entrega poco?
>
> **La idea**
> Casi siempre es un problema de diseño, no de personas. Si el equipo carga con más dominios
> de los que cabe en su cabeza y necesita permiso de otros tres para terminar su trabajo, no
> hay talento que lo compense.

> **Estado:** esqueleto.

---

## El problema

Escena a construir: dos equipos de la misma empresa, con perfiles y presupuesto comparables.
Uno entrega cada dos semanas; el otro lleva cuatro meses con la misma entrega. La diferencia
no está en las personas: uno puede desplegar sin pedir permiso a nadie y el otro depende de
tres autorizaciones y de un equipo central saturado. La conclusión del capítulo es
incómoda para la cultura del talento: **el diseño domina sobre la calidad individual en la
mayoría de los rangos**.

## El marco

Base declarada: *Team Topologies* (Skelton y Pais), con adaptación a contextos donde no toda
la empresa es tecnología.

1. **Carga cognitiva como restricción de diseño.** Un equipo tiene un límite de dominios que
   puede sostener bien. Superarlo no produce un equipo lento: produce un equipo que deja de
   entender lo que mantiene. Cómo estimarla sin instrumental complicado: contar sistemas,
   contar interlocutores, contar tipos de petición.
2. **Cuatro tipos de equipo.** Alineado al flujo de valor (el tipo por defecto, el que
   entrega), habilitador, de subsistema complicado y de plataforma. Error habitual: llamar
   plataforma a un equipo que en realidad es una aduana.
3. **Tres modos de interacción.** Colaboración (cara, temporal, para descubrir), servicio
   (barata, permanente, para escalar) y facilitación (temporal, para transferir capacidad).
   La mayoría de las organizaciones tienen colaboración permanente, que es la combinación
   más cara posible.
4. **Autonomía operativa: la definición dura.** Un equipo es autónomo si puede poner algo
   delante del cliente sin pedir permiso. Todo lo demás es autonomía declarativa. Esta
   definición es deliberadamente incómoda y es la más útil del capítulo.
5. **Tamaño y duración.** Equipos pequeños, estables y con propiedad duradera de un dominio.
   Por qué reasignar personas entre proyectos destruye más valor del que se ve: lo que se
   pierde no es tiempo, es contexto acumulado, y no aparece en ninguna hoja de cálculo.

## La herramienta

**Lienzo de equipo** → `plantillas/10-lienzo-de-equipo.md`

Una página por equipo: misión en una frase · dominio del que es dueño · sistemas que
mantiene · con quién interacciona y en qué modo · **qué puede hacer sin pedir permiso** ·
principales dependencias · señales de sobrecarga.

Rellenar el lienzo de los cinco equipos principales y ponerlos en la misma pared suele
producir un diagnóstico inmediato: dos equipos comparten dominio, uno tiene siete y nadie es
dueño de lo que más se rompe.

## El caso

`[Caso anonimizado]` Reorganización de cuatro equipos funcionales en tres equipos de flujo,
más un equipo de plataforma real. Métricas antes y después, incluyendo el bache de tres
meses que siempre ocurre y que hay que presupuestar de antemano si no se quiere abortar el
cambio a mitad.

## Cómo se hace mal

- **Equipos por función.** *Síntoma:* entregar cualquier cosa requiere a los cinco.
- **Plataforma como aduana.** *Síntoma:* el equipo de plataforma aprueba en lugar de servir,
  y su cola de peticiones crece de forma monótona.
- **El equipo que lo hace todo.** *Síntoma:* la respuesta a «¿de qué es dueño este equipo?»
  dura más de treinta segundos.
- **Reasignar personas por proyecto.** *Síntoma:* cada trimestre cambia la composición y cada
  trimestre se empieza de cero.
- **Autonomía declarada.** *Síntoma:* el equipo es autónomo en la presentación y necesita
  tres firmas en la práctica.

## Checklist del directivo
*(pendiente)*

### [+ Máster]
Teoría de la carga cognitiva (Sweller) y la legitimidad de trasladarla del aprendizaje
individual al diseño organizativo —es una extensión útil pero no trivial, conviene señalarlo.
Diseño de trabajo y autonomía (Hackman y Oldham). Coordinación y coste de transacción
interno (Coase, Williamson) como fundamento económico de por qué las dependencias son caras.
Evidencia sobre estabilidad de equipos y rendimiento.

### [+ Dirección]
Haz la pregunta de la autonomía a tus equipos: *¿qué necesitáis pedir permiso para hacer?*
Después cuenta cuántos de esos permisos los concedes tú o alguien que te reporta. Ese número
es tu contribución personal al tiempo de entrega de la empresa. Reducirlo suele ser más
eficaz que cualquier contratación.

## Ejercicio
**E10:** rediseño de la estructura de equipos de la empresa del proyecto, con lienzo de cada
equipo propuesto y justificación del cambio en términos de dependencias eliminadas.

## Para seguir
Skelton y Pais, *Team Topologies* · Hackman, *Leading Teams* · Forsgren, Humble y Kim,
*Accelerate* (la parte de arquitectura y autonomía) · Brooks, *The Mythical Man-Month*
(1975, y sigue explicando por qué añadir gente a un proyecto tarde lo retrasa más).
