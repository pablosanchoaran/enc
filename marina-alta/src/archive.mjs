/**
 * Archivo histórico: todo anuncio que se vende o desaparece de la web queda
 * guardado aquí para siempre, con la fecha en que se vio por última vez y la
 * foto que se capturó. El inventario vivo refleja el mercado de hoy; esto es
 * la memoria, y de aquí saldrán las comparaciones entre meses o años.
 */

/** Campos que se conservan. La descripción larga no aporta al histórico. */
function archiveEntry(listing, { reason, archivedOn }) {
  return {
    id: listing.id,
    source: listing.source,
    agency: listing.agency,
    url: listing.url,
    title: listing.title,
    municipality: listing.municipality,
    type: listing.type,
    price: listing.price,
    priceHistory: listing.priceHistory ?? [],
    beds: listing.beds ?? null,
    baths: listing.baths ?? null,
    builtM2: listing.builtM2 ?? null,
    plotM2: listing.plotM2 ?? null,
    pricePerM2: listing.pricePerM2 ?? null,
    photo: listing.photo ?? null,
    saleStatus: listing.saleStatus ?? 'available',
    firstSeen: listing.firstSeen,
    lastSeen: listing.lastSeen,
    archivedOn,
    reason,
  }
}

/**
 * Incorpora al archivo los anuncios retirados y los que han pasado a vendido.
 * Una entrada ya archivada se actualiza (por si cambia de reservado a vendido)
 * pero nunca se borra.
 *
 * @returns {{ entries: object[], added: number, updated: number }}
 */
export function updateArchive(previousEntries, { removals, listings, runAt }) {
  const byId = new Map(previousEntries.map((entry) => [entry.id, entry]))
  let added = 0
  let updated = 0

  const remember = (listing, reason) => {
    const existing = byId.get(listing.id)
    const entry = archiveEntry(listing, {
      reason,
      // La fecha de archivo se fija la primera vez y no se toca después.
      archivedOn: existing?.archivedOn ?? runAt,
    })
    if (existing) {
      // Nunca se pierde una foto ya guardada, aunque el anuncio deje de traerla.
      entry.photo = entry.photo ?? existing.photo
      updated += 1
    } else {
      added += 1
    }
    byId.set(listing.id, entry)
  }

  for (const listing of removals) remember(listing, 'retirado')
  for (const listing of listings) {
    if (listing.saleStatus === 'sold') remember(listing, 'vendido')
  }

  return { entries: [...byId.values()], added, updated }
}
