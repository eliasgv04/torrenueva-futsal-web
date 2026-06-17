# Torrenueva Futsal — Web oficial

Sitio web del Club Torrenueva Futsal, construido con [Astro](https://astro.build).

---

## Requisitos previos

- [Node.js](https://nodejs.org) v22 o superior
- npm (incluido con Node)

---

## Arrancar el proyecto en local

```bash
# 1. Entra en la carpeta del proyecto
cd torrenueva-futsal-web

# 2. Instala las dependencias (solo la primera vez)
npm install

# 3. Arranca el servidor de desarrollo
npm run dev
```

El sitio estará disponible en **http://localhost:4321**.

Para generar la versión de producción:

```bash
npm run build   # genera la carpeta dist/
npm run preview # previsualiza el build en local
```

---

## Cómo añadir una noticia

1. Crea un archivo `.md` en `src/content/noticias/`, por ejemplo `mi-noticia.md`.
2. Añade el frontmatter con estos campos:

```markdown
---
titulo: "Título de la noticia"
fecha: 2025-10-28
imagen: "/images/noticias/mi-foto.jpg"
descripcion: "Breve resumen que aparece en la lista y en redes sociales."
autor: "Nombre del autor"   # opcional
---

Aquí va el texto completo de la noticia en Markdown.

## Subtítulo

Más texto...
```

3. La noticia aparecerá automáticamente en `/noticias` y tendrá su propia URL `/noticias/mi-noticia`.

---

## Cómo añadir un jugador

Abre `src/data/jugadores.json` y añade un objeto al array:

```json
{
  "dorsal": 16,
  "nombre": "Nombre Apellido",
  "posicion": "Ala derecho",
  "foto": "/images/jugadores/nombre-apellido.jpg"
}
```

Las posiciones disponibles son: `Portero`, `Cierre`, `Ala derecho`, `Ala izquierdo`, `Pívot`.

---

## Cómo añadir un partido al calendario

Abre `src/data/calendario.json` y añade un objeto al array:

```json
{
  "fecha": "2025-11-03",
  "rival": "Nombre del Rival FS",
  "condicion": "Local",
  "resultado": null
}
```

- `condicion`: `"Local"` o `"Visitante"`.
- `resultado`: `null` si el partido aún no se ha jugado, o la cadena `"3 - 2"` (siempre en formato `goles_local - goles_visitante`) una vez disputado.

---

## Dónde poner las imágenes

Guarda todas las imágenes en la carpeta `public/images/` y organízalas en subcarpetas:

```
public/
└── images/
    ├── escudo.png          <- Escudo del club (48x48 px o mayor)
    ├── og-default.png      <- Imagen Open Graph por defecto (1200x630 px)
    ├── noticias/           <- Fotos de noticias (recomendado 800x450 px, ratio 16:9)
    ├── jugadores/          <- Fotos de jugadores (recomendado 300x400 px, ratio 3:4)
    └── tienda/             <- Fotos de camisetas (recomendado 400x500 px, ratio 4:5)
```

Para referenciarlas en el código usa rutas absolutas desde `/`:
- En un archivo `.md` de noticia: `imagen: "/images/noticias/mi-foto.jpg"`
- En `jugadores.json`: `"foto": "/images/jugadores/carlos-martinez.jpg"`

**Cómo añadir el escudo en la cabecera:**
Abre `src/components/Header.astro`, busca el comentario `Sustituye esta imagen...` y descomenta la línea `<img ... />` que hay debajo.

---

## Cómo cambiar los colores del club

Abre `src/styles/global.css`. Al principio del archivo encontrarás el bloque de variables:

```css
:root {
  --club-verde-oscuro:  #1a5c2e;   /* Color principal: fondo de cabecera, botones, títulos */
  --club-verde-medio:   #236b37;   /* Variante hover del verde */
  --club-amarillo:      #f5c518;   /* Color de acento: detalles, estados activos */
  --club-amarillo-hover:#d4a710;   /* Variante hover del amarillo */
}
```

Cambia los valores hexadecimales y todos los elementos del sitio se actualizarán automáticamente.

---

## Cómo actualizar la URL del sitio

Antes de publicar la web, edita `astro.config.mjs` y sustituye la URL de ejemplo:

```js
export default defineConfig({
  site: 'https://torrenuevafutsal.es', // pon aquí tu dominio real
  ...
});
```

Esto es necesario para que el sitemap y las etiquetas Open Graph funcionen correctamente.

---

## Cómo publicar la web gratis

### Opción A — Netlify (recomendada, muy fácil)

1. Crea una cuenta gratuita en [netlify.com](https://www.netlify.com).
2. Pulsa **"Add new site" > "Import an existing project"** y conecta tu repositorio de GitHub.
3. Configura el build:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. Pulsa **Deploy**. Netlify detecta Astro automáticamente.

### Opción B — Vercel

1. Crea una cuenta en [vercel.com](https://vercel.com).
2. Importa el repositorio de GitHub.
3. Vercel detecta Astro y configura todo automáticamente.
4. Pulsa **Deploy**.

### Opción C — Cloudflare Pages

1. En el panel de Cloudflare, ve a **Workers & Pages > Create application > Pages**.
2. Conecta tu repositorio de GitHub.
3. Configura:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Despliega.

### Opción D — GitHub Pages

Consulta la [guía oficial de Astro para GitHub Pages](https://docs.astro.build/en/guides/deploy/github/).

---

## Estructura del proyecto

```
src/
├── components/       <- Componentes reutilizables (Header, Footer, SEO...)
├── content/
│   ├── config.ts     <- Esquema de las colecciones de contenido
│   └── noticias/     <- Un archivo .md por noticia
├── data/
│   ├── jugadores.json
│   ├── calendario.json
│   └── tienda.json
├── layouts/
│   └── Layout.astro  <- Layout base con cabecera y pie de página
├── pages/            <- Una página por ruta
└── styles/
    └── global.css    <- Variables de color y estilos globales
public/
└── images/           <- Imágenes estáticas (escudo, fotos, etc.)
```
