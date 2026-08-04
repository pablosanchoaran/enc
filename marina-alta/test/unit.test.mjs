import assert from 'node:assert/strict'
import test from 'node:test'

import * as cheerio from 'cheerio'

import { diffInventory } from '../src/diff.mjs'
import { detectMunicipality, detectMunicipalityFromSlug } from '../src/municipalities.mjs'
import {
  detectSaleStatus,
  detectType,
  parseArea,
  parsePrice,
  parseSitemap,
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
