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

  const additions = []
  const priceChanges = []
  const removals = []
  const inventory = []

  for (const [id, fresh] of current) {
    const old = previous.get(id)

    if (!old) {
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

  for (const [id, old] of previous) {
    if (current.has(id)) continue

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
      if (old.status !== 'removed') removals.push({ ...old, removedOn: today })
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
