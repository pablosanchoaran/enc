/**
 * Antes de dar un anuncio por retirado, se llama a su propia ficha.
 *
 * Es la comprobación que venía haciéndose a mano cada día, y que ha cazado ya
 * varias bajas falsas: fichas que ocultaron el precio, URLs que cambiaron de
 * ruta, copias con otra identidad y una ficha que el barrido se saltó siete
 * pasadas seguidas. No sale cara: se pregunta solo por lo que está a punto de
 * darse de baja, unas decenas por pasada, no por el inventario entero.
 *
 * La duda se resuelve siempre a favor de conservar. Equivocarse diciendo que
 * un anuncio sigue a la venta se corrige solo en cuanto su ficha deje de
 * responder; equivocarse dándolo de baja lo saca del informe y no vuelve.
 */

/** Lo que se concluye de una ficha que sí responde. */
function leerFicha(adapter, html, url) {
  // Cada adaptador sabe leer su propia ficha. ThinkSpain trae el precio en un
  // atributo con datos; el resto, en el maquetado.
  if (typeof adapter?.readAnalytics === 'function') {
    const datos = adapter.readAnalytics(html)
    if (datos?.price) return { price: datos.price, forSale: datos.offer !== 'for-rent' }
  }
  if (typeof adapter?.parsePropertyPage === 'function') {
    const item = adapter.parsePropertyPage(html, url)
    if (item?.forRent) return { price: null, forSale: false }
    if (item?.priceOnRequest) return { price: null, forSale: true }
    if (item?.price) return { price: item.price, forSale: true }
  }
  return { price: null, forSale: true }
}

/**
 * @param {object[]} removals Lo que el diff propone dar de baja.
 * @param {(origin: string) => Promise<{get: Function}>} fetcherFor Un fetcher
 *   por dominio, para respetar el crawl-delay de cada web.
 * @param {object} options
 * @returns {Promise<{confirmed: object[], alive: object[]}>}
 */
export async function confirmRemovals(
  removals,
  fetcherFor,
  { adapters = {}, sourceById = {}, maxPrice = Infinity, log = () => {} } = {},
) {
  const confirmed = []
  const alive = []

  for (const item of removals) {
    const source = sourceById[item.source]
    let origin
    try {
      origin = new URL(item.url).origin
    } catch {
      confirmed.push(item)
      continue
    }

    const fetcher = await fetcherFor(origin)
    const html = fetcher ? await fetcher.get(item.url) : null

    // No responde: se ha retirado de verdad. Es el caso mayoritario.
    if (!html) {
      confirmed.push(item)
      continue
    }

    const { price, forSale } = leerFicha(adapters[source?.adapter], html, item.url)

    // Ha dejado de estar en venta, o se ha ido por encima del techo: sale del
    // inventario con razón, aunque su página siga en pie.
    if (!forSale || (price !== null && price > maxPrice)) {
      confirmed.push({ ...item, ...(price !== null ? { price } : {}) })
      continue
    }

    // Responde y sigue a la venta: la baja era nuestra.
    alive.push(price !== null && price !== item.price ? { ...item, price } : item)
  }

  if (alive.length > 0) {
    log(
      `  ${alive.length} de ${removals.length} bajas no eran bajas: su ficha sigue respondiendo`,
    )
  }
  return { confirmed, alive }
}
