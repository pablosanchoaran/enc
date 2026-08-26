/**
 * Capa HTTP: un cliente por dominio que respeta robots.txt, serializa las
 * peticiones con el Crawl-delay declarado y reintenta los fallos transitorios.
 */

import { gunzipSync } from 'node:zlib'

import { crawlDelay, isAllowed, loadRobots } from './robots.mjs'

/**
 * Nos identificamos con nombre y dirección de contacto, que es lo que pide la
 * buena educación al rastrear. Acabado en "Bot" a propósito: es la convención
 * que los robots.txt reconocen, y además la palabra "extractor" dispara el
 * cortafuegos de algunas webs — Inmobiliaria C&C devolvía 403 a
 * `MarinaAltaExtractor` y 200 a este mismo agente, con su robots.txt
 * permitiéndonos el paso en los dos casos.
 */
export const USER_AGENT = 'MarinaAltaBot/1.0 (+https://github.com/pablosanchoaran/enc)'

const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504])
const MAX_ATTEMPTS = 3

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export class Fetcher {
  constructor({ origin, userAgent = USER_AGENT, minDelayMs = null } = {}) {
    this.origin = origin
    this.userAgent = userAgent
    this.minDelayMs = minDelayMs
    this.robots = null
    this.queue = Promise.resolve()
    this.stats = { requests: 0, blocked: 0, errors: 0 }
  }

  async init() {
    this.robots = await loadRobots(this.origin, { userAgent: this.userAgent })
    this.delayMs = this.minDelayMs ?? crawlDelay(this.robots)
    return this.robots
  }

  get disallowedEntirely() {
    return !this.robots?.reachable || this.robots.blockedAll
  }

  allows(url) {
    const { pathname, search } = new URL(url)
    return isAllowed(this.robots, `${pathname}${search}`)
  }

  /**
   * Pide una URL en el turno que le toque. Devuelve null cuando robots.txt no
   * la permite o cuando el servidor responde 404/410 — casos esperables que no
   * son error del extractor.
   */
  async get(url, { accept = 'text/html,application/xhtml+xml,application/xml' } = {}) {
    if (!this.robots) await this.init()
    if (!this.allows(url)) {
      this.stats.blocked += 1
      return null
    }

    const run = async () => {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
          const response = await fetch(url, {
            headers: {
              'user-agent': this.userAgent,
              accept,
              'accept-language': 'es-ES,es;q=0.9,en;q=0.8',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(30_000),
          })
          this.stats.requests += 1

          if (response.status === 404 || response.status === 410) return null
          if (response.ok) {
            // El estándar de sitemaps admite servirlos comprimidos, y `fetch`
            // solo descomprime lo que venga por Content-Encoding, no un fichero
            // .gz servido como tal.
            const type = response.headers.get('content-type') ?? ''
            if (url.endsWith('.gz') || type.includes('gzip')) {
              const body = Buffer.from(await response.arrayBuffer())
              try {
                return gunzipSync(body).toString('utf8')
              } catch {
                return body.toString('utf8')
              }
            }
            return await response.text()
          }
          if (!RETRYABLE.has(response.status) || attempt === MAX_ATTEMPTS) {
            this.stats.errors += 1
            return null
          }
        } catch (error) {
          if (attempt === MAX_ATTEMPTS) {
            this.stats.errors += 1
            return null
          }
        }
        await sleep(this.delayMs * 2 ** attempt)
      }
      return null
    }

    // Cada petición espera a la anterior más el crawl-delay: nunca hay dos
    // peticiones en vuelo contra el mismo dominio.
    const result = this.queue.then(run)
    this.queue = result.then(() => sleep(this.delayMs)).catch(() => sleep(this.delayMs))
    return result
  }
}
