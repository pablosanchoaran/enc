/**
 * Migración de una sola vez: reasigna la identidad de los anuncios de las
 * fuentes Sooprema a la referencia del slug y funde las copias que había por
 * idioma.
 *
 * Hasta el 31/08 la identidad salía del slug entero, que va traducido, así que
 * la misma casa entraba una vez por idioma —107 de las 108 de Bindley— y un
 * cambio de rutas en la web mataba las URLs viejas y las convertía en falsas
 * retiradas. Sin esta pasada, arreglar la identidad haría que todo ese
 * inventario apareciera de golpe como altas y bajas.
 *
 *   node scripts/migrate-refs.mjs [--dry-run]
 */

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { referenceFromSlug } from '../src/adapters/sooprema.mjs'
import { listingId } from '../src/normalize.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INVENTORY = join(ROOT, 'data/listings.json')

const catalogo = JSON.parse(await readFile(join(ROOT, 'sources/agencies.json'), 'utf8'))
const SOOPREMA = new Set(
  (catalogo.sources ?? catalogo)
    .filter((source) => source.adapter === 'sooprema')
    .map((source) => source.id),
)

/** De dos copias de la misma casa se conserva la que más historia tiene. */
function merge(a, b) {
  const [viejo] = (a.firstSeen ?? '') <= (b.firstSeen ?? '') ? [a, b] : [b, a]
  const historia = (a.priceHistory ?? []).length >= (b.priceHistory ?? []).length ? a : b
  // Gana la URL vista más recientemente: es la que la web sirve hoy.
  const vigente = (a.lastSeen ?? '') >= (b.lastSeen ?? '') ? a : b
  return {
    ...vigente,
    firstSeen: viejo.firstSeen,
    priceHistory: historia.priceHistory ?? [],
    missingRuns: Math.min(a.missingRuns ?? 0, b.missingRuns ?? 0),
    status: a.status === 'active' || b.status === 'active' ? 'active' : vigente.status,
  }
}

const inventory = JSON.parse(await readFile(INVENTORY, 'utf8'))
const porId = new Map()
let reasignados = 0
let fundidos = 0

for (const listing of inventory.listings) {
  let item = listing
  if (SOOPREMA.has(listing.source)) {
    const ref = referenceFromSlug(listing.url)
    if (ref) {
      const id = listingId(listing.source, ref)
      if (id !== listing.id) reasignados += 1
      item = { ...listing, id }
    }
  }
  const existing = porId.get(item.id)
  if (existing) {
    porId.set(item.id, merge(existing, item))
    fundidos += 1
  } else {
    porId.set(item.id, item)
  }
}

console.log(`anuncios: ${inventory.listings.length} → ${porId.size}`)
console.log(`  identidades reasignadas: ${reasignados}`)
console.log(`  copias fundidas: ${fundidos}`)

if (process.argv.includes('--dry-run')) {
  console.log('(--dry-run: no se ha escrito nada)')
} else {
  await writeFile(
    INVENTORY,
    `${JSON.stringify({ ...inventory, listings: [...porId.values()] }, null, 2)}\n`,
  )
  console.log(`escrito ${INVENTORY}`)
}
