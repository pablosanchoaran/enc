/**
 * La misma vivienda se anuncia a la vez en varias agencias. En la comarca hay
 * una MLS local y las fichas comparten referencia por debajo: la casa de siete
 * dormitorios de El Verger sale cinco veces en el portal con las referencias
 * `0-CS-222`, `0-CS-222`, `RSM 222`... cada agencia le antepone su código.
 *
 * Esto agrupa las repeticiones **solo para enseñarlas**. El inventario guarda
 * todas las fichas: ahí está el histórico de precios de cada una y de ahí
 * salen las altas y las bajas, así que colapsarlo estropearía el seguimiento.
 *
 * Dos anuncios son el mismo inmueble cuando coinciden municipio, dormitorios,
 * superficie construida y precio. **El precio entra en la identidad a
 * propósito**: si otra agencia tiene la misma casa más barata, esa ficha no se
 * colapsa y se sigue viendo, que es justo lo que interesa mirar.
 */

/** Margen de superficie: las agencias redondean distinto la misma casa. */
const AREA_TOLERANCE_M2 = 2
const AREA_TOLERANCE_PCT = 0.03
/**
 * Margen de precio, ajustado corto a propósito: solo tiene que absorber el
 * "199.999 en vez de 200.000" y redondeos parecidos. Con un margen más ancho
 * una rebaja pequeña de otra agencia quedaría escondida dentro del grupo, que
 * es justo lo que se quiere poder ver.
 */
const PRICE_TOLERANCE_PCT = 0.005

/**
 * La superficie con la que se compara: la construida en una vivienda y la del
 * terreno en una parcela, que no tiene otra. Devuelve null cuando no hay dato,
 * y entonces la ficha no se agrupa con nada.
 */
function comparableArea(item) {
  return item.type === 'plot' ? item.plotM2 : item.builtM2
}

function sameProperty(a, b) {
  const areaA = comparableArea(a)
  const areaB = comparableArea(b)
  const areaGap = Math.abs(areaA - areaB)
  const areaLimit = Math.max(AREA_TOLERANCE_M2, Math.min(areaA, areaB) * AREA_TOLERANCE_PCT)
  if (areaGap > areaLimit) return false

  const priceGap = Math.abs(a.price - b.price)
  return priceGap <= Math.min(a.price, b.price) * PRICE_TOLERANCE_PCT
}

/**
 * De un grupo de fichas iguales se enseña una sola. Se prefiere la de la
 * agencia directa sobre la del portal —lleva a quien de verdad vende la casa—
 * y, entre iguales, la que tenga foto y la que se vio antes, para que la
 * tarjeta no baile de un día para otro.
 */
function pickRepresentative(group) {
  return [...group].sort((a, b) => {
    const portal = Number(a.source === 'thinkspain') - Number(b.source === 'thinkspain')
    if (portal !== 0) return portal
    const photo = Number(Boolean(b.photo?.thumb)) - Number(Boolean(a.photo?.thumb))
    if (photo !== 0) return photo
    return (a.firstSeen ?? '').localeCompare(b.firstSeen ?? '')
  })[0]
}

/**
 * @param {object[]} listings anuncios ya filtrados y ordenados como se vayan a
 *   mostrar; el orden de entrada se respeta en la salida.
 * @returns {object[]} un anuncio por vivienda, con `alsoAt` (las otras fichas
 *   de la misma vivienda) cuando había repeticiones.
 */
export function dedupeForDisplay(listings) {
  // Sin superficie no hay con qué comparar, y en una vivienda tampoco sin
  // dormitorios: esas fichas se dejan pasar tal cual antes que arriesgarse a
  // esconder una casa distinta. Una parcela no tiene dormitorios y se agrupa
  // por su terreno.
  const buckets = new Map()

  for (const item of listings) {
    if (comparableArea(item) == null) continue
    const isPlot = item.type === 'plot'
    if (!isPlot && item.beds == null) continue
    const key = `${item.municipality}|${isPlot ? 'parcela' : item.beds}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }

  const representative = new Map()
  const hidden = new Set()

  for (const bucket of buckets.values()) {
    // Se compara siempre contra el primero del grupo, nunca contra el último:
    // encadenando saltos del 1% se llegaría de 200.000 a 250.000 metiendo en
    // el mismo saco pisos que no tienen nada que ver.
    const groups = []
    for (const item of bucket) {
      const group = groups.find((candidates) => sameProperty(candidates[0], item))
      if (group) group.push(item)
      else groups.push([item])
    }

    for (const group of groups) {
      const keeper = group.length === 1 ? group[0] : pickRepresentative(group)
      for (const item of group) if (item !== keeper) hidden.add(item)
      representative.set(
        keeper,
        group.length === 1
          ? keeper
          : {
              ...keeper,
              alsoAt: group
                .filter((item) => item !== keeper)
                .map((item) => ({ agency: item.agency, url: item.url, price: item.price })),
            },
      )
    }
  }

  // Se devuelve en el mismo orden en que llegó, con las repetidas fuera. Lo
  // que no se pudo comparar pasa tal cual, porque no está en `representative`.
  return listings
    .filter((item) => !hidden.has(item))
    .map((item) => representative.get(item) ?? item)
}
