/**
 * Lectura y aplicación de robots.txt. El extractor no pide una URL sin haber
 * comprobado antes que el robots.txt del dominio la permite, y respeta el
 * Crawl-delay que declare.
 */

const CACHE = new Map()
const DEFAULT_DELAY_MS = 1000

function parseRobots(text) {
  const groups = []
  let current = null
  let lastWasAgent = false

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim()
    if (!line) continue
    const [rawField, ...rest] = line.split(':')
    const field = rawField.trim().toLowerCase()
    const value = rest.join(':').trim()

    if (field === 'user-agent') {
      // Varios User-agent seguidos comparten el mismo bloque de reglas.
      if (!current || !lastWasAgent) {
        current = { agents: [], allow: [], disallow: [], crawlDelay: null }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }

    if (!current) continue
    lastWasAgent = false
    if (field === 'allow' && value) current.allow.push(value)
    else if (field === 'disallow') current.disallow.push(value)
    else if (field === 'crawl-delay') {
      const seconds = Number.parseFloat(value)
      if (Number.isFinite(seconds)) current.crawlDelay = seconds * 1000
    }
  }
  return groups
}

/** Convierte un patrón de robots.txt (con * y $) en expresión regular. */
function patternToRegExp(pattern) {
  const anchored = pattern.endsWith('$')
  const body = anchored ? pattern.slice(0, -1) : pattern
  const escaped = body.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}${anchored ? '$' : ''}`)
}

function selectGroup(groups, userAgent) {
  const ua = userAgent.toLowerCase()
  const specific = groups.find((g) => g.agents.some((a) => a !== '*' && ua.includes(a)))
  return specific ?? groups.find((g) => g.agents.includes('*')) ?? null
}

/**
 * Descarga y cachea el robots.txt de un origen. Si no se puede leer se aplica
 * la política conservadora habitual: 404 significa "sin restricciones", pero
 * cualquier otro fallo bloquea el dominio para no crawlear a ciegas.
 */
export async function loadRobots(origin, { userAgent, fetchImpl = fetch } = {}) {
  if (CACHE.has(origin)) return CACHE.get(origin)

  const entry = { groups: [], group: null, reachable: false, blockedAll: false }
  try {
    const response = await fetchImpl(`${origin}/robots.txt`, {
      headers: { 'user-agent': userAgent, accept: 'text/plain' },
      redirect: 'follow',
    })
    if (response.status === 404 || response.status === 410) {
      entry.reachable = true
    } else if (response.ok) {
      entry.groups = parseRobots(await response.text())
      entry.group = selectGroup(entry.groups, userAgent)
      entry.reachable = true
      entry.blockedAll = Boolean(
        entry.group && entry.group.disallow.includes('/') && entry.group.allow.length === 0,
      )
    }
  } catch {
    // Se queda como no alcanzable: isAllowed lo tratará como bloqueo.
  }

  CACHE.set(origin, entry)
  return entry
}

/** ¿Permite el robots.txt pedir esta ruta? La regla más específica gana. */
export function isAllowed(robots, pathname) {
  if (!robots.reachable) return false
  const group = robots.group
  if (!group) return true

  let decision = true
  let bestLength = -1
  for (const rule of group.disallow) {
    if (!rule) continue
    if (patternToRegExp(rule).test(pathname) && rule.length > bestLength) {
      decision = false
      bestLength = rule.length
    }
  }
  for (const rule of group.allow) {
    if (patternToRegExp(rule).test(pathname) && rule.length >= bestLength) {
      decision = true
      bestLength = rule.length
    }
  }
  return decision
}

export function crawlDelay(robots) {
  return robots.group?.crawlDelay ?? DEFAULT_DELAY_MS
}
