# Novedades inmobiliarias de la Marina Alta

Extractor diario de anuncios de **venta** de vivienda en la Marina Alta. Cada
mañana recorre las fuentes configuradas, compara con el inventario del día
anterior y genera un informe con las altas, los cambios de precio y los
anuncios retirados.

## Uso

```bash
npm install
npm run extract                        # ejecución completa
npm run dry-run                        # no escribe nada, muestra una muestra
node src/index.mjs --source sooprema   # solo un adaptador...
node src/index.mjs --source ferrando-moraira   # ...o una sola agencia
node src/index.mjs --limit 20          # acota las peticiones (pruebas)
node src/index.mjs --report-only       # regenera el informe con lo ya guardado
```

`npm run extract` fija `NODE_USE_ENV_PROXY=1`: sin esa variable, `fetch` de Node
ignora `HTTPS_PROXY` y las peticiones fallan en entornos con proxy de salida.
Donde no hay proxy, la variable no tiene efecto.

## Qué produce

| Ruta | Contenido |
|---|---|
| `data/listings.json` | Inventario vivo: todo lo que se sigue, con su histórico de precios |
| `data/daily/YYYY-MM-DD.json` | Novedades de ese día |
| `report/index.html` | Informe autocontenido, que es lo que se publica como artefacto |

## Fuentes

Se configuran en `sources/agencies.json`. Para dar de alta una agencia nueva
basta con añadir una entrada con su `origin` y el `adapter` que le corresponde;
para desactivarla temporalmente, `"enabled": false`.

| Adaptador | Cubre |
|---|---|
| `thinkspain` | Portal ThinkSpain: barrido por zonas de la comarca + feed de altas del día |
| `sooprema` | Webs sobre el CMS Sooprema: Ferrando, MLS Dénia, Denialara, InmoXara, Daniamed, Benimo Villas, Calablanca |

Quedan deliberadamente fuera: **Idealista** y **Fotocasa** (sus condiciones de
uso prohíben el rastreo y bloquean por IP), **Kyero** (Cloudflare responde 403
incluso al sitemap que su propio robots.txt anuncia) y **Green-Acres** (su
robots.txt bloquea explícitamente a los agentes de Anthropic).

## Cómo se comporta el rastreador

- Lee el `robots.txt` de cada dominio y no pide ninguna URL que no permita.
- Respeta el `Crawl-delay` declarado y nunca lanza dos peticiones a la vez
  contra el mismo dominio.
- Se identifica con un User-Agent propio que enlaza a este repositorio.
- Guarda solo datos del anuncio y enlaza siempre a la ficha original.
- En Sooprema solo vuelve a descargar una ficha si su `lastmod` ha cambiado,
  más un cupo de refresco por rotación como red de seguridad.

## Automatización

`.github/workflows/marina-alta.yml` lo ejecuta a diario (05:00 UTC), guarda los
datos y el informe en el repositorio y sube el informe como artifact del run.
La publicación del artefacto en claude.ai la hace una Routine, porque GitHub
Actions no puede publicar allí.

## Añadir un adaptador

Un adaptador exporta `collect({ fetcher, source, known, log, limit })` y
devuelve objetos con esta forma; `normalize.mjs` se encarga del resto:

```js
{ sourceRef, url, title, price, beds, baths, builtM2, plotM2, type, image, locationHint }
```

`locationHint` es el texto donde buscar el municipio (migas de pan, barrio,
descripción). Si el adaptador ya sabe el municipio con certeza, puede devolver
`municipality` con el nombre canónico de `src/municipalities.mjs`.
