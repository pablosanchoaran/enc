import assert from 'node:assert/strict'
import test from 'node:test'

import * as cheerio from 'cheerio'

import { dedupeForDisplay } from '../src/dedupe.mjs'
import { diffInventory } from '../src/diff.mjs'
import { readIconFeatures } from '../src/adapters/sooprema.mjs'
import { zonePages } from '../src/adapters/thinkspain.mjs'
import { crawlDelay, isAllowed, loadRobots } from '../src/robots.mjs'
import { normalize } from '../src/normalize.mjs'
import { detectMunicipality, detectMunicipalityFromSlug } from '../src/municipalities.mjs'
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

test('en un slug de zona manda el municipio del final', () => {
  assert.equal(detectMunicipalityFromSlug('devessa-monte-pego-denia'), 'Dénia')
  assert.equal(detectMunicipalityFromSlug('oltamar-cucarres-calpe-calp'), 'Calp / Calpe')
  assert.equal(detectMunicipalityFromSlug('pego'), 'Pego')
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

test('el dominio de la agencia no dice dónde está la casa', () => {
  // `ferrando-moraira.com` colocaba en Teulada su catálogo entero, incluida
  // una casa señorial de Pego.
  const pego = normalize(
    {
      sourceRef: 'c0105',
      url: 'https://www.ferrando-moraira.com/for-sale/manor-house-for-sale-in-pego-historic-centre-c0105/',
      title: 'Manor House for Sale in Pego Historic Centre',
      price: 295000,
      type: 'house',
      locationHint: 'Manor House for Sale in Pego Historic Centre',
    },
    { id: 'ferrando-moraira', agency: 'Ferrando' },
    '2026-08-22',
  )
  assert.equal(pego.listing.municipality, 'Pego')
})

test('manda el municipio que aparece antes, no el alias más largo', () => {
  // "moraira" tiene más letras que "pego", y por eso ganaba aunque estuviera
  // al final de la descripción.
  assert.equal(detectMunicipality('Casa en Pego cerca de Moraira'), 'Pego')
  assert.equal(detectMunicipality('Casa en Moraira cerca de Pego'), 'Teulada-Moraira')
  // A igualdad de posición sigue mandando el alias más específico.
  assert.equal(detectMunicipality('Moraira Alto, chalet'), 'El Poble Nou de Benitatxell')
})

test('una superficie construida imposible se deja en blanco', () => {
  // Caso real: ThinkSpain publica una finca de Pego de 100.000 € declarando
  // 9.927 m² construidos — es la parcela puesta en la casilla equivocada. Sin
  // esto encabeza la ordenación por €/m² como una ganga de 10 €/m².
  const finca = normalize(
    { sourceRef: '6358143', url: 'https://a.test/1', title: 'Finca en Pego', price: 100000, builtM2: 9927, type: 'villa', municipality: 'Pego' },
    { id: 'thinkspain', agency: 'ThinkSpain' },
    '2026-08-22',
  )
  assert.equal(finca.listing.builtM2, null)
  assert.equal(finca.listing.pricePerM2, null)
  assert.equal(finca.listing.price, 100000, 'el anuncio se publica igual')

  const casona = normalize(
    { sourceRef: 'x', url: 'https://a.test/2', title: 'Casa en Pego', price: 320000, builtM2: 840, type: 'house', municipality: 'Pego' },
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
