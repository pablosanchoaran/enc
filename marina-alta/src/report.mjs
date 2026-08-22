/**
 * Genera el informe diario como una página HTML autocontenida: sin peticiones
 * externas, porque el artefacto publicado bloquea cualquier host de fuera.
 */

import { dedupeForDisplay } from './dedupe.mjs'

/**
 * Techo por defecto de la sección de vivienda del informe. Lo normal es que
 * llegue el del catálogo (`config.maxPrice`), que es el mismo con el que se
 * extrae: publicar por debajo de lo que se recoge dejaba fuera anuncios que ya
 * estaban descargados.
 */
const DEFAULT_BUDGET = 350_000

const TYPE_LABELS = {
  villa: 'Villa / chalet',
  house: 'Casa',
  townhouse: 'Adosado / bungaló',
  apartment: 'Piso',
  penthouse: 'Ático',
  plot: 'Parcela',
  other: 'Otro',
}

const escape = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const euros = (value) =>
  value == null ? '—' : `${new Intl.NumberFormat('es-ES').format(value)} €`

const LONG_DATE = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

/** Precio medio por m² construido de cada municipio, con al menos 3 muestras. */
function pricePerM2ByMunicipality(listings) {
  const groups = new Map()
  for (const item of listings) {
    // Lo vendido no es oferta: distorsionaría la mediana del mercado actual.
    if (!item.pricePerM2 || item.type === 'plot' || item.status === 'removed') continue
    if (item.saleStatus === 'sold') continue
    if (!groups.has(item.municipality)) groups.set(item.municipality, [])
    groups.get(item.municipality).push(item.pricePerM2)
  }

  return [...groups]
    .filter(([, values]) => values.length >= 5)
    .map(([municipality, values]) => {
      const sorted = [...values].sort((a, b) => a - b)
      const middle = Math.floor(sorted.length / 2)
      return {
        municipality,
        median:
          sorted.length % 2 === 0
            ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
            : sorted[middle],
        count: values.length,
      }
    })
    .sort((a, b) => b.median - a.median)
}

const STATUS_LABELS = { available: 'Disponible', reserved: 'Reservado', sold: 'Vendido' }

/**
 * Estado como casillas. Arranca con "Disponible" marcado: una casa vendida
 * sigue publicada meses y no debería contar como oferta, pero ahora se pueden
 * añadir los reservados con un clic.
 */
function statusOptions(items) {
  const counts = items.reduce((tally, item) => {
    const status = item.saleStatus ?? 'available'
    tally[status] = (tally[status] ?? 0) + 1
    return tally
  }, {})

  return ['available', 'reserved', 'sold']
    .filter((value) => counts[value] > 0)
    .map((value) => ({
      value,
      text: `${STATUS_LABELS[value]} (${counts[value]})`,
      checked: value === 'available',
    }))
}

/**
 * Una cifra del resumen. Cuando hay algo que enseñar es un enlace a su
 * sección; con un cero no lleva a ninguna parte y se marca como tal, para no
 * prometer un destino vacío.
 */
/**
 * Criterios de ordenación. El precio ascendente es el que interesa a quien
 * busca algo asequible, así que manda por defecto; el €/m² es el que delata
 * las gangas, y "novedad" sirve para ver primero lo último que ha aparecido.
 */
const SORTS = [
  { value: 'price-asc', text: 'Precio: de menor a mayor' },
  { value: 'price-desc', text: 'Precio: de mayor a menor' },
  { value: 'unit-asc', text: 'Precio por m²: de menor a mayor' },
  { value: 'built-desc', text: 'Superficie construida: de mayor a menor' },
  { value: 'plot-desc', text: 'Parcela: de mayor a menor' },
  { value: 'municipality-asc', text: 'Municipio: A–Z' },
  { value: 'seen-desc', text: 'Novedad: visto por primera vez' },
]

function sortSelect(id) {
  const options = SORTS.map(
    ({ value, text }) => `<option value="${value}">${escape(text)}</option>`,
  ).join('')
  return `<label class="filters__sort">Ordenar por<select id="${id}">${options}</select></label>`
}

function tile({ value, label, target, variant, movement }) {
  const classes = ['tile', variant ? `tile--${variant}` : '', value > 0 ? '' : 'tile--empty']
    .filter(Boolean)
    .join(' ')
  const body = `<span class="tile__value">${value}</span><span class="tile__label">${escape(label)}</span>`

  if (value > 0) {
    return `<a class="${classes}" href="#${target}"${movement ? ` data-movement="${movement}"` : ''}>${body}</a>`
  }
  return `<div class="${classes}">${body}</div>`
}

function multiFilter({ id, label, options, allLabel = 'Todos' }) {
  const items = options
    .map(
      ({ value, text, checked }) => `
        <label class="multi__option">
          <input type="checkbox" value="${escape(value)}"${checked ? ' checked' : ''}>
          <span>${escape(text)}</span>
        </label>`,
    )
    .join('')

  return `
    <details class="multi" id="${id}" data-all="${escape(allLabel)}">
      <summary><span class="multi__label">${escape(label)}</span><span class="multi__value">${escape(allLabel)}</span></summary>
      <div class="multi__panel">${items}</div>
    </details>`
}

/** Municipios, tipos y agencias como opciones del filtro. */
function toOptions(values, labels = null) {
  return values.map((value) => ({ value, text: labels ? labels[value] : value }))
}

function renderCard(item, thumbnails) {
  const status = item.saleStatus ?? 'available'
  const thumb = thumbnails?.get(item.id)
  const facts = [
    item.beds ? `${item.beds} hab.` : null,
    item.baths ? `${item.baths} baños` : null,
    item.builtM2 ? `${item.builtM2} m² const.` : null,
    item.plotM2 ? `${item.plotM2} m² parcela` : null,
  ].filter(Boolean)

  return `
    <article class="card card--${status}" data-municipality="${escape(item.municipality)}" data-type="${escape(item.type)}" data-agency="${escape(item.agency)}" data-price="${item.price}" data-status="${status}" data-unit="${item.pricePerM2 ?? ''}" data-built="${item.builtM2 ?? ''}" data-plot="${item.plotM2 ?? ''}" data-seen="${escape(item.firstSeen ?? '')}">
      ${renderPhoto(item, thumb)}
      <div class="card__head">
        <span class="chip">${escape(TYPE_LABELS[item.type] ?? item.type)}</span>
        ${status === 'available' ? '' : `<span class="chip chip--${status}">${STATUS_LABELS[status]}</span>`}
        <span class="card__place">${escape(item.municipality)}</span>
      </div>
      <p class="card__price">${euros(item.price)}</p>
      ${item.pricePerM2 ? `<p class="card__unit">${new Intl.NumberFormat('es-ES').format(item.pricePerM2)} €/m²</p>` : ''}
      <h3 class="card__title">${escape(item.title ?? 'Sin título')}</h3>
      ${facts.length ? `<ul class="card__facts">${facts.map((fact) => `<li>${escape(fact)}</li>`).join('')}</ul>` : ''}
      ${renderAlsoAt(item.alsoAt)}
      <footer class="card__foot">
        <span class="card__agency">${escape(item.agency)}</span>
        <a class="card__link" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">Ver ficha →</a>
      </footer>
    </article>`
}

/**
 * La portada de la tarjeta. El generador no sabe si la foto le llega
 * empotrada o como fichero, y no le hace falta: en el artefacto es un `data:`
 * y en la web es `fotos/x.webp`, que el navegador pide solo al acercarse.
 *
 * Cuando hay copia de 640 px —solo en la web, porque empotrarlas no cabía— la
 * miniatura lleva a ella en vez de a la ficha de la agencia: es la foto tal y
 * como estaba el día que se guardó, y sigue ahí aunque el anuncio desaparezca.
 */
function renderPhoto(item, thumb) {
  if (!thumb) return ''
  const src = typeof thumb === 'string' ? thumb : thumb.thumb
  const full = typeof thumb === 'string' ? null : thumb.full
  const destino = full ?? item.url
  return `<a class="card__photo" href="${escape(destino)}" target="_blank" rel="noopener noreferrer"><img src="${escape(src)}" alt="" loading="lazy" width="240" height="160"></a>`
}

/**
 * Las otras agencias que anuncian la misma vivienda al mismo precio. Se
 * despliegan porque lo normal es no querer verlas; están para poder llamar a
 * otra si con una no hay suerte.
 */
function renderAlsoAt(alsoAt) {
  if (!alsoAt?.length) return ''
  const otras = alsoAt.length === 1 ? 'otra agencia' : `otras ${alsoAt.length} agencias`
  return `
      <details class="card__also">
        <summary>También en ${otras}</summary>
        <ul>${alsoAt
          .map(
            (item) =>
              `<li><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.agency)}</a></li>`,
          )
          .join('')}</ul>
      </details>`
}

function renderPriceRow(item) {
  const isDrop = item.direction === 'drop'
  return `
    <li class="movement ${isDrop ? 'movement--drop' : 'movement--rise'}" data-movement="${isDrop ? 'drop' : 'rise'}">
      <div class="movement__main">
        <span class="movement__place">${escape(item.municipality)}</span>
        <a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.title ?? item.url)}</a>
      </div>
      <div class="movement__numbers">
        <span class="movement__was">${euros(item.previousPrice)}</span>
        <span class="movement__now">${euros(item.price)}</span>
        <span class="movement__delta">${isDrop ? '▼' : '▲'} ${Math.abs(item.deltaPct)} %</span>
      </div>
    </li>`
}

/**
 * Sección plegable. La cabecera entera es el botón, y el cuerpo va en su
 * propio contenedor para poder ocultarlo; el estado de cada una se recuerda en
 * el navegador de quien lo mira.
 *
 * @param {string} id       ancla de la sección (también la usa el resumen)
 * @param {string} title    título visible
 * @param {string} note     texto pequeño de la derecha, ya como HTML
 * @param {string} body     contenido de la sección, ya como HTML
 */
function renderSection({ id, title, note, body }) {
  return `
  <section id="${id}">
    <h2 class="section__head-wrap">
      <button type="button" class="section__toggle" aria-expanded="true" aria-controls="${id}-body">
        <span class="section__titles">
          <span class="section__title">${title}</span>
          ${note}
        </span>
        <span class="section__chevron" aria-hidden="true">▼</span>
      </button>
    </h2>
    <div class="section__body" id="${id}-body">${body}</div>
  </section>`
}

function renderChart(rows) {
  if (rows.length === 0) {
    return '<p class="empty">Aún no hay muestras suficientes para calcular precios medios por municipio.</p>'
  }
  const max = Math.max(...rows.map((row) => row.median))

  return `
    <div class="chart" role="img" aria-label="Precio mediano por metro cuadrado construido en cada municipio">
      ${rows
        .map(
          (row) => `
        <div class="chart__row" tabindex="0" title="${escape(row.municipality)}: ${new Intl.NumberFormat('es-ES').format(row.median)} €/m² · ${row.count} anuncios">
          <span class="chart__label">${escape(row.municipality)}</span>
          <span class="chart__track"><span class="chart__bar" style="width:${Math.max(2, (row.median / max) * 100)}%"></span></span>
          <span class="chart__value">${new Intl.NumberFormat('es-ES').format(row.median)}<span class="chart__unit"> €/m²</span></span>
          <span class="chart__count">${row.count}</span>
        </div>`,
        )
        .join('')}
    </div>`
}

function renderSources(sources) {
  const label = {
    ok: 'Correcto',
    'vacío': 'Sin resultados',
    error: 'Error',
    robots: 'Bloqueado por robots.txt',
  }
  return `
    <table class="sources">
      <thead><tr><th>Fuente</th><th>Anuncios</th><th>Peticiones</th><th>Estado</th></tr></thead>
      <tbody>
        ${sources
          .map(
            (source) => `
          <tr class="${source.status === 'ok' ? '' : 'sources__warn'}">
            <td>${escape(source.agency)}</td>
            <td class="num">${source.listings}</td>
            <td class="num">${source.requests ?? '—'}</td>
            <td>${escape(label[source.status] ?? source.status)}${source.error ? `: ${escape(source.error)}` : ''}</td>
          </tr>`,
          )
          .join('')}
      </tbody>
    </table>`
}

export function renderReport({ daily, listings, thumbnails, maxPrice }) {
  const BUDGET = Number.isFinite(maxPrice) ? maxPrice : DEFAULT_BUDGET
  const active = listings.filter((item) => item.status !== 'removed')
  const additions = dedupeForDisplay([...daily.additions].sort((a, b) => b.price - a.price))
  const municipalities = [...new Set(active.map((item) => item.municipality))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const agencies = [...new Set(additions.map((item) => item.agency))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const chartRows = pricePerM2ByMunicipality(active)
  const typesPresent = (items) =>
    Object.keys(TYPE_LABELS).filter((type) => items.some((item) => item.type === type))
  const additionTypes = typesPresent(additions)
  const readableDate = LONG_DATE.format(new Date(`${daily.date}T12:00:00`))

  // Todo lo que esté por debajo del presupuesto, parcelas incluidas: quien
  // busca barato en la comarca también mira solares. El filtro de tipo permite
  // dejarlas fuera de un vistazo.
  const budgetAll = active.filter((item) => item.price <= BUDGET).sort((a, b) => a.price - b.price)
  const budget = dedupeForDisplay(budgetAll)
  const budgetMerged = budgetAll.length - budget.length
  const budgetMunicipalities = [...new Set(budget.map((item) => item.municipality))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const budgetAgencies = [...new Set(budget.map((item) => item.agency))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const budgetTypes = typesPresent(budget)

  return `<meta charset="utf-8">
<title>Novedades inmobiliarias · Marina Alta</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #f5f8f8;
    --surface: #ffffff;
    --surface-sunk: #eef3f3;
    --ink: #0e1d20;
    --ink-muted: #5c7176;
    --line: #d9e3e3;
    --accent: #0b6e73;
    --accent-soft: #e0efef;
    --drop: #2c7a57;
    --rise: #a9522a;
    --rise-soft: #f6e9e2;
    --sold: #6b7679;
    --sold-soft: #ebefef;
    --radius: 10px;
    --display: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif;
    --body: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root {
      --bg: #0a1213;
      --surface: #111d1f;
      --surface-sunk: #0e181a;
      --ink: #e6eeee;
      --ink-muted: #8fa4a7;
      --line: #203033;
      --accent: #58b8bc;
      --accent-soft: #14292b;
      --drop: #56b184;
      --rise: #d08355;
      --rise-soft: #2c1f18;
      --sold: #8a9599;
      --sold-soft: #1b2426;
    }
  }
  :root[data-theme="dark"] {
    --bg: #0a1213;
    --surface: #111d1f;
    --surface-sunk: #0e181a;
    --ink: #e6eeee;
    --ink-muted: #8fa4a7;
    --line: #203033;
    --accent: #58b8bc;
    --accent-soft: #14292b;
    --drop: #56b184;
    --rise: #d08355;
    --rise-soft: #2c1f18;
    --sold: #8a9599;
    --sold-soft: #1b2426;
  }
  :root[data-theme="light"] {
    --bg: #f5f8f8;
    --surface: #ffffff;
    --surface-sunk: #eef3f3;
    --ink: #0e1d20;
    --ink-muted: #5c7176;
    --line: #d9e3e3;
    --accent: #0b6e73;
    --accent-soft: #e0efef;
    --drop: #2c7a57;
    --rise: #a9522a;
    --rise-soft: #f6e9e2;
    --sold: #6b7679;
    --sold-soft: #ebefef;
  }

  body {
    margin: 0;
    background: var(--bg);
    color: var(--ink);
    font-family: var(--body);
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
  }
  .wrap { max-width: 1180px; margin: 0 auto; padding: clamp(20px, 4vw, 44px) clamp(16px, 4vw, 32px) 64px; display: flex; flex-direction: column; gap: 40px; }
  a { color: var(--accent); }
  h1, h2, h3 { font-family: var(--display); font-weight: 600; text-wrap: balance; margin: 0; }

  .masthead { display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--line); padding-bottom: 20px; }
  .masthead__eyebrow { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
  .masthead h1 { font-size: clamp(1.8rem, 4vw, 2.5rem); letter-spacing: -0.01em; }
  .masthead__date { color: var(--ink-muted); font-size: 0.95rem; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .tile {
    background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius);
    padding: 16px 18px; display: flex; flex-direction: column; gap: 4px;
    color: inherit; text-decoration: none; position: relative;
  }
  a.tile { cursor: pointer; }
  a.tile:hover { border-color: var(--accent); }
  a.tile:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  /* La flecha solo aparece donde se puede ir a algún sitio. */
  a.tile::after {
    content: "→"; position: absolute; top: 14px; right: 14px;
    font-size: 0.85rem; color: var(--ink-muted); opacity: 0; transition: opacity 120ms ease;
  }
  a.tile:hover::after, a.tile:focus-visible::after { opacity: 1; }
  .tile--empty { opacity: 0.6; }

  /* Destello al llegar a la sección desde una cifra. */
  section:target .section__toggle, .section--jumped .section__toggle {
    box-shadow: inset 0 -2px 0 var(--accent);
  }
  @media (prefers-reduced-motion: no-preference) {
    html { scroll-behavior: smooth; }
    a.tile { transition: border-color 120ms ease; }
  }
  .tile__value { font-family: var(--display); font-size: 2rem; font-variant-numeric: tabular-nums; line-height: 1; }
  .tile__label { font-size: 0.8rem; color: var(--ink-muted); }
  .tile--accent { border-color: var(--accent); background: var(--accent-soft); }
  .tile--drop .tile__value { color: var(--drop); }
  .tile--rise .tile__value { color: var(--rise); }

  section { display: flex; flex-direction: column; gap: 16px; }
  .section__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
  .section__head h2 { font-size: 1.35rem; }
  .section__note { color: var(--ink-muted); font-size: 0.85rem; }

  /* La cabecera pliega su sección: los listados son largos y hay que poder
     saltarlos para llegar al siguiente bloque. */
  .section__toggle {
    display: flex; align-items: baseline; justify-content: space-between;
    gap: 12px; flex-wrap: wrap; width: 100%;
    background: none; border: 0; padding: 0 0 8px; margin: 0;
    color: inherit; font: inherit; text-align: left; cursor: pointer;
    border-bottom: 1px solid var(--line);
  }
  .section__head-wrap { margin: 0; font-weight: inherit; }
  .section__title { font-family: var(--display); font-size: 1.35rem; font-weight: 600; }
  .section__toggle:hover .section__title { color: var(--accent); }
  .section__toggle:focus-visible { outline: 2px solid var(--accent); outline-offset: 4px; }
  .section__titles { display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap; }
  .section__chevron {
    flex: none; color: var(--ink-muted); font-size: 0.8rem; line-height: 1;
    transform: rotate(0deg);
  }
  @media (prefers-reduced-motion: no-preference) {
    .section__chevron { transition: transform 150ms ease; }
  }
  .section__toggle[aria-expanded="false"] .section__chevron { transform: rotate(-90deg); }
  .section__body[hidden] { display: none; }
  .section__body { display: flex; flex-direction: column; gap: 16px; }

  .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: flex-end; }
  .filters__price { display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
  .filters input {
    font: inherit; font-size: 0.9rem; color: var(--ink); background: var(--surface);
    border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; min-width: 150px;
  }
  .filters__sort { display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
  .filters__sort select {
    font: inherit; font-size: 0.9rem; color: var(--ink); background: var(--surface);
    border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; min-width: 200px;
  }
  .filters__sort select:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .filters__clear {
    font: inherit; font-size: 0.82rem; cursor: pointer; color: var(--accent);
    background: none; border: 1px solid var(--accent); border-radius: 8px; padding: 7px 12px;
  }

  /* Filtro de selección múltiple: desplegable con casillas. */
  .multi { position: relative; }
  .multi > summary {
    list-style: none; cursor: pointer; display: flex; flex-direction: column; gap: 4px;
    border: 1px solid var(--line); border-radius: 8px; padding: 6px 30px 6px 10px;
    background: var(--surface); min-width: 158px; position: relative;
  }
  .multi > summary::-webkit-details-marker { display: none; }
  .multi > summary::after {
    content: ""; position: absolute; right: 12px; top: calc(50% - 2px);
    border: 4px solid transparent; border-top-color: var(--ink-muted);
  }
  .multi[open] > summary { border-color: var(--accent); }
  .multi--active > summary { border-color: var(--accent); background: var(--accent-soft); }
  .multi__label { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
  .multi__value { font-size: 0.9rem; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 190px; }
  .multi__panel {
    position: absolute; z-index: 20; top: calc(100% + 4px); left: 0; min-width: 100%;
    max-height: 280px; overflow-y: auto; background: var(--surface);
    border: 1px solid var(--line); border-radius: 8px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14);
    padding: 6px; display: flex; flex-direction: column;
  }
  .multi__option { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; font-size: 0.88rem; white-space: nowrap; }
  .multi__option:hover { background: var(--surface-sunk); }
  .multi__option input { min-width: 0; accent-color: var(--accent); }
  .filters input:focus-visible, .multi > summary:focus-visible, .multi__option input:focus-visible,
  .filters__clear:focus-visible, .chart__row:focus-visible, a:focus-visible, .toast button:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 14px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .card { padding-top: 0; overflow: hidden; }
  .card__also { font-size: 0.78rem; color: var(--ink-muted); }
  .card__also summary { cursor: pointer; }
  .card__also summary:hover { color: var(--accent); }
  .card__also ul { list-style: none; margin: 6px 0 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
  .card__also a { color: var(--accent); }
  .card__photo { display: block; margin: 0 -16px 4px; background: var(--surface-sunk); }
  .card__photo img { display: block; width: 100%; height: 168px; object-fit: cover; }
  .card--sold .card__photo img { filter: saturate(0.45); }
  .card__head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-top: 16px; }
  .card__photo + .card__head { padding-top: 0; }
  .chip { font-size: 0.7rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
  .chip--reserved { color: var(--rise); background: var(--rise-soft); }
  .chip--sold { color: var(--sold); background: var(--sold-soft); }
  .card--sold { opacity: 0.72; }
  .card--sold .card__price { text-decoration: line-through; text-decoration-thickness: 1px; }
  .card__place { font-size: 0.82rem; color: var(--ink-muted); text-align: right; margin-left: auto; }
  .card__price { font-family: var(--display); font-size: 1.5rem; font-variant-numeric: tabular-nums; margin: 0; }
  .card__unit { font-family: var(--mono); font-size: 0.76rem; color: var(--ink-muted); margin: -6px 0 0; }
  .card__title { font-family: var(--body); font-size: 0.92rem; font-weight: 500; line-height: 1.35; }
  .card__facts { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px 10px; font-size: 0.8rem; color: var(--ink-muted); font-variant-numeric: tabular-nums; }
  .card__foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--line); font-size: 0.8rem; }
  .card__agency { color: var(--ink-muted); }
  .card__link { text-decoration: none; font-weight: 600; white-space: nowrap; }
  .card__link:hover { text-decoration: underline; }

  .movements { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .movements__note { display: flex; align-items: center; gap: 10px; margin: 0; font-size: 0.85rem; color: var(--ink-muted); }
  .movements__note button {
    font: inherit; font-size: 0.82rem; cursor: pointer; color: var(--accent);
    background: none; border: 1px solid var(--accent); border-radius: 8px; padding: 5px 10px;
  }
  .movement { background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--line); border-radius: var(--radius); padding: 12px 16px; display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .movement--drop { border-left-color: var(--drop); }
  .movement--rise { border-left-color: var(--rise); }
  .movement__main { display: flex; flex-direction: column; gap: 2px; min-width: 240px; flex: 1; }
  .movement__place { font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-muted); }
  .movement__main a { font-size: 0.92rem; text-decoration: none; }
  .movement__main a:hover { text-decoration: underline; }
  .movement__numbers { display: flex; align-items: baseline; gap: 12px; font-variant-numeric: tabular-nums; font-family: var(--mono); font-size: 0.88rem; }
  .movement__was { color: var(--ink-muted); text-decoration: line-through; }
  .movement__now { font-size: 1.05rem; font-weight: 600; }
  .movement--drop .movement__delta { color: var(--drop); }
  .movement--rise .movement__delta { color: var(--rise); }

  .chart { display: flex; flex-direction: column; gap: 6px; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; }
  .chart__row { display: grid; grid-template-columns: minmax(120px, 1.1fr) 3fr auto 42px; align-items: center; gap: 12px; font-size: 0.85rem; border-radius: 6px; }
  .chart__label { color: var(--ink); }
  .chart__track { background: var(--surface-sunk); border-radius: 4px; height: 12px; overflow: hidden; }
  .chart__bar { display: block; height: 100%; background: var(--accent); border-radius: 0 4px 4px 0; }
  .chart__value { font-family: var(--mono); font-variant-numeric: tabular-nums; text-align: right; }
  .chart__unit { color: var(--ink-muted); }
  .chart__count { font-family: var(--mono); font-size: 0.75rem; color: var(--ink-muted); text-align: right; }

  .sources { width: 100%; border-collapse: collapse; font-size: 0.85rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
  .sources th, .sources td { text-align: left; padding: 9px 14px; border-bottom: 1px solid var(--line); }
  .sources th { font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); font-weight: 600; }
  .sources tr:last-child td { border-bottom: none; }
  .sources .num { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .sources__warn td:last-child { color: var(--rise); }
  .table-scroll { overflow-x: auto; }

  .empty { color: var(--ink-muted); background: var(--surface); border: 1px dashed var(--line); border-radius: var(--radius); padding: 20px; margin: 0; text-align: center; font-size: 0.9rem; }
  footer.page { border-top: 1px solid var(--line); padding-top: 16px; color: var(--ink-muted); font-size: 0.8rem; display: flex; flex-direction: column; gap: 6px; }
  [hidden] { display: none !important; }

  /* Volver arriba: flota sobre el contenido en cuanto se baja un poco. */
  .to-top {
    position: fixed; right: 20px; bottom: 20px; z-index: 40;
    width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 1.1rem; line-height: 1;
    color: var(--accent); background: var(--surface);
    border: 1px solid var(--accent); box-shadow: 0 4px 16px rgb(0 0 0 / 0.16);
  }
  .to-top:hover { background: var(--accent-soft); }
  .to-top:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  @supports (padding: env(safe-area-inset-bottom)) {
    .to-top { bottom: calc(20px + env(safe-area-inset-bottom)); }
  }

  /* Aviso para cuando el visor del artefacto bloquea abrir pestañas nuevas. */
  .toast {
    position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%);
    max-width: min(560px, calc(100vw - 32px)); z-index: 50;
    background: var(--surface); color: var(--ink);
    border: 1px solid var(--accent); border-radius: var(--radius);
    box-shadow: 0 8px 28px rgb(0 0 0 / 0.18);
    padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
  }
  .toast__title { font-size: 0.9rem; font-weight: 600; }
  .toast__url {
    font-family: var(--mono); font-size: 0.78rem; color: var(--ink-muted);
    background: var(--surface-sunk); border-radius: 6px; padding: 8px 10px;
    word-break: break-all; user-select: all;
  }
  .toast__actions { display: flex; gap: 8px; justify-content: flex-end; }
  .toast button {
    font: inherit; font-size: 0.82rem; cursor: pointer;
    border: 1px solid var(--line); background: var(--surface); color: var(--ink);
    border-radius: 8px; padding: 6px 12px;
  }
  .toast button.primary { border-color: var(--accent); color: var(--accent); font-weight: 600; }
  @media (prefers-reduced-motion: no-preference) { .card, .movement { transition: border-color 120ms ease; } }
  .card:hover { border-color: var(--accent); }
</style>

<div class="wrap">
  <header class="masthead">
    <span class="masthead__eyebrow">Marina Alta · venta</span>
    <h1>Novedades inmobiliarias</h1>
    <p class="masthead__date">${escape(readableDate)}</p>
  </header>

  <div class="tiles">
    ${tile({ value: daily.totals.additions, label: 'altas nuevas', target: 'altas', variant: 'accent' })}
    ${tile({ value: daily.totals.priceDrops, label: 'bajadas de precio', target: 'cambios', variant: 'drop', movement: 'drop' })}
    ${tile({ value: daily.totals.priceRises, label: 'subidas de precio', target: 'cambios', variant: 'rise', movement: 'rise' })}
    ${tile({ value: daily.totals.removals, label: 'retiradas', target: 'retirados' })}
    ${tile({ value: active.length, label: 'en seguimiento', target: 'fuentes' })}
  </div>

  ${renderSection({
    id: 'altas',
    title: 'Altas de hoy',
    note: `<span class="section__note" id="count">${additions.length} anuncios</span>`,
    body:
      additions.length === 0
        ? `<p class="empty">${
            daily.bootstrap
              ? 'Primera carga: se ha registrado el inventario de partida, así que hoy no hay altas que comparar. A partir de mañana aparecerá aquí lo que se publique cada día.'
              : 'Hoy no ha aparecido ningún anuncio nuevo en las fuentes vigiladas.'
          }</p>`
        : `<div class="filters">
      ${multiFilter({ id: 'f-municipality', label: 'Municipio', options: toOptions(municipalities) })}
      ${multiFilter({ id: 'f-type', label: 'Tipo', options: toOptions(additionTypes, TYPE_LABELS) })}
      ${multiFilter({ id: 'f-agency', label: 'Agencia', options: toOptions(agencies), allLabel: 'Todas' })}
      ${multiFilter({ id: 'f-status', label: 'Estado', options: statusOptions(additions) })}
      <label class="filters__price">Precio máximo<input id="f-max" type="number" inputmode="numeric" step="25000" placeholder="sin límite"></label>
      ${sortSelect('f-sort')}
      <button type="button" class="filters__clear" id="f-clear" hidden>Quitar filtros</button>
    </div>
    <div class="grid" id="grid">${additions.map((item) => renderCard(item, thumbnails)).join('')}</div>
    <p class="empty" id="no-match" hidden>Ningún anuncio de hoy encaja con estos filtros.</p>`,
  })}

  ${renderSection({
    id: 'inmuebles',
    title: `Por debajo de ${euros(BUDGET)}`,
    note:
      `<span class="section__note" id="b-count">${budget.length} inmuebles</span>` +
      (budgetMerged > 0
        ? `<span class="section__note">${budgetMerged} fichas repetidas agrupadas en su vivienda</span>`
        : ''),
    body:
      budget.length === 0
        ? `<p class="empty">Ahora mismo no hay nada por debajo de ${euros(BUDGET)} en el inventario.</p>`
        : `<div class="filters">
      ${multiFilter({ id: 'b-municipality', label: 'Municipio', options: toOptions(budgetMunicipalities) })}
      ${multiFilter({ id: 'b-type', label: 'Tipo', options: toOptions(budgetTypes, TYPE_LABELS) })}
      ${multiFilter({ id: 'b-agency', label: 'Agencia', options: toOptions(budgetAgencies), allLabel: 'Todas' })}
      ${multiFilter({ id: 'b-status', label: 'Estado', options: statusOptions(budget) })}
      <label class="filters__price">Precio máximo<input id="b-max" type="number" inputmode="numeric" step="10000" placeholder="${BUDGET}"></label>
      ${sortSelect('b-sort')}
      <button type="button" class="filters__clear" id="b-clear" hidden>Quitar filtros</button>
    </div>
    <div class="grid" id="b-grid">${budget.map((item) => renderCard(item, thumbnails)).join('')}</div>
    <p class="empty" id="b-no-match" hidden>Ningún inmueble encaja con estos filtros.</p>`,
  })}

  ${renderSection({
    id: 'cambios',
    title: 'Cambios de precio',
    note: '<span class="section__note">frente al último rastreo</span>',
    body:
      daily.priceDrops.length + daily.priceRises.length === 0
        ? '<p class="empty">Ningún anuncio en seguimiento ha cambiado de precio.</p>'
        : `<p class="movements__note" id="movements-note" hidden>
             <span id="movements-note-text"></span>
             <button type="button" id="movements-all">Ver todos los cambios</button>
           </p>
           <ul class="movements" id="movements">${[...daily.priceDrops, ...daily.priceRises].map(renderPriceRow).join('')}</ul>`,
  })}

  ${renderSection({
    id: 'preciom2',
    title: 'Precio por metro cuadrado',
    note: '<span class="section__note">mediana de lo que se sigue, que es el tramo bajo del mercado</span>',
    body: renderChart(chartRows),
  })}

  ${renderSection({
    id: 'retirados',
    title: 'Anuncios retirados',
    note: '<span class="section__note">sin aparecer en tres rastreos seguidos</span>',
    body:
      daily.removals.length === 0
        ? '<p class="empty">Ningún anuncio ha desaparecido de las fuentes.</p>'
        : `<ul class="movements">${daily.removals
            .map(
              (item) => `<li class="movement"><div class="movement__main"><span class="movement__place">${escape(item.municipality)}</span><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.title ?? item.url)}</a></div><div class="movement__numbers"><span class="movement__now">${euros(item.price)}</span></div></li>`,
            )
            .join('')}</ul>`,
  })}

  ${renderSection({
    id: 'fuentes',
    title: 'Estado del rastreo',
    note: '<span class="section__note">una fuente en cero suele significar que ha cambiado su web</span>',
    body: `<div class="table-scroll">${renderSources(daily.sources)}</div>`,
  })}

  <button type="button" class="to-top" id="to-top" hidden aria-label="Volver arriba">
    <span aria-hidden="true">↑</span>
  </button>

  <div class="toast" id="toast" role="dialog" aria-live="polite" hidden>
    <span class="toast__title" id="toast-title">Este visor no deja abrir pestañas nuevas</span>
    <span class="toast__url" id="toast-url"></span>
    <div class="toast__actions">
      <button type="button" id="toast-copy" class="primary">Copiar enlace</button>
      <button type="button" id="toast-close">Cerrar</button>
    </div>
  </div>

  <footer class="page">
    <span>Datos recogidos de las webs públicas de las agencias y del portal ThinkSpain, respetando su robots.txt. Cada anuncio enlaza a su ficha original.</span>
    <span>Generado el ${escape(new Date(daily.generatedAt ?? Date.now()).toLocaleString('es-ES'))}.</span>
  </footer>
</div>

<script>
  (function () {
    function wire(prefix, gridId, countId, emptyId, singular, plural) {
      var grid = document.getElementById(gridId);
      if (!grid) return;

      var cards = Array.prototype.slice.call(grid.children);
      var count = document.getElementById(countId);
      var empty = document.getElementById(emptyId);
      var max = document.getElementById(prefix + 'max');
      var clear = document.getElementById(prefix + 'clear');
      var sort = document.getElementById(prefix + 'sort');
      var filtros = ['municipality', 'type', 'agency', 'status'].map(function (name) {
        return document.getElementById(prefix + name);
      });

      function seleccionados(filtro) {
        if (!filtro) return [];
        return Array.prototype.slice
          .call(filtro.querySelectorAll('input:checked'))
          .map(function (input) { return input.value; });
      }

      // El resumen dice qué hay elegido: un nombre si es uno, "3 elegidos" si
      // son varios, y el texto por defecto cuando no hay ninguno.
      function refrescarResumen(filtro) {
        if (!filtro) return false;
        var elegidos = seleccionados(filtro);
        var valor = filtro.querySelector('.multi__value');
        if (elegidos.length === 0) {
          valor.textContent = filtro.dataset.all;
        } else if (elegidos.length === 1) {
          var marcado = filtro.querySelector('input:checked');
          valor.textContent = marcado.nextElementSibling.textContent;
        } else {
          valor.textContent = elegidos.length + ' elegidos';
        }
        filtro.classList.toggle('multi--active', elegidos.length > 0);
        return elegidos.length > 0;
      }

      // Lo que no tiene el dato (un piso sin m², una casa sin parcela) se va al
      // final en vez de contar como cero, que lo pondría el primero.
      function comparar(criterio) {
        var campo = { 'price-asc': 'price', 'price-desc': 'price', 'unit-asc': 'unit',
          'built-desc': 'built', 'plot-desc': 'plot', 'seen-desc': 'seen',
          'municipality-asc': 'municipality' }[criterio];
        var descendente = criterio.slice(-4) === 'desc';

        return function (a, b) {
          var x = a.dataset[campo];
          var y = b.dataset[campo];
          if (!x && !y) return 0;
          if (!x) return 1;
          if (!y) return -1;

          if (campo === 'municipality' || campo === 'seen') {
            var texto = String(x).localeCompare(String(y), 'es');
            return descendente ? -texto : texto;
          }
          return descendente ? Number(y) - Number(x) : Number(x) - Number(y);
        };
      }

      function ordenar() {
        if (!sort) return;
        var ordenadas = cards.slice().sort(comparar(sort.value));
        ordenadas.forEach(function (card) { grid.appendChild(card); });
      }

      function apply() {
        var elegidos = filtros.map(seleccionados);
        var tope = parseInt(max.value, 10);
        var visible = 0;

        cards.forEach(function (card) {
          var datos = [
            card.dataset.municipality,
            card.dataset.type,
            card.dataset.agency,
            card.dataset.status,
          ];
          // Sin nada marcado en un filtro, ese filtro no descarta nada.
          var ok = elegidos.every(function (valores, i) {
            return valores.length === 0 || valores.indexOf(datos[i]) !== -1;
          });
          if (ok && tope) ok = parseInt(card.dataset.price, 10) <= tope;

          card.hidden = !ok;
          if (ok) visible += 1;
        });

        var alguno = false;
        filtros.forEach(function (filtro) {
          if (refrescarResumen(filtro)) alguno = true;
        });
        if (clear) clear.hidden = !alguno && !max.value;

        count.textContent = visible + ' ' + (visible === 1 ? singular : plural);
        empty.hidden = visible !== 0;
      }

      filtros.forEach(function (filtro) {
        if (filtro) filtro.addEventListener('change', apply);
      });
      max.addEventListener('input', apply);
      if (sort) {
        sort.addEventListener('change', function () {
          ordenar();
          apply();
        });
      }

      if (clear) {
        clear.addEventListener('click', function () {
          filtros.forEach(function (filtro) {
            if (!filtro) return;
            Array.prototype.slice.call(filtro.querySelectorAll('input')).forEach(function (input) {
              input.checked = false;
            });
          });
          max.value = '';
          apply();
        });
      }

      apply();
    }

    // Volver arriba: aparece al bajar y se aparta cuando hay un aviso abajo,
    // para no montarse encima.
    var arriba = document.getElementById('to-top');
    var toastAbierto = false;

    function refrescarBotonArriba() {
      var bajado = (window.scrollY || document.documentElement.scrollTop) > 600;
      arriba.hidden = !bajado || toastAbierto;
    }

    arriba.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      // En un visor que no soporte scroll suave, al menos que suba.
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    });
    window.addEventListener('scroll', refrescarBotonArriba, { passive: true });
    refrescarBotonArriba();

    // Las cifras del resumen llevan a su sección; las de precio, además,
    // dejan a la vista solo las bajadas o solo las subidas.
    var movimientos = document.getElementById('movements');
    var nota = document.getElementById('movements-note');
    var notaTexto = document.getElementById('movements-note-text');
    var verTodos = document.getElementById('movements-all');

    function filtrarMovimientos(tipo) {
      if (!movimientos) return;
      var filas = Array.prototype.slice.call(movimientos.children);
      var visibles = 0;
      filas.forEach(function (fila) {
        var ok = !tipo || fila.dataset.movement === tipo;
        fila.hidden = !ok;
        if (ok) visibles += 1;
      });
      if (!nota) return;
      nota.hidden = !tipo;
      if (tipo) {
        notaTexto.textContent =
          'Mostrando ' + visibles + (tipo === 'drop' ? ' bajadas' : ' subidas') + ' de precio.';
      }
    }

    if (verTodos) {
      verTodos.addEventListener('click', function () {
        filtrarMovimientos(null);
      });
    }

    // Secciones plegables. El listado de inmuebles ocupa cientos de tarjetas,
    // así que hay que poder cerrarlo para llegar al bloque siguiente. Lo que
    // cada quien deje plegado se recuerda en su propio navegador.
    var PLEGADAS = 'marina-alta:plegadas';

    function leerPlegadas() {
      try {
        return JSON.parse(window.localStorage.getItem(PLEGADAS)) || [];
      } catch (error) {
        // Ventana privada o almacenamiento bloqueado: se abre todo, sin más.
        return [];
      }
    }

    function guardarPlegadas(lista) {
      try {
        window.localStorage.setItem(PLEGADAS, JSON.stringify(lista));
      } catch (error) {
        // Que no se pueda recordar no impide plegar y desplegar ahora.
      }
    }

    function plegar(seccion, cerrada) {
      var boton = seccion.querySelector('.section__toggle');
      var cuerpo = document.getElementById(seccion.id + '-body');
      if (!boton || !cuerpo) return;
      boton.setAttribute('aria-expanded', cerrada ? 'false' : 'true');
      cuerpo.hidden = cerrada;

      var lista = leerPlegadas().filter(function (id) { return id !== seccion.id; });
      if (cerrada) lista.push(seccion.id);
      guardarPlegadas(lista);
      // Al cerrar una sección larga la página encoge de golpe y el botón de
      // volver arriba puede sobrar.
      refrescarBotonArriba();
    }

    var guardadas = leerPlegadas();
    Array.prototype.slice.call(document.querySelectorAll('section[id]')).forEach(function (seccion) {
      var boton = seccion.querySelector('.section__toggle');
      if (!boton) return;
      if (guardadas.indexOf(seccion.id) !== -1) plegar(seccion, true);
      boton.addEventListener('click', function () {
        plegar(seccion, boton.getAttribute('aria-expanded') === 'true');
      });
    });

    Array.prototype.slice.call(document.querySelectorAll('a.tile')).forEach(function (tile) {
      tile.addEventListener('click', function () {
        var destino = document.querySelector(tile.getAttribute('href'));
        if (!destino) return;
        // Saltar a una sección plegada no puede dejarte mirando una cabecera
        // cerrada: se abre antes de llevarte allí.
        plegar(destino, false);
        filtrarMovimientos(tile.dataset.movement || null);
        // El resaltado de :target no se dispara si ya estabas en esa sección.
        Array.prototype.slice.call(document.querySelectorAll('.section--jumped')).forEach(
          function (previa) { previa.classList.remove('section--jumped'); },
        );
        destino.classList.add('section--jumped');
      });
    });

    // Un desplegable abierto se cierra al abrir otro o al pulsar fuera.
    document.addEventListener('click', function (event) {
      Array.prototype.slice.call(document.querySelectorAll('details.multi[open]')).forEach(
        function (abierto) {
          if (!abierto.contains(event.target)) abierto.open = false;
        },
      );
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      Array.prototype.slice.call(document.querySelectorAll('details.multi[open]')).forEach(
        function (abierto) { abierto.open = false; },
      );
    });

    wire('f-', 'grid', 'count', 'no-match', 'anuncio', 'anuncios');
    wire('b-', 'b-grid', 'b-count', 'b-no-match', 'inmueble', 'inmuebles');

    // El informe se ve dentro de un visor que puede tener prohibido abrir
    // pestañas nuevas. Cuando es así, un enlace normal no hace absolutamente
    // nada al pulsarlo, así que se ofrece el enlace para copiar y pegar.
    var toast = document.getElementById('toast');
    var toastUrl = document.getElementById('toast-url');
    var toastTitle = document.getElementById('toast-title');
    var copiar = document.getElementById('toast-copy');
    var cerrar = document.getElementById('toast-close');
    var pendiente = '';

    function mostrar(url) {
      pendiente = url;
      toastUrl.textContent = url;
      toastTitle.textContent = 'Este visor no deja abrir pestañas nuevas';
      toast.hidden = false;
      toastAbierto = true;
      refrescarBotonArriba();
      copiar.focus();
    }

    function copiarAlPortapapeles(texto) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(texto);
      }
      return Promise.reject();
    }

    document.addEventListener('click', function (event) {
      var enlace = event.target.closest && event.target.closest('a[href^="http"]');
      if (!enlace) return;

      // Se abre siempre desde aquí para no duplicar pestañas cuando sí se puede.
      event.preventDefault();
      var abierta = null;
      try {
        // Sin 'noopener' en las features: con esa opción el navegador devuelve
        // null aunque haya abierto la pestaña, y no habría forma de distinguir
        // "abierta" de "bloqueada". La referencia se corta después.
        abierta = window.open(enlace.href, '_blank');
      } catch (error) {
        abierta = null;
      }

      if (abierta) {
        try {
          abierta.opener = null;
        } catch (error) {
          // Da igual: la pestaña ya está abierta, que es lo que importa.
        }
        return;
      }
      mostrar(enlace.href);
    });

    copiar.addEventListener('click', function () {
      copiarAlPortapapeles(pendiente).then(
        function () {
          toastTitle.textContent = 'Enlace copiado: pégalo en una pestaña nueva';
        },
        function () {
          toastTitle.textContent = 'Copia el enlace a mano:';
          var rango = document.createRange();
          rango.selectNodeContents(toastUrl);
          var seleccion = window.getSelection();
          seleccion.removeAllRanges();
          seleccion.addRange(rango);
        },
      );
    });

    cerrar.addEventListener('click', function () {
      toast.hidden = true;
      toastAbierto = false;
      refrescarBotonArriba();
    });
    document.addEventListener('keydown', function (event) {
      if (event.key !== 'Escape') return;
      toast.hidden = true;
      toastAbierto = false;
      refrescarBotonArriba();
    });
  })();
</script>
`
}
