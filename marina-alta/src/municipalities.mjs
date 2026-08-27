/**
 * Municipios de la Marina Alta cubiertos por el extractor: franja costera
 * e interior cercano. Cada entrada declara el nombre canónico y todas las
 * variantes con las que las agencias lo escriben (valenciano, castellano,
 * inglés, pedanías y grafías sin acentos).
 */

export const MUNICIPALITIES = [
  { name: 'Dénia', aliases: ['denia', 'dénia', 'la xara', 'jesus pobre', 'jesús pobre', 'las marinas', 'les marines', 'las rotas', 'les rotes', 'montgo', 'montgó'] },
  { name: 'Xàbia / Jávea', aliases: ['javea', 'jávea', 'xabia', 'xàbia', 'el arenal javea', 'arenal javea', 'balcon al mar', 'balcón al mar', 'cabo de la nao', 'granadella', 'ambolo', 'ambolò', 'portichol', 'portitxol', 'la lluca', 'toscamar', 'cansalades'] },
  { name: 'Calp / Calpe', aliases: ['calpe', 'calp', 'ifach', 'ifac', 'la fossa', 'las salinas calpe', 'maryvilla'] },
  { name: 'Teulada-Moraira', aliases: ['moraira', 'teulada', 'teulada-moraira', 'el portet', 'portet', 'benimeit', 'moravit', 'pla del mar', 'san jaime moraira', 'cap blanc'] },
  { name: 'El Poble Nou de Benitatxell', aliases: ['benitachell', 'benitatxell', 'poble nou de benitatxell', 'el poble nou de benitatxell', 'cumbre del sol', 'cumbres del sol', 'la cumbre del sol', 'moraira alto'] },
  { name: 'Benissa', aliases: ['benissa', 'benisa', 'benissa costa', 'la fustera', 'fustera', 'advocat', "l'advocat", 'baladrar', 'canuta', 'la canuta'] },
  { name: 'Els Poblets', aliases: ['els poblets', 'el poblets', 'poblets', 'els poblets denia'] },
  { name: 'El Verger', aliases: ['el verger', 'verger', 'vergel'] },
  { name: 'Pedreguer', aliases: ['pedreguer', 'la sella', 'monte solana'] },
  { name: 'Ondara', aliases: ['ondara'] },
  // "gata" a secas no vale: hay un Cabo de Gata en Almería.
  { name: 'Gata de Gorgos', aliases: ['gata de gorgos', 'gata gorgos'] },
  { name: 'Beniarbeig', aliases: ['beniarbeig'] },
  { name: 'Xaló / Jalón', aliases: ['jalon', 'jalón', 'xalo', 'xaló', 'valle del pop', 'vall del pop'] },
  { name: 'Llíber', aliases: ['lliber', 'llíber'] },
  { name: 'Alcalalí', aliases: ['alcalali', 'alcalalí', 'llosa de camacho', 'llosa de camatxo', 'la llosa de camacho'] },
  { name: 'Orba', aliases: ['orba'] },
  { name: 'Pego', aliases: ['pego', 'monte pego', 'pego y su marjal'] },
  { name: 'Benidoleig', aliases: ['benidoleig'] },
  { name: 'Sanet y Negrals', aliases: ['sanet y negrals', 'sanet i negrals', 'sanet'] },
]

/**
 * Sitios que vetan la detección cuando aparecen antes que cualquier municipio
 * nuestro. Son de dos clases:
 *
 *  · Pueblos vecinos que no están en el ámbito elegido. Un anuncio titulado
 *    "Encantador adosado en Parcent, Valle de Jalón" acababa en Xaló porque
 *    "jalón" salía después; y "Town Houses - Castell de Castells" y varios de
 *    Murla y Benigembla, en municipios que no les tocan.
 *  · Homónimos de otras provincias. "Solar en Jalón de Cameros" es La Rioja, y
 *    entró en el inventario como si fuera Xaló. Es el tercer caso de este tipo
 *    tras el Cabo de Gata y Las Marinas de Vera.
 *
 * Van en el mismo índice que los alias, con nombre nulo: gana igualmente el
 * que aparece antes, y a igualdad de posición el más largo — que es lo que
 * hace que "jalon de cameros" gane a "jalon".
 */
const EXCLUDED_PLACES = [
  // Marina Alta, fuera del ámbito elegido.
  'parcent',
  'murla',
  'benigembla',
  'benichembla',
  'castell de castells',
  'tormos',
  'benimeli',
  'vall de laguar',
  'rafol d almunia',
  // Homónimos de otra provincia.
  'jalon de cameros',
]

/** Quita acentos, signos y colapsa espacios para poder comparar textos. */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Los alias más largos se prueban primero: "moraira alto" debe ganar a "moraira".
const INDEX = [
  ...MUNICIPALITIES.flatMap(({ name, aliases }) => aliases.map((alias) => ({ name, alias: fold(alias) }))),
  ...EXCLUDED_PLACES.map((place) => ({ name: null, alias: fold(place) })),
].sort((a, b) => b.alias.length - a.alias.length)

/**
 * Busca un municipio de la comarca dentro de un texto libre (título,
 * migas de pan, dirección). Devuelve el nombre canónico o null.
 */
export function detectMunicipality(...texts) {
  const haystack = fold(texts.filter(Boolean).join(' | '))
  if (!haystack) return null

  // Gana el que aparece antes en el texto, no el alias más largo. Los textos
  // llegan del más fiable al menos fiable (ciudad de la ficha, título,
  // descripción, slug), así que "Manor House for Sale in Pego" es Pego aunque
  // más abajo la descripción hable de Moraira. A igualdad de posición manda el
  // alias más largo, que es lo que hace que "moraira alto" gane a "moraira".
  let best = null
  for (const { name, alias } of INDEX) {
    const match = haystack.match(new RegExp(`(^| )(${alias})( |$)`))
    if (!match) continue
    const position = match.index + match[1].length
    if (!best || position < best.position) best = { name, position }
  }
  // Un veto que gane deja el anuncio fuera: no es de ningún municipio nuestro.
  return best?.name ?? null
}

/**
 * Variante para los slugs de zona, donde el municipio va al final:
 * `devessa-monte-pego-denia` es Dénia, no Pego. Gana la coincidencia más a la
 * derecha y, a igualdad de posición, la más específica.
 */
export function detectMunicipalityFromSlug(slug, { anchored = false } = {}) {
  const haystack = fold(slug)
  if (!haystack) return null

  let best = null
  for (const { name, alias } of INDEX) {
    // Con `anchored`, el municipio tiene que cerrar el slug: "las-marinas-...-vera"
    // es Vera (Almería), no Dénia, por mucho que también tenga unas Marinas.
    const match = haystack.match(new RegExp(`(^| )(${alias})${anchored ? '$' : '( |$)'}`))
    if (!match) continue
    const position = match.index + match[1].length
    if (!best || position > best.position) best = { name, position }
  }
  return best?.name ?? null
}

export const MUNICIPALITY_NAMES = MUNICIPALITIES.map((m) => m.name)
