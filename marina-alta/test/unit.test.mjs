import assert from 'node:assert/strict'
import test from 'node:test'

import * as cheerio from 'cheerio'

import { dedupeForDisplay } from '../src/dedupe.mjs'
import { diffInventory } from '../src/diff.mjs'
import * as listado from '../src/adapters/listado.mjs'
import * as sooprema from '../src/adapters/sooprema.mjs'
import {
  parsePropertyPage,
  preferOneLanguage,
  readIconFeatures,
  referenceFromSlug,
} from '../src/adapters/sooprema.mjs'
import { zonePages } from '../src/adapters/thinkspain.mjs'
import { isAntiBotChallenge } from '../src/fetcher.mjs'
import { crawlDelay, isAllowed, loadRobots } from '../src/robots.mjs'
import { normalize } from '../src/normalize.mjs'
import { renderReport } from '../src/report.mjs'
import {
  MUNICIPALITY_NAMES,
  detectMunicipality,
  detectMunicipalityFromSlug,
} from '../src/municipalities.mjs'
import {
  detectSaleStatus,
  detectType,
  parseArea,
  parsePrice,
  parseSitemap,
  readPrice,
} from '../src/parse.mjs'

test('parsePrice entiende los formatos que usan las agencias', () => {
  assert.equal(parsePrice('235.000 €'), 235000)
  assert.equal(parsePrice('1.300.000 €'), 1300000)
  assert.equal(parsePrice('Desde 449.500€'), 449500)
  assert.equal(parsePrice('1,300,000'), 1300000)
  assert.equal(parsePrice('395.000,50 €'), 395001)
  assert.equal(parsePrice('Consultar precio'), null)
  assert.equal(parsePrice('900 €/mes'), null, 'un alquiler no es un precio de venta')
})

test('parseArea distingue superficie de otros números', () => {
  assert.equal(parseArea('1.072 m²'), 1072)
  assert.equal(parseArea('180 m2'), 180)
  assert.equal(parseArea(''), null)
})

test('detectType clasifica por el texto del anuncio', () => {
  assert.equal(detectType('Villa in Moraira with pool'), 'villa')
  assert.equal(detectType('Parcela urbana en Els Poblets'), 'plot')
  assert.equal(detectType('Apartamento de 2 habitaciones'), 'apartment')
  assert.equal(detectType('Freehold Bar-Restaurant for Sale'), 'commercial')
})

test('manda el término que abre el anuncio, no el que aparezca después', () => {
  assert.equal(detectType('Ático con garaje en venta en Dénia'), 'penthouse', 'la tilde cuenta')
  assert.equal(detectType('Casa de 3 habitaciones con garaje'), 'house')
  assert.equal(detectType('Chalet para reformar con parcela de 800 m²'), 'villa')
  assert.equal(detectType('En venta dos locales comerciales en Pego'), 'commercial')
  assert.equal(detectType('Se vende plaza de garaje'), 'commercial')
})

test('el plural no se escribe con una "s" opcional pegada a la raíz', () => {
  // `locales?` significa "locale" más una "s", no "local" más "es": el bug
  // dejaba pasar locales comerciales y solares como si fueran vivienda.
  assert.equal(detectType('SE VENDE LOCAL EN DENIA'), 'commercial')
  assert.equal(detectType('Locales comerciales en Pego'), 'commercial')
  assert.equal(detectType('Almacén en Ondara'), 'commercial')
  assert.equal(detectType('Solar urbano en Gata de Gorgos'), 'plot')
  assert.equal(detectType('Solares en Benissa'), 'plot')
})

test('el estado comercial se lee de las etiquetas, no del texto suelto', () => {
  const sold = cheerio.load('<div><span class="tag">Vendido</span><p>Chalet en Calpe</p></div>')
  const footer = cheerio.load('<footer><p>Todos los derechos reservados Inmobiliaria X</p></footer>')
  const reserved = cheerio.load('<div class="tags-listado"><span>Reservado</span></div>')

  assert.equal(detectSaleStatus(sold), 'sold')
  assert.equal(detectSaleStatus(reserved), 'reserved')
  assert.equal(detectSaleStatus(footer), 'available', 'el pie de página no marca nada')
})

test('el geo-filtro acepta la comarca y rechaza el resto', () => {
  assert.equal(detectMunicipality('Villa en Moraira'), 'Teulada-Moraira')
  assert.equal(detectMunicipality('Cumbre del Sol, Benitachell'), 'El Poble Nou de Benitatxell')
  assert.equal(detectMunicipality('Chalet en Estepona en venta'), null)
  assert.equal(detectMunicipality('Piso en Valencia'), null)
  assert.equal(
    detectMunicipality('Finca en El Cabo de Gata, Almería'),
    null,
    'Cabo de Gata no es Gata de Gorgos',
  )
  assert.equal(detectMunicipality('Casa en Gata de Gorgos'), 'Gata de Gorgos')
})

test('un pueblo vecino que no está en el ámbito veta el anuncio', () => {
  // Sin esto, el municipio se lo llevaba cualquier alias que apareciera más
  // abajo: "Encantador adosado en Parcent, Valle de Jalón" acababa en Xaló, y
  // varios de Murla, Benigembla y Castell de Castells en municipios ajenos.
  assert.equal(detectMunicipality('Encantador adosado a la venta en Parcent, Valle de Jalón'), null)
  assert.equal(detectMunicipality('Town Houses - Castell de Castells - 229.000€'), null)
  assert.equal(detectMunicipality('Se vende casa de pueblo en Benigembla'), null)
  assert.equal(detectMunicipality('Plot en venta en Murla'), null)

  // Y el tercer homónimo de otra provincia, tras el Cabo de Gata y Las Marinas
  // de Vera: Jalón de Cameros está en La Rioja.
  assert.equal(detectMunicipality('Solar/Parcela en Jalón de Cameros en venta'), null)
  assert.equal(detectMunicipality('Se vende parcela urbana en Jalón'), 'Xaló / Jalón')

  // El veto no puede llevarse por delante una urbanización que sí es nuestra.
  assert.equal(detectMunicipality('Parcela en La Solana Garden, Alcalalí'), 'Alcalalí')
})

test('en un slug de zona manda el municipio del final', () => {
  assert.equal(detectMunicipalityFromSlug('devessa-monte-pego-denia'), 'Dénia')
  assert.equal(detectMunicipalityFromSlug('oltamar-cucarres-calpe-calp'), 'Calp / Calpe')
  assert.equal(detectMunicipalityFromSlug('orba'), 'Orba')
})

test('anclado al final, un barrio homónimo de otra provincia no cuela', () => {
  const anchored = { anchored: true }
  assert.equal(
    detectMunicipalityFromSlug('las-marinas-pueblo-laguna-vera', anchored),
    null,
    'Las Marinas de Vera (Almería) no es Dénia',
  )
  assert.equal(detectMunicipalityFromSlug('las-marinas-les-marines-denia', anchored), 'Dénia')
  assert.equal(detectMunicipalityFromSlug('el-cabo-de-gata-almeria', anchored), null)
  assert.equal(detectMunicipalityFromSlug('centro-ciudad-javea-xabia', anchored), 'Xàbia / Jávea')
})

test('parseSitemap lee entradas y su lastmod', () => {
  const xml = `<urlset><url><loc>https://a.test/x/</loc><lastmod>2026-08-01</lastmod></url>
    <url><loc>https://a.test/y/</loc></url></urlset>`
  const entries = parseSitemap(xml)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].lastmod, '2026-08-01')
  assert.equal(entries[1].lastmod, null)
})

const base = {
  id: 'src:abc',
  source: 'src',
  agency: 'Agencia',
  url: 'https://a.test/1',
  municipality: 'Dénia',
  price: 300000,
  priceHistory: [{ date: '2026-08-01', price: 300000 }],
  firstSeen: '2026-08-01',
  lastSeen: '2026-08-01',
  missingRuns: 0,
  status: 'active',
}

test('un anuncio que no estaba ayer es un alta', () => {
  const result = diffInventory([], [base], '2026-08-02')
  assert.equal(result.additions.length, 1)
  assert.equal(result.priceChanges.length, 0)
})

test('un precio menor se registra como bajada y guarda el histórico', () => {
  const cheaper = { ...base, price: 275000 }
  const result = diffInventory([base], [cheaper], '2026-08-02')

  assert.equal(result.additions.length, 0)
  assert.equal(result.priceDrops.length, 1)
  assert.equal(result.priceDrops[0].previousPrice, 300000)
  assert.equal(result.priceDrops[0].delta, -25000)
  assert.equal(result.priceDrops[0].deltaPct, -8.3)
  assert.equal(result.inventory[0].priceHistory.length, 2)
  assert.equal(result.inventory[0].firstSeen, '2026-08-01', 'la fecha de alta no se pisa')
})

test('una baja solo se anota tras una semana sin verla', () => {
  let inventory = [base]
  for (let day = 2; day <= 7; day += 1) {
    const result = diffInventory(inventory, [], `2026-08-0${day}`)
    assert.equal(result.removals.length, 0, `no debería darse de baja el día ${day}`)
    inventory = result.inventory
  }

  const final = diffInventory(inventory, [], '2026-08-08')
  assert.equal(final.removals.length, 1)
  assert.equal(final.inventory.length, 0)
})

test('una ficha que sigue en el sitemap no se da de baja por no abrirla', async () => {
  // El presupuesto de refresco solo abre unas cuantas fichas por pasada. Las
  // que no toca siguen en el sitemap, así que la agencia las mantiene
  // publicadas: no saber nada nuevo de ellas no puede acercarlas a la baja.
  // El 27/08 se retiraron tres anuncios de Ferrando y Morató que seguían vivos
  // porque la rotación no las alcanzó antes de los siete fallos.
  const origin = 'https://a.test'
  const enSitemap = ['/venta/una-c1/', '/venta/otra-c2/', '/venta/tercera-c3/']
  const sitemap =
    '<urlset>' +
    enSitemap.map((p) => `<url><loc>${origin}${p}</loc><lastmod>2026-08-01</lastmod></url>`).join('') +
    '</urlset>'

  const ficha = `<html><body><h1>Casa en Dénia</h1>
    <div class="features-1__price">200.000 €</div></body></html>`

  const fetcher = {
    async get(url) {
      if (url.endsWith('/sitemap.xml')) return sitemap
      return ficha
    },
  }

  // Se conocen las tres del sitemap y una cuarta que ya no está en él.
  const conocida = (path) => [
    `${origin}${path}`,
    { url: `${origin}${path}`, lastmod: '2026-08-01', lastSeen: '2026-08-01' },
  ]
  const known = {
    ids: new Set(),
    byUrl: new Map([...enSitemap.map(conocida), conocida('/venta/desaparecida-c9/')]),
    overBudget: new Map(),
  }

  // Presupuesto de 1: solo se abre una de las tres conocidas.
  const salida = await sooprema.collect({
    fetcher, source: { origin }, known, log: () => {}, refreshBudget: 1,
  })

  assert.ok(salida.checked, 'el adaptador informa de lo que ha comprobado')
  assert.equal(salida.checked.size, 2, 'la que abrió y la que ya no está en el sitemap')
  assert.ok(salida.checked.has(`${origin}/venta/desaparecida-c9/`), 'la que se cayó del sitemap sí')
  const sinAbrir = enSitemap
    .map((p) => `${origin}${p}`)
    .filter((u) => !salida.checked.has(u))
  assert.equal(sinAbrir.length, 2, 'las que siguen en el sitemap sin abrir quedan fuera')
})

test('lo que no se ha llegado a mirar no se acerca a la baja', () => {
  // Llobell sirve un subconjunto rotatorio de su catálogo: entre 51 y 56 de
  // sus 65 fichas por petición. Una casa de Benissa que seguía publicada
  // —y rebajada— se dio de baja porque llevaba semanas sin salir en el
  // listado, sin que nadie hubiera abierto su ficha ni una vez.
  const otra = { ...base, id: 'src:otro', url: 'https://a.test/2' }

  // Sin comprobar: se queda igual, ni fallo ni baja.
  let inventario = [base, otra]
  const retiradas = []
  for (let dia = 2; dia <= 9; dia += 1) {
    const r = diffInventory(inventario, [], `2026-08-${String(dia).padStart(2, '0')}`, {
      checkedUrls: new Set(['https://a.test/2']),
    })
    inventario = r.inventory
    retiradas.push(...r.removals)
  }
  assert.deepEqual(
    retiradas.map((i) => i.id),
    ['src:otro'],
    'solo se retira la que se comprobó y no estaba',
  )
  const sinTocar = inventario.find((i) => i.id === base.id)
  assert.equal(sinTocar.missingRuns ?? 0, 0, 'el que no se mira no acumula fallos')

  // La que sí se comprobó y no estaba, esa sí se retira.
  const mirada = inventario.find((i) => i.id === 'src:otro')
  assert.equal(mirada, undefined, 'la comprobada y ausente ya se ha retirado')
})

test('un robots.txt que no se puede leer decide si se rastrea o no', async () => {
  const respond = (status, body = '') => async () => ({
    status,
    ok: status >= 200 && status < 300,
    text: async () => body,
  })

  // RFC 9309: un 4xx significa que no hay restricciones.
  const forbidden = await loadRobots('https://cdn.test', {
    userAgent: 'test',
    fetchImpl: respond(403),
  })
  assert.equal(forbidden.reachable, true)
  assert.equal(isAllowed(forbidden, '/foto.jpg'), true)

  // Un 5xx deja el dominio sin rastrear: no sabemos qué permite.
  const broken = await loadRobots('https://roto.test', {
    userAgent: 'test',
    fetchImpl: respond(503),
  })
  assert.equal(broken.reachable, false)
  assert.equal(isAllowed(broken, '/loquesea'), false)

  const rules = await loadRobots('https://reglas.test', {
    userAgent: 'test',
    fetchImpl: respond(200, 'User-agent: *\nDisallow: /privado/\nCrawl-delay: 2'),
  })
  assert.equal(isAllowed(rules, '/publico/casa'), true)
  assert.equal(isAllowed(rules, '/privado/casa'), false)
  assert.equal(crawlDelay(rules), 2000)
})

test('el precio sale del anuncio, no de las propiedades similares del pie', () => {
  // Caso real de InmoXara: la ficha está vendida, su precio dice "Consultar" y
  // más abajo hay tarjetas de otras casas con el mismo prefijo de clase. Coger
  // "el primer número que aparezca" publicaba el precio del vecino.
  const vendida = cheerio.load(`
    <div class="features-3__price-wrapper"><span class="features-3__price">Consultar</span></div>
    <div class="property-3--landscape__price">214.000 €</div>`)
  assert.equal(readPrice(vendida), null)

  const normal = cheerio.load(`
    <div class="features-2__price">235.000 €</div>
    <div class="property-3--landscape__price">890.000 €</div>`)
  assert.equal(readPrice(normal), 235000)
})

test('el informe se genera y sale una tarjeta por anuncio', () => {
  // Esta prueba existe sobre todo para que `report.mjs` se importe: la página
  // entera es una plantilla de texto de mil líneas, y una comilla invertida
  // suelta dentro de un comentario del CSS la parte en dos. Pasó — el fichero
  // dejó de compilar y los 25 tests siguieron en verde porque ninguno lo
  // tocaba.
  const anuncio = {
    id: 'src:1', source: 'src', agency: 'Agencia', url: 'https://a.test/1',
    title: 'Casa en Dénia', price: 200000, municipality: 'Dénia', type: 'house',
    beds: 3, baths: 2, builtM2: 100, plotM2: null, pricePerM2: 2000,
    saleStatus: 'available', firstSeen: '2026-08-01', lastSeen: '2026-08-01', status: 'active',
  }
  const daily = {
    date: '2026-08-23', additions: [anuncio], priceDrops: [], priceRises: [], removals: [],
    sources: [], totals: { additions: 1, priceDrops: 0, priceRises: 0, removals: 0 },
  }

  const html = renderReport({ daily, listings: [anuncio], thumbnails: new Map(), maxPrice: 350000 })
  assert.match(html, /<meta charset="utf-8">/)
  assert.equal((html.match(/class="card card--/g) ?? []).length, 2, 'una en altas y otra en el listado')
  assert.match(html, /Casa en Dénia/)
  // Una comilla invertida que se cuele parte la plantilla y deja `${...}` sin
  // interpretar en la salida.
  assert.doesNotMatch(html, /\$\{/, 'no puede quedar interpolación sin resolver')
})

test('el informe se genera aunque el parte del día venga sin cifras', () => {
  // Regenerar en un día sin rastreo es normal: se pasó la medianoche, o solo
  // se retoca la página. El generador reventaba leyendo `daily.totals`, que el
  // parte vacío no traía, y eso tumbaba `--report-only` entero.
  const anuncio = {
    id: 'src:1', source: 'src', agency: 'Agencia', url: 'https://a.test/1',
    title: 'Casa en Dénia', price: 200000, municipality: 'Dénia', type: 'house',
    beds: 3, baths: 2, builtM2: 100, plotM2: null, pricePerM2: 2000,
    saleStatus: 'available', firstSeen: '2026-08-01', lastSeen: '2026-08-01', status: 'active',
  }
  const sinCifras = {
    date: '2026-08-28',
    totals: { inventory: 1, additions: 0, priceDrops: 0, priceRises: 0, removals: 0 },
    additions: [], priceDrops: [], priceRises: [], removals: [], sources: [],
  }

  const html = renderReport({ daily: sinCifras, listings: [anuncio], thumbnails: new Map(), maxPrice: 350000 })
  assert.match(html, /Casa en Dénia/, 'el inventario se sigue publicando')
  assert.doesNotMatch(html, /\$\{/)
})

test('la misma vivienda en varias agencias se enseña una sola vez', () => {
  // Caso real: la casa de 7 dormitorios y 529 m² de El Verger sale cinco veces
  // en el portal, cuatro a 190.000 € y una a 199.999 €. Las cuatro iguales son
  // una tarjeta; la del precio distinto se queda, que es lo que se quiere ver.
  const casa = (id, price, agency, extra = {}) => ({
    id, price, agency, municipality: 'El Verger', beds: 7, builtM2: 529,
    url: `https://${agency}.test/${id}`, source: agency, firstSeen: '2026-08-01', ...extra,
  })
  const entrada = [
    casa('a', 190000, 'thinkspain', { source: 'thinkspain' }),
    casa('b', 190000, 'daniamed'),
    casa('c', 190000, 'denialara'),
    casa('d', 199999, 'thinkspain', { source: 'thinkspain' }),
  ]

  const salida = dedupeForDisplay(entrada)
  assert.equal(salida.length, 2, 'las tres de 190.000 colapsan; la de 199.999 no')
  assert.equal(salida[0].price, 190000)
  assert.equal(salida[0].agency, 'daniamed', 'manda la agencia directa sobre el portal')
  assert.equal(salida[0].alsoAt.length, 2)
  assert.equal(salida[1].price, 199999)
  assert.equal(salida[1].alsoAt, undefined)
})

test('no se agrupa lo que no se puede comparar ni lo que solo se parece', () => {
  const base = { municipality: 'Dénia', beds: 2, builtM2: 80, agency: 'x', source: 'x', firstSeen: '2026-08-01' }

  // Sin superficie no hay con qué comparar: pasan las dos antes que esconder
  // una casa distinta.
  const sinDatos = dedupeForDisplay([
    { ...base, id: '1', price: 200000, builtM2: null, url: 'https://a.test/1' },
    { ...base, id: '2', price: 200000, builtM2: null, url: 'https://a.test/2' },
  ])
  assert.equal(sinDatos.length, 2)

  // Mismo tamaño y municipio pero precios que no se rozan: son dos pisos.
  const distintos = dedupeForDisplay([
    { ...base, id: '3', price: 200000, url: 'https://a.test/3' },
    { ...base, id: '4', price: 245000, url: 'https://a.test/4' },
  ])
  assert.equal(distintos.length, 2)

  // 199.999 y 200.000 sí son el mismo precio.
  const redondeo = dedupeForDisplay([
    { ...base, id: '5', price: 199999, url: 'https://a.test/5' },
    { ...base, id: '6', price: 200000, builtM2: 81, url: 'https://a.test/6' },
  ])
  assert.equal(redondeo.length, 1)

  // Una cadena de saltos pequeños no puede acabar juntando los extremos: se
  // compara contra el primero del grupo, no contra el anterior.
  const cadena = dedupeForDisplay(
    [200000, 201000, 202000, 203000].map((price, i) => ({
      ...base, id: `c${i}`, price, url: `https://a.test/c${i}`,
    })),
  )
  const tarjetaDe = (price) => cadena.find((c) => c.price === price || c.alsoAt?.some((o) => o.price === price))
  assert.notEqual(
    tarjetaDe(200000),
    tarjetaDe(203000),
    '200.000 y 203.000 no pueden acabar en la misma tarjeta',
  )

  // Una rebaja de verdad de otra agencia se sigue viendo.
  const rebaja = dedupeForDisplay([
    { ...base, id: '7', price: 194000, url: 'https://a.test/7' },
    { ...base, id: '8', price: 200000, url: 'https://a.test/8' },
  ])
  assert.equal(rebaja.length, 2)
})

test('una parcela se compara por su terreno, que es lo único que tiene', () => {
  const parcela = (id, price, plotM2, agency) => ({
    id, price, plotM2, agency, source: agency, type: 'plot', municipality: 'Benissa',
    beds: null, builtM2: null, url: `https://${agency}.test/${id}`, firstSeen: '2026-08-01',
  })

  const misma = dedupeForDisplay([parcela('a', 140000, 800, 'x'), parcela('b', 140000, 805, 'y')])
  assert.equal(misma.length, 1, 'mismo terreno y mismo precio: una sola parcela')

  const distintas = dedupeForDisplay([parcela('c', 140000, 800, 'x'), parcela('d', 140000, 1600, 'y')])
  assert.equal(distintas.length, 2, 'el doble de terreno es otra parcela')

  // Sin metros de terreno no hay con qué comparar.
  const sinDato = dedupeForDisplay([parcela('e', 140000, null, 'x'), parcela('f', 140000, null, 'y')])
  assert.equal(sinDato.length, 2)
})

test('el título veta la localidad que declara la agencia', () => {
  // Llobell vendía una casa de Benigembla —pueblo fuera del ámbito— con la
  // localidad puesta en Benissa, y así entraba en el inventario. En esa
  // discrepancia gana el título: la agencia rellena el desplegable con el
  // pueblo más cercano de su lista, pero escribe el de verdad en el anuncio.
  //
  // Se comprueba sobre `normalize` a propósito. El veto vivió un día dentro del
  // adaptador, donde dejaba el municipio en `null`, y este test lo daba por
  // bueno; pero `null` ahí significa "no lo sé", así que `normalize` volvía a
  // deducirlo del texto libre y la casa reaparecía en Benissa a la mañana
  // siguiente. Lo que hay que afirmar es que el anuncio no entra.
  const ficha = (titulo, localidad) => `<html><body>
    <h1>${titulo}</h1><div class="precio">140.000 €</div>
    <p>Localidad: ${localidad}Zona: Centro</p></body></html>`
  const source = { id: 'llobell', agency: 'Llobell' }

  const vetada = listado.parsePropertyPage(
    ficha('Se vende casa de pueblo en Benigembla', 'Benissa'),
    'https://a.test/propiedad/casa-benigembla-c629/',
  )
  const descartada = normalize(vetada, source, '2026-08-29')
  assert.equal(descartada.listing, null, 'no entra en el inventario')
  assert.equal(descartada.reason, 'fuera de la comarca')

  // Sin veto, la localidad declarada sigue mandando sobre el título.
  const normal = listado.parsePropertyPage(
    ficha('Casa de pueblo a diez minutos de Dénia', 'Ondara'),
    'https://a.test/propiedad/casa-ondara-c1/',
  )
  assert.equal(normalize(normal, source, '2026-08-29').listing.municipality, 'Ondara')

  // Y el veto solo pesa cuando el título no nombra ninguno de los nuestros:
  // "Benissa, junto a Murla" es de Benissa.
  const vecina = listado.parsePropertyPage(
    ficha('Casa en Benissa, junto a Murla', 'Benissa'),
    'https://a.test/propiedad/casa-benissa-c7/',
  )
  assert.equal(normalize(vecina, source, '2026-08-29').listing.municipality, 'Benissa')
})

test('el dominio de la agencia no dice dónde está la casa', () => {
  // `ferrando-moraira.com` colocaba en Teulada su catálogo entero, incluida
  // una casa señorial de Orba.
  const pego = normalize(
    {
      sourceRef: 'c0105',
      url: 'https://www.ferrando-moraira.com/for-sale/manor-house-for-sale-in-orba-historic-centre-c0105/',
      title: 'Manor House for Sale in Orba Historic Centre',
      price: 295000,
      type: 'house',
      locationHint: 'Manor House for Sale in Orba Historic Centre',
    },
    { id: 'ferrando-moraira', agency: 'Ferrando' },
    '2026-08-22',
  )
  assert.equal(pego.listing.municipality, 'Orba')
})

test('manda el municipio que aparece antes, no el alias más largo', () => {
  // "moraira" tiene más letras que "orba", y por eso ganaba aunque estuviera
  // al final de la descripción.
  assert.equal(detectMunicipality('Casa en Orba cerca de Moraira'), 'Orba')
  assert.equal(detectMunicipality('Casa en Moraira cerca de Orba'), 'Teulada-Moraira')
  // A igualdad de posición sigue mandando el alias más específico.
  assert.equal(detectMunicipality('Moraira Alto, chalet'), 'El Poble Nou de Benitatxell')
})

test('una superficie construida imposible se deja en blanco', () => {
  // Caso real: ThinkSpain publica una finca de Orba de 100.000 € declarando
  // 9.927 m² construidos — es la parcela puesta en la casilla equivocada. Sin
  // esto encabeza la ordenación por €/m² como una ganga de 10 €/m².
  const finca = normalize(
    { sourceRef: '6358143', url: 'https://a.test/1', title: 'Finca en Orba', price: 100000, builtM2: 9927, type: 'villa', municipality: 'Orba' },
    { id: 'thinkspain', agency: 'ThinkSpain' },
    '2026-08-22',
  )
  assert.equal(finca.listing.builtM2, null)
  assert.equal(finca.listing.pricePerM2, null)
  assert.equal(finca.listing.price, 100000, 'el anuncio se publica igual')

  const casona = normalize(
    { sourceRef: 'x', url: 'https://a.test/2', title: 'Casa en Orba', price: 320000, builtM2: 840, type: 'house', municipality: 'Orba' },
    { id: 'src', agency: 'Agencia' },
    '2026-08-22',
  )
  assert.equal(casona.listing.builtM2, 840, 'una casa grande de verdad sí pasa')
})

test('un icono sin texto no cuenta como el precio de la ficha', () => {
  // Benimo abre su bloque de precio con la imagen del icono, que casa con el
  // mismo selector y va delante. Quedarse con ella dejaba la web sin precios
  // y, en consecuencia, sin un solo anuncio en el informe.
  const benimo = cheerio.load(`
    <div class="features-1__price-img"><img src="/precio.svg" alt=""></div>
    <span class="features-1__price">285.000 €</span>
    <div class="property-1__price">750.000 €</div>`)
  assert.equal(readPrice(benimo), 285000)

  // Pero un "Consultar" sí es texto, y sigue mandando sobre lo que venga luego.
  const consultar = cheerio.load(`
    <div class="features-1__price-img"><img src="/precio.svg" alt=""></div>
    <span class="features-1__price">Consultar</span>
    <div class="property-1__price">750.000 €</div>`)
  assert.equal(readPrice(consultar), null)
})

test('el barrido de zona recorre todas las páginas y para al dar la vuelta', async () => {
  // ThinkSpain sirve 16 tarjetas por página y las siguientes van en `numpag`.
  // Pasada la última no devuelve una página vacía: vuelve a servir la primera,
  // así que sin el freno de "esto ya lo he visto" el bucle no terminaría.
  const tarjeta = (id) =>
    `<div data-property-id="${id}" data-base-twc-analytic-event-parameters='{"propertyID":"${id}","price":100000,"offer":"for-sale"}'>` +
    `<img alt="Casa en venta en Dénia número ${id}"></div>`
  const paginas = [
    Array.from({ length: 16 }, (_, i) => tarjeta(1000 + i)).join(''),
    Array.from({ length: 16 }, (_, i) => tarjeta(2000 + i)).join(''),
    Array.from({ length: 5 }, (_, i) => tarjeta(3000 + i)).join(''),
  ]

  const pedidas = []
  const fetcher = {
    async get(url) {
      pedidas.push(url)
      const numpag = Number(new URL(url).searchParams.get('numpag') ?? 1)
      // Más allá de la última, el servidor repite la primera página.
      return paginas[numpag - 1] ?? paginas[0]
    },
  }

  const recogidas = []
  for await (const lote of zonePages(fetcher, 'https://www.thinkspain.com/es/venta-viviendas/denia', 350000)) {
    recogidas.push(...lote)
  }

  assert.equal(recogidas.length, 37, 'las tres páginas, sin repetir')
  assert.equal(new Set(recogidas.map((item) => item.sourceRef)).size, 37)
  assert.equal(pedidas.length, 3, 'para en la página incompleta, sin pedir una cuarta')
  assert.ok(
    pedidas.every((url) => new URL(url).searchParams.get('maxprice') === '350000'),
    'el techo de precio se aplica en el servidor',
  )
})

test('sin página incompleta, el barrido para en cuanto se repiten las fichas', async () => {
  // Una zona con exactamente 32 anuncios: la tercera petición devuelve otra vez
  // la primera página, y ahí es donde tiene que cortar.
  const tarjeta = (id) =>
    `<div data-property-id="${id}" data-base-twc-analytic-event-parameters='{"propertyID":"${id}","price":90000,"offer":"for-sale"}'>` +
    `<img alt="Piso en venta en Calpe número ${id}"></div>`
  const paginas = [
    Array.from({ length: 16 }, (_, i) => tarjeta(1000 + i)).join(''),
    Array.from({ length: 16 }, (_, i) => tarjeta(2000 + i)).join(''),
  ]
  let peticiones = 0
  const fetcher = {
    async get(url) {
      peticiones += 1
      const numpag = Number(new URL(url).searchParams.get('numpag') ?? 1)
      return paginas[numpag - 1] ?? paginas[0]
    },
  }

  const recogidas = []
  for await (const lote of zonePages(fetcher, 'https://www.thinkspain.com/es/venta-viviendas/calpe', Infinity)) {
    recogidas.push(...lote)
  }

  assert.equal(recogidas.length, 32)
  assert.equal(peticiones, 3, 'la tercera detecta la vuelta y corta')
})

test('sin prefijo de idioma no es neutro: es el idioma por defecto de la web', () => {
  // Bindley publica cada casa dos veces, en inglés sin prefijo y en castellano
  // bajo /es/. Tomar "sin prefijo" por neutro dejaba pasar las dos: 128 fichas
  // inglesas y 107 españolas, con la misma referencia y distinto slug.
  const entrada = [
    { loc: 'https://a.test/property/for-sale/plot-in-benissa-bpc011092/' },
    { loc: 'https://a.test/property/for-sale/villa-in-calpe-bpc011093/' },
    { loc: 'https://a.test/property/for-sale/house-in-javea-bpc011094/' },
    { loc: 'https://a.test/es/propiedad/venta/parcela-en-benissa-bpc011092/' },
    { loc: 'https://a.test/es/propiedad/venta/villa-en-calpe-bpc011093/' },
  ]
  const salida = preferOneLanguage(entrada)
  assert.equal(salida.length, 3, 'gana el idioma con más fichas, que es el catálogo completo')
  assert.ok(salida.every((e) => !e.loc.includes('/es/')))

  // Una web de un solo idioma se queda como está.
  const unSoloIdioma = [
    { loc: 'https://b.test/propiedad/casa-en-orba-c1/' },
    { loc: 'https://b.test/propiedad/casa-en-orba-c2/' },
  ]
  assert.equal(preferOneLanguage(unSoloIdioma).length, 2)
})

test('cuando la plantilla no marca el precio, mandan los datos estructurados', () => {
  // Bindley cambió de plantilla y se quedó en cero anuncios: el importe pasó a
  // ir en utilidades de Tailwind, sin ninguna clase con "price". En esa misma
  // página el primer importe del maquetado eran 749.000 € de otra casa; el
  // precio real, 386.400 €, solo estaba en el `RealEstateListing`.
  const html = `<html><head><script type="application/ld+json">
    {"@context":"https://schema.org","@graph":[
      {"@type":"WebPage","name":"no es la ficha"},
      {"@type":"RealEstateListing","name":"2 PLOTS OF LAND IN MORAIRA",
       "address":{"@type":"PostalAddress","addressLocality":"Benitachell"},
       "offers":{"@type":"Offer","price":386400,"priceCurrency":"EUR"}}]}
    </script></head><body>
      <h1>2 PLOTS OF LAND IN MORAIRA</h1>
      <div class="shrink-0 text-right"><p class="font-bold">749,000 €</p></div>
    </body></html>`

  const item = parsePropertyPage(html, 'https://a.test/property/for-sale/2-plots-bp320442/')
  assert.equal(item.price, 386400, 'no el importe suelto del maquetado')
  assert.match(item.locationHint, /^Benitachell/, 'la localidad declarada va primero')
  assert.equal(
    normalize(item, { id: 'bindley', agency: 'Bindley' }, '2026-08-24').listing.municipality,
    'El Poble Nou de Benitatxell',
    'aunque el título diga Moraira',
  )
})

test('el icono se interpreta por su descripción, no por el nombre del fichero', () => {
  // Benimo llama "area.svg" al icono de la parcela: sin mirar el alt, una
  // parcela de 14.414 m² acababa contada como superficie construida.
  const $ = cheerio.load(`
    <ul class="features__list">
      <li><img src="/assets/area.svg" alt="Icono de tamaño de parcela" title="Tamaño de parcela"> 14.414 m2</li>
      <li><img src="/assets/house-soo.svg" alt="Construido"> 54 m2</li>
    </ul>`)
  const facts = { beds: null, baths: null, builtM2: null, plotM2: null }
  readIconFeatures($, facts)
  assert.equal(facts.plotM2, 14414)
  assert.equal(facts.builtM2, 54)
})

test('ocultar el precio no es retirar el anuncio', () => {
  // MLS Dénia y Daniamed pasaron el importe de dos fichas a "Consultar". La
  // ficha seguía publicada, pero sin precio no se podía normalizar, dejaba de
  // aparecer en lo recogido y a los siete fallos se daba de baja. Es el mismo
  // error de siempre: "hoy no la veo" no es "ya no está".
  //
  // Los importes del maquetado son los de otro anuncio, el del carrusel de
  // propiedades similares que estas plantillas pintan al pie — por eso mirar
  // "si hay algún precio en la página" tampoco sirve.
  const html = `<html><body>
    <h1 class="propertytitle-1__title">Chalet con 2 dormitorios en el Montgó</h1>
    <div class="features-8__price">Consultar</div>
    <div class="property-3--landscape">
      <span class="property-3--landscape__title">Chalet independiente cerca del mar</span>
      <span class="property-3--landscape__price-text">330.000 €</span>
    </div></body></html>`

  const item = parsePropertyPage(html, 'https://a.test/en-venta/chalet-montgo-9070/')
  assert.equal(item.priceOnRequest, true)
  assert.equal(item.price, undefined, 'no se hereda el precio del anuncio de al lado')

  // Y una ficha con precio de verdad sigue leyéndose como siempre.
  const conPrecio = parsePropertyPage(
    html.replace('>Consultar<', '>245.000 €<'),
    'https://a.test/en-venta/chalet-montgo-9070/',
  )
  assert.equal(conPrecio.priceOnRequest, undefined)
  assert.equal(conPrecio.price, 245000)
})

test('un muro anti-bot no se confunde con una web sin anuncios', () => {
  // El CMS de seis agencias empezó a servir una página de reto —una prueba de
  // trabajo que planta la cookie `__shield`— con código 200 en lugar del
  // sitemap. Sin reconocerla, el rastreo la parsea, no encuentra ninguna URL y
  // concluye que la agencia se ha quedado sin catálogo.
  const reto = `<!DOCTYPE html><html><head><title>Security Check</title></head>
    <body><script>document.cookie="__shield="+B+"."+n+";path=/";</script></body></html>`
  assert.equal(isAntiBotChallenge(reto), true)

  // Y un sitemap de verdad no se confunde con uno, ni una ficha que hable de
  // seguridad en el texto del anuncio.
  assert.equal(isAntiBotChallenge('<urlset><url><loc>https://a.test/x</loc></url></urlset>'), false)
  assert.equal(isAntiBotChallenge('<h1>Villa con puerta de seguridad</h1>'), false)
  assert.equal(isAntiBotChallenge(null), false)

  // El reto de DataDome no dice "DataDome" en ninguna parte: lo reconocible es
  // el host de su captcha. Es lo que sirve Yaencontre en todas sus rutas.
  const dataDome =
    `<html><body><p>Please enable JS and disable any ad blocker</p>` +
    `<script src="https://ct.captcha-delivery.com/c.js"></script></body></html>`
  assert.equal(isAntiBotChallenge(dataDome), true)
})

test('la identidad del anuncio es su referencia, no el slug traducido', () => {
  // El slug va traducido, así que la misma casa entraba una vez por idioma:
  // 107 de las 108 de Bindley estaban duplicadas. Y cuando la web cambió
  // `/for-sale/x/` por `/property/for-sale/x/`, las veintiuna URLs viejas
  // dieron 404 con los anuncios a la venta en su dirección nueva, y se
  // informaron como retiradas.
  const mismaCasa = [
    'https://a.test/property/for-sale/plots-for-sale-in-jalon-costa-blanca-bp3707/',
    'https://a.test/es/propiedad/venta/parcelas-en-venta-en-jalon-costa-blanca-bp3707/',
    'https://a.test/de/immobilie/verkauf/grundstucke-zu-verkaufen-in-jalon-bp3707/',
    'https://a.test/for-sale/plots-for-sale-in-jalon-costa-blanca-bp3707/',
  ]
  const refs = new Set(mismaCasa.map(referenceFromSlug))
  assert.deepEqual([...refs], ['bp3707'], 'una sola identidad para las cuatro rutas')

  // Formas de referencia que usan estas webs.
  assert.equal(referenceFromSlug('https://a.test/en-venta/chalet-montgo-9070/'), '9070')
  assert.equal(referenceFromSlug('https://a.test/es/propiedad/venta/piso-bpc336169/'), 'bpc336169')

  // Y lo que no parece una referencia no lo es: sin cifras es una palabra del
  // slug, y tomarla juntaría casas distintas bajo la misma identidad.
  assert.equal(referenceFromSlug('https://a.test/venta/adosado-en-les-marines-denia/'), null)
  assert.equal(referenceFromSlug('https://a.test/venta/casa-2/'), null, 'demasiado corta')
  assert.equal(referenceFromSlug('no es una url'), null)
})

test('un listado que rota se pide hasta agotarlo', async () => {
  // Llobell no sirve el mismo listado en cada petición: devuelve entre 51 y 56
  // de sus 65 fichas, y las que rotan no se descubren nunca mirando una sola
  // vez. El 31/08 se quedaron fuera dos parcelas recién publicadas.
  const origin = 'https://a.test'
  const todas = ['p1', 'p2', 'p3', 'p4']
  const tandas = [
    ['p1', 'p2'],
    ['p1', 'p3'],
    ['p2', 'p3', 'p4'],
  ]
  let pedidas = 0

  const fetcher = {
    async get(url) {
      if (url === `${origin}/listado/`) {
        const tanda = tandas[Math.min(pedidas, tandas.length - 1)]
        pedidas += 1
        return tanda.map((r) => `<a href="/propiedad/casa-${r}/">x</a>`).join('')
      }
      const ref = url.match(/casa-(p\d)/)[1]
      return `<html><body><h1>Casa ${ref}</h1><div class="precio">200.000 €</div>
        <p>Localidad: OndaraZona: Centro</p></body></html>`
    },
  }

  const salida = await listado.collect({
    fetcher,
    source: { origin, listingUrls: [`${origin}/listado/`] },
    known: { byUrl: new Map(), removed: [] },
    log: () => {},
  })

  assert.deepEqual(
    salida.items.map((i) => i.url.match(/casa-(p\d)/)[1]).sort(),
    todas,
    'las cuatro, aunque ninguna petición las trajo todas',
  )
  // Se para en cuanto una pasada no aporta nada: la cuarta repite la tercera.
  assert.equal(pedidas, 4, 'una petición de más para comprobar que ya no hay')
})

test('quitar un municipio del ámbito no se lleva a los vecinos', () => {
  // Pego sale del ámbito el 01/09. La trampa es "Monte Pego": la urbanización
  // está a caballo de los dos términos y ThinkSpain la publica bajo Dénia, así
  // que un veto sobre la palabra "pego" a secas se llevaba por delante treinta
  // y un anuncios de Dénia.
  assert.equal(detectMunicipality('Villa en Pego con vistas al marjal'), null)
  assert.equal(
    detectMunicipality('Apartamento de 2 habitaciones en Devessa - Monte Pego, Dénia'),
    'Dénia',
  )
  // Y la zona de la que salen esos anuncios sigue leyéndose como Dénia.
  assert.equal(detectMunicipalityFromSlug('devessa-monte-pego-denia', { anchored: true }), 'Dénia')
  assert.equal(detectMunicipalityFromSlug('pego', { anchored: true }), null)

  assert.equal(MUNICIPALITY_NAMES.includes('Pego'), false)
})
