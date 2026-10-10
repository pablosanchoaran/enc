/**
 * Compara lo recogido hoy con el inventario acumulado y decide qué es novedad:
 * altas, cambios de precio y anuncios retirados.
 */

/**
 * Un anuncio se da por retirado tras no verse en 7 ejecuciones seguidas, casi
 * una semana. Con tres bastaba para inventar bajas: los listados de ThinkSpain
 * rotan qué anuncios enseñan, así que faltar un par de días no significa nada.
 */
const MISSING_RUNS_BEFORE_REMOVED = 7

/**
 * @param {Set<string>|null} checkedUrls Direcciones que esta pasada ha
 *   comprobado de verdad. Un anuncio solo puede empezar a contar como
 *   desaparecido si se ha mirado su ficha: hay webs cuyo listado sirve un
 *   subconjunto rotatorio, y no salir hoy no dice nada. `null` significa que la
 *   fuente da un catálogo completo y que faltar sí es señal.
 */
export function diffInventory(previousList, currentList, today, { checkedUrls = null } = {}) {
  const previous = new Map(previousList.map((item) => [item.id, item]))
  const current = new Map(currentList.map((item) => [item.id, item]))

  // Direcciones que ya estaban en el inventario. Sirven para no confundir un
  // cambio de identidad con una novedad del mercado: cuando una agencia
  // reescribe la referencia de la que sale el identificador, la misma casa
  // vuelve a entrar con otro id, y el 10/10 las diecinueve de Grupo García
  // salieron como altas del día. Un anuncio que ya conocíamos por su dirección
  // no es una alta por mucho que haya cambiado de nombre.
  const conocidasPorUrl = new Set(previousList.map((item) => item.url))
  /** Entradas viejas a las que una identidad nueva ha relevado. */
  const relevadas = new Set()

  const additions = []
  const priceChanges = []
  const removals = []
  const inventory = []

  for (const [id, fresh] of current) {
    const old = previous.get(id)

    if (!old) {
      // Lo nuevo de verdad va al parte del día; lo que solo ha cambiado de
      // identidad entra en el inventario sin anunciarse, y hereda la fecha en
      // que se vio por primera vez para no parecer recién publicado.
      const antigua = conocidasPorUrl.has(fresh.url)
        ? previousList.find((item) => item.url === fresh.url)
        : null
      if (antigua) {
        inventory.push({
          ...fresh,
          firstSeen: antigua.firstSeen ?? fresh.firstSeen,
          priceHistory: antigua.priceHistory ?? fresh.priceHistory ?? [],
        })
        // La entrada vieja queda relevada: se va sin dar de baja nada, porque
        // el anuncio sigue ahí con la identidad nueva. Si se quedara, el
        // inventario contaría dos veces la misma casa para siempre.
        relevadas.add(antigua.id)
        continue
      }
      additions.push(fresh)
      inventory.push(fresh)
      continue
    }

    const merged = {
      ...old,
      ...fresh,
      firstSeen: old.firstSeen,
      lastSeen: today,
      missingRuns: 0,
      status: 'active',
      priceHistory: old.priceHistory ?? [],
    }

    if (fresh.price !== old.price) {
      const delta = fresh.price - old.price
      const last = merged.priceHistory.at(-1)
      if (last?.price !== fresh.price) {
        merged.priceHistory = [...merged.priceHistory, { date: today, price: fresh.price }]
      }
      priceChanges.push({
        ...merged,
        previousPrice: old.price,
        delta,
        deltaPct: Math.round((delta / old.price) * 1000) / 10,
        direction: delta < 0 ? 'drop' : 'rise',
      })
    }

    inventory.push(merged)
  }

  // Direcciones que esta pasada sí ha visto, para no dar por retirado un
  // anuncio que sigue ahí con otra identidad.
  const vivasPorUrl = new Set(currentList.map((item) => item.url))

  for (const [id, old] of previous) {
    if (current.has(id)) continue
    if (relevadas.has(id)) continue

    // Lo que no se ha llegado a mirar se queda como estaba: ni suma un fallo
    // ni se acerca a la baja. Si no, un presupuesto de refresco corto acabaría
    // retirando anuncios que siguen publicados.
    if (checkedUrls && !checkedUrls.has(old.url)) {
      inventory.push(old)
      continue
    }

    const missingRuns = (old.missingRuns ?? 0) + 1
    if (missingRuns >= MISSING_RUNS_BEFORE_REMOVED) {
      // Se anota la baja una sola vez y deja de arrastrarse el inventario.
      //
      // Salvo que la misma dirección siga en el inventario con otra identidad:
      // entonces no se ha retirado nada, es una copia que se queda sin usar.
      // Pasa cuando una agencia reescribe la referencia de la que sale el
      // identificador —Grupo García lo hizo dos veces— y la misma parcela
      // acaba entrando varias veces. La copia vieja se va en silencio; decir
      // que el anuncio se ha retirado sería falso, y además aparecería a la vez
      // como retirado y a la venta.
      if (old.status !== 'removed' && !vivasPorUrl.has(old.url)) {
        removals.push({ ...old, removedOn: today })
      }
      continue
    }
    inventory.push({ ...old, missingRuns, status: 'stale' })
  }

  return {
    inventory,
    additions,
    priceChanges,
    priceDrops: priceChanges.filter((item) => item.direction === 'drop'),
    priceRises: priceChanges.filter((item) => item.direction === 'rise'),
    removals,
  }
}
