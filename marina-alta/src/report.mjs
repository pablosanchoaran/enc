/**
 * Genera el informe diario como una página HTML autocontenida: sin peticiones
 * externas, porque el artefacto publicado bloquea cualquier host de fuera.
 */

/** Umbral de la sección de vivienda asequible del informe. */
const BUDGET = 260_000

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
 * Opciones del filtro de estado. Arranca en "solo disponibles": una casa
 * vendida sigue publicada meses y no debería contar como oferta.
 */
function statusOptions(items) {
  const counts = items.reduce((tally, item) => {
    const status = item.saleStatus ?? 'available'
    tally[status] = (tally[status] ?? 0) + 1
    return tally
  }, {})

  const options = [
    ['available', `Solo disponibles (${counts.available ?? 0})`],
    ['', `Todos, incluidos vendidos (${items.length})`],
    ['reserved', `Solo reservados (${counts.reserved ?? 0})`],
    ['sold', `Solo vendidos (${counts.sold ?? 0})`],
  ]
  return options
    .filter(([value]) => value === '' || value === 'available' || counts[value] > 0)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('')
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
    <article class="card card--${status}" data-municipality="${escape(item.municipality)}" data-type="${escape(item.type)}" data-agency="${escape(item.agency)}" data-price="${item.price}" data-status="${status}">
      ${thumb ? `<a class="card__photo" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer"><img src="${thumb}" alt="" loading="lazy" width="320" height="214"></a>` : ''}
      <div class="card__head">
        <span class="chip">${escape(TYPE_LABELS[item.type] ?? item.type)}</span>
        ${status === 'available' ? '' : `<span class="chip chip--${status}">${STATUS_LABELS[status]}</span>`}
        <span class="card__place">${escape(item.municipality)}</span>
      </div>
      <p class="card__price">${euros(item.price)}</p>
      ${item.pricePerM2 ? `<p class="card__unit">${new Intl.NumberFormat('es-ES').format(item.pricePerM2)} €/m²</p>` : ''}
      <h3 class="card__title">${escape(item.title ?? 'Sin título')}</h3>
      ${facts.length ? `<ul class="card__facts">${facts.map((fact) => `<li>${escape(fact)}</li>`).join('')}</ul>` : ''}
      <footer class="card__foot">
        <span class="card__agency">${escape(item.agency)}</span>
        <a class="card__link" href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">Ver ficha →</a>
      </footer>
    </article>`
}

function renderPriceRow(item) {
  const isDrop = item.direction === 'drop'
  return `
    <li class="movement ${isDrop ? 'movement--drop' : 'movement--rise'}">
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

export function renderReport({ daily, listings, thumbnails }) {
  const active = listings.filter((item) => item.status !== 'removed')
  const additions = [...daily.additions].sort((a, b) => b.price - a.price)
  const municipalities = [...new Set(active.map((item) => item.municipality))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const agencies = [...new Set(additions.map((item) => item.agency))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const chartRows = pricePerM2ByMunicipality(active)
  const readableDate = LONG_DATE.format(new Date(`${daily.date}T12:00:00`))

  // Todo lo que esté por debajo del presupuesto, parcelas incluidas: quien
  // busca barato en la comarca también mira solares. El filtro de tipo permite
  // dejarlas fuera de un vistazo.
  const budget = active.filter((item) => item.price <= BUDGET).sort((a, b) => a.price - b.price)
  const budgetMunicipalities = [...new Set(budget.map((item) => item.municipality))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )
  const budgetAgencies = [...new Set(budget.map((item) => item.agency))].sort((a, b) =>
    a.localeCompare(b, 'es'),
  )

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
  .tile { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 18px; display: flex; flex-direction: column; gap: 4px; }
  .tile__value { font-family: var(--display); font-size: 2rem; font-variant-numeric: tabular-nums; line-height: 1; }
  .tile__label { font-size: 0.8rem; color: var(--ink-muted); }
  .tile--accent { border-color: var(--accent); background: var(--accent-soft); }
  .tile--drop .tile__value { color: var(--drop); }
  .tile--rise .tile__value { color: var(--rise); }

  section { display: flex; flex-direction: column; gap: 16px; }
  .section__head { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; border-bottom: 1px solid var(--line); padding-bottom: 8px; }
  .section__head h2 { font-size: 1.35rem; }
  .section__note { color: var(--ink-muted); font-size: 0.85rem; }

  .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .filters label { display: flex; flex-direction: column; gap: 4px; font-size: 0.72rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted); }
  .filters select, .filters input {
    font: inherit; font-size: 0.9rem; color: var(--ink); background: var(--surface);
    border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; min-width: 150px;
  }
  .filters select:focus-visible, .filters input:focus-visible, .chart__row:focus-visible, a:focus-visible {
    outline: 2px solid var(--accent); outline-offset: 2px;
  }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(272px, 1fr)); gap: 14px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; display: flex; flex-direction: column; gap: 8px; }
  .card { padding-top: 0; overflow: hidden; }
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
    <div class="tile tile--accent"><span class="tile__value">${daily.totals.additions}</span><span class="tile__label">altas nuevas</span></div>
    <div class="tile tile--drop"><span class="tile__value">${daily.totals.priceDrops}</span><span class="tile__label">bajadas de precio</span></div>
    <div class="tile tile--rise"><span class="tile__value">${daily.totals.priceRises}</span><span class="tile__label">subidas de precio</span></div>
    <div class="tile"><span class="tile__value">${daily.totals.removals}</span><span class="tile__label">retiradas</span></div>
    <div class="tile"><span class="tile__value">${active.length}</span><span class="tile__label">en seguimiento</span></div>
  </div>

  <section>
    <div class="section__head">
      <h2>Altas de hoy</h2>
      <span class="section__note" id="count">${additions.length} anuncios</span>
    </div>
    ${
      additions.length === 0
        ? `<p class="empty">${
            daily.bootstrap
              ? 'Primera carga: se ha registrado el inventario de partida, así que hoy no hay altas que comparar. A partir de mañana aparecerá aquí lo que se publique cada día.'
              : 'Hoy no ha aparecido ningún anuncio nuevo en las fuentes vigiladas.'
          }</p>`
        : `<div class="filters">
      <label>Municipio<select id="f-municipality"><option value="">Todos</option>${municipalities.map((name) => `<option>${escape(name)}</option>`).join('')}</select></label>
      <label>Tipo<select id="f-type"><option value="">Todos</option>${Object.entries(TYPE_LABELS).map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>
      <label>Agencia<select id="f-agency"><option value="">Todas</option>${agencies.map((name) => `<option>${escape(name)}</option>`).join('')}</select></label>
      <label>Estado<select id="f-status">${statusOptions(additions)}</select></label>
      <label>Precio máximo<input id="f-max" type="number" inputmode="numeric" step="25000" placeholder="sin límite"></label>
    </div>
    <div class="grid" id="grid">${additions.map((item) => renderCard(item, thumbnails)).join('')}</div>
    <p class="empty" id="no-match" hidden>Ningún anuncio de hoy encaja con estos filtros.</p>`
    }
  </section>

  <section>
    <div class="section__head">
      <h2>Por debajo de ${euros(BUDGET)}</h2>
      <span class="section__note" id="b-count">${budget.length} inmuebles</span>
    </div>
    ${
      budget.length === 0
        ? `<p class="empty">Ahora mismo no hay nada por debajo de ${euros(BUDGET)} en el inventario.</p>`
        : `<div class="filters">
      <label>Municipio<select id="b-municipality"><option value="">Todos</option>${budgetMunicipalities.map((name) => `<option>${escape(name)}</option>`).join('')}</select></label>
      <label>Tipo<select id="b-type"><option value="">Todos</option>${Object.entries(TYPE_LABELS).filter(([value]) => budget.some((item) => item.type === value)).map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></label>
      <label>Agencia<select id="b-agency"><option value="">Todas</option>${budgetAgencies.map((name) => `<option>${escape(name)}</option>`).join('')}</select></label>
      <label>Estado<select id="b-status">${statusOptions(budget)}</select></label>
      <label>Precio máximo<input id="b-max" type="number" inputmode="numeric" step="10000" placeholder="${BUDGET}"></label>
    </div>
    <div class="grid" id="b-grid">${budget.map((item) => renderCard(item, thumbnails)).join('')}</div>
    <p class="empty" id="b-no-match" hidden>Ningún inmueble encaja con estos filtros.</p>`
    }
  </section>

  <section>
    <div class="section__head">
      <h2>Cambios de precio</h2>
      <span class="section__note">frente al último rastreo</span>
    </div>
    ${
      daily.priceDrops.length + daily.priceRises.length === 0
        ? '<p class="empty">Ningún anuncio en seguimiento ha cambiado de precio.</p>'
        : `<ul class="movements">${[...daily.priceDrops, ...daily.priceRises].map(renderPriceRow).join('')}</ul>`
    }
  </section>

  <section>
    <div class="section__head">
      <h2>Precio por metro cuadrado</h2>
      <span class="section__note">mediana de lo que se sigue, que es el tramo bajo del mercado</span>
    </div>
    ${renderChart(chartRows)}
  </section>

  <section>
    <div class="section__head">
      <h2>Anuncios retirados</h2>
      <span class="section__note">sin aparecer en tres rastreos seguidos</span>
    </div>
    ${
      daily.removals.length === 0
        ? '<p class="empty">Ningún anuncio ha desaparecido de las fuentes.</p>'
        : `<ul class="movements">${daily.removals
            .map(
              (item) => `<li class="movement"><div class="movement__main"><span class="movement__place">${escape(item.municipality)}</span><a href="${escape(item.url)}" target="_blank" rel="noopener noreferrer">${escape(item.title ?? item.url)}</a></div><div class="movement__numbers"><span class="movement__now">${euros(item.price)}</span></div></li>`,
            )
            .join('')}</ul>`
    }
  </section>

  <section>
    <div class="section__head">
      <h2>Estado del rastreo</h2>
      <span class="section__note">una fuente en cero suele significar que ha cambiado su web</span>
    </div>
    <div class="table-scroll">${renderSources(daily.sources)}</div>
  </section>

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
      var controls = ['municipality', 'type', 'agency', 'status', 'max'].map(function (name) {
        return document.getElementById(prefix + name);
      });

      function apply() {
        var municipality = controls[0].value;
        var type = controls[1].value;
        var agency = controls[2].value;
        var status = controls[3].value;
        var max = parseInt(controls[4].value, 10);
        var visible = 0;

        cards.forEach(function (card) {
          var ok =
            (!municipality || card.dataset.municipality === municipality) &&
            (!type || card.dataset.type === type) &&
            (!agency || card.dataset.agency === agency) &&
            (!status || card.dataset.status === status) &&
            (!max || parseInt(card.dataset.price, 10) <= max);
          card.hidden = !ok;
          if (ok) visible += 1;
        });

        count.textContent = visible + ' ' + (visible === 1 ? singular : plural);
        empty.hidden = visible !== 0;
      }

      controls.forEach(function (control) {
        control.addEventListener('input', apply);
        control.addEventListener('change', apply);
      });

      apply();
    }

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
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') toast.hidden = true;
    });
  })();
</script>
`
}
