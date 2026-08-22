/**
 * Guarda la foto de portada de los anuncios asequibles.
 *
 * La razón de guardarlas: cuando una vivienda se vende, la agencia retira el
 * anuncio y la foto desaparece de internet. Si queremos poder mirar atrás
 * dentro de un año, la copia tiene que estar en el repositorio, con la fecha
 * en que se capturó.
 *
 * De cada anuncio se guardan dos WebP: uno de 640 px para consultar y una
 * miniatura de 320 px, que es la que se empotra en el informe (el artefacto
 * publicado no puede cargar imágenes de otros servidores).
 */

import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import sharp from 'sharp'

import { Fetcher } from './fetcher.mjs'

const FULL_WIDTH = 640
const THUMB_WIDTH = 320
const MAX_SOURCE_BYTES = 12 * 1024 * 1024

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Un cliente por CDN, para respetar su robots.txt y su ritmo. */
function fetcherFor(cache, imageUrl) {
  const { origin } = new URL(imageUrl)
  if (!cache.has(origin)) cache.set(origin, new Fetcher({ origin, minDelayMs: 250 }))
  return cache.get(origin)
}

async function download(fetcher, url) {
  if (!fetcher.robots) await fetcher.init()
  if (fetcher.disallowedEntirely || !fetcher.allows(url)) return null

  const response = await fetch(url, {
    headers: { 'user-agent': fetcher.userAgent, accept: 'image/*' },
    redirect: 'follow',
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) return null

  const buffer = Buffer.from(await response.arrayBuffer())
  return buffer.byteLength > MAX_SOURCE_BYTES ? null : buffer
}

/**
 * Descarga las fotos que falten y devuelve cuántas se han guardado. Modifica
 * los listings en el sitio, añadiéndoles su registro `photo`.
 *
 * @param {object[]} listings anuncios candidatos (ya filtrados por precio)
 * @param {string} photosDir carpeta donde guardar los ficheros
 * @param {number} budget máximo de descargas por ejecución
 */
export async function capturePhotos(listings, { photosDir, budget = 120, log = () => {} }) {
  await mkdir(photosDir, { recursive: true })
  const fetchers = new Map()
  const capturedAt = new Date().toISOString()

  const pending = listings.filter((item) => item.image && !item.photo)
  if (pending.length === 0) return { saved: 0, failed: 0, pending: 0 }

  let saved = 0
  let failed = 0

  for (const item of pending.slice(0, budget)) {
    const name = item.id.replace(/[^a-z0-9]+/gi, '-')
    const file = `${name}.webp`
    const thumb = `${name}.thumb.webp`

    try {
      // Si el fichero ya está en disco (de una ejecución anterior que no llegó
      // a guardar el inventario), basta con volver a anotarlo.
      if (!(await exists(join(photosDir, file)))) {
        const buffer = await download(fetcherFor(fetchers, item.image), item.image)
        if (!buffer) {
          failed += 1
          continue
        }

        const image = sharp(buffer, { failOn: 'none' }).rotate()
        await writeFile(
          join(photosDir, file),
          await image.clone().resize({ width: FULL_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer(),
        )
        await writeFile(
          join(photosDir, thumb),
          await image.clone().resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
        )
      }

      item.photo = { file, thumb, capturedAt, sourceUrl: item.image }
      saved += 1
    } catch (error) {
      failed += 1
    }
  }

  const rest = Math.max(0, pending.length - budget)
  log(
    `  fotos: ${saved} guardadas, ${failed} fallidas` +
      (rest > 0 ? `, ${rest} para la próxima ejecución` : ''),
  )
  return { saved, failed, pending: rest }
}

/**
 * Presupuesto de miniaturas por defecto, para quien llame sin decir nada. El
 * informe pasa el suyo, calculado con lo que le sobra a la página: el
 * artefacto publicado no puede pasar de 16 MB y las fotos van en base64, que
 * abulta un tercio más que el fichero.
 */
const THUMBNAIL_BYTES = 8 * 1024 * 1024

/**
 * Carga las miniaturas como data URI para empotrarlas en el informe: el
 * artefacto publicado no puede pedir imágenes a ningún servidor externo.
 *
 * Se recorren en el orden recibido y se paran al agotar el presupuesto, así
 * que conviene pasarlas en el orden en que se publican. Un anuncio sin
 * miniatura sale igual, con todos sus datos y su enlace, solo que sin portada.
 *
 * @returns {Promise<Map<string, string>>} id del anuncio → data URI
 */
export async function loadThumbnails(listings, photosDir, { maxBytes = THUMBNAIL_BYTES } = {}) {
  const thumbnails = new Map()
  let used = 0

  for (const item of listings) {
    if (!item.photo?.thumb) continue
    try {
      const buffer = await readFile(join(photosDir, item.photo.thumb))
      // Se cuenta lo que ocupa ya codificado, que es lo que acaba en la página.
      const encoded = buffer.toString('base64')
      if (used + encoded.length > maxBytes) break
      used += encoded.length
      thumbnails.set(item.id, `data:image/webp;base64,${encoded}`)
    } catch {
      // Una foto que ya no está en disco simplemente no se muestra.
    }
  }
  return thumbnails
}
