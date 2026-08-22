# Publicar el informe en `marina.snctech.org`

Pasos que hay que dar desde tus cuentas. El extractor ya genera el sitio en
`marina-alta/site/` y el workflow ya sabe desplegarlo; falta conectar las
piezas.

Estado comprobado el 22/08/2026: `snctech.org` está en **IONOS**
(nameservers `ns1049.ui-dns.com` y compañía, Apache en 217.160.0.103).

---

## 1. Llevar el dominio a Cloudflare

Cloudflare Access —el login— solo funciona sobre dominios cuyo DNS gestiona
Cloudflare, así que este paso es obligatorio.

1. En [dash.cloudflare.com](https://dash.cloudflare.com) → **Add a site** →
   `snctech.org`, plan **Free**.
2. Cloudflare lee los registros que tengas ahora en IONOS y los copia.
   **Revísalos antes de continuar**: tiene que estar el registro `A` que apunta
   a `217.160.0.103` y los `MX` del correo, si usas correo del dominio. Si
   falta alguno, añádelo a mano ahora.
3. Cloudflare te dará dos nameservers propios. Entra en IONOS → dominio
   `snctech.org` → nameservers, y sustituye los cuatro `ui-dns` por los dos de
   Cloudflare.
4. La propagación tarda de minutos a un par de horas. Mientras tanto la web
   actual sigue sirviéndose.

> **Lo que puede salir mal**: si algún registro no se copió, el servicio que
> dependa de él deja de responder al propagarse. Por eso el punto 2 no es un
> trámite. Si tienes correo en el dominio, comprueba los `MX` dos veces.

---

## 2. Crear el proyecto de Pages

En Cloudflare → **Workers & Pages** → **Create** → **Pages** → **Direct
upload**, con el nombre exacto **`marina-alta`** (el workflow lo busca por ese
nombre). No hace falta subir nada: el primer despliegue lo hará GitHub.

---

## 3. Dar acceso a GitHub

1. Cloudflare → perfil → **API Tokens** → **Create Token** → plantilla
   **Edit Cloudflare Workers**, o un token personalizado con el permiso
   `Account → Cloudflare Pages → Edit`. Cópialo; no vuelve a mostrarse.
2. Tu **Account ID** está en la barra lateral de cualquier página del panel.
3. En GitHub → `pablosanchoaran/enc` → **Settings** → **Secrets and variables**
   → **Actions** → **New repository secret**, dos secretos:

   | Nombre | Valor |
   |---|---|
   | `CLOUDFLARE_API_TOKEN` | el token del paso 1 |
   | `CLOUDFLARE_ACCOUNT_ID` | el identificador del paso 2 |

Hasta que existan esos dos secretos, el paso de despliegue se salta solo y el
resto del workflow sigue funcionando igual.

---

## 4. El subdominio

En el proyecto de Pages → **Custom domains** → **Set up a custom domain** →
`marina.snctech.org`. Cloudflare crea el registro y emite el certificado; el
HTTPS tarda un par de minutos en quedar activo.

---

## 5. El login

Cloudflare → **Zero Trust** → **Access** → **Applications** → **Add an
application** → **Self-hosted**:

- **Application domain**: `marina.snctech.org`
- **Session duration**: 1 mes, para no tener que entrar cada día.
- **Policy**: `Allow` → **Emails** → tu correo (y el de quien quieras que
  entre).
- **Login methods**: **One-time PIN** basta — llega un código al correo y no
  hace falta cuenta de nada. Si prefieres entrar con Google, añade ese método.

Desde ese momento nadie ve el sitio sin pasar por el login, ni las fotos:
Access filtra en el borde, antes de servir cualquier fichero.

El plan gratuito de Zero Trust cubre 50 usuarios.

---

## Qué queda automático

Cada mañana, el workflow de GitHub Actions:

1. rastrea las agencias,
2. guarda datos y fotos en el repositorio,
3. genera `site/`,
4. lo despliega en Pages.

No hace falta ninguna Routine de Claude: la que estaba pendiente de aprobación
existía solo porque un artefacto hay que republicarlo a mano, y esto ya no lo
necesita.

---

## Comprobaciones cuando esté montado

- `https://marina.snctech.org` pide login antes de enseñar nada.
- Con sesión iniciada, el listado carga y las fotos aparecen al bajar.
- Al pulsar una portada se abre la copia de 640 px.
- En **incógnito**, la dirección de una foto suelta —por ejemplo
  `https://marina.snctech.org/fotos/…webp`— también pide login. Si esa se
  sirviera sin pedirlo, la política de Access estaría mal puesta.
