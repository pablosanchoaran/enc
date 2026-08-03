/**
 * Compara lo recogido hoy con el inventario acumulado y decide qué es novedad:
 * altas, cambios de precio y anuncios retirados.
 */

/** Un anuncio se da por retirado tras no verse en 3 ejecuciones seguidas. */
const MISSING_RUNS_BEFORE_REMOVED = 3

export function diffInventory(previousList, currentList, today) {
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
      merged.priceHistory = [...merged.priceHistory, { date: today, price: fresh.price }]
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
