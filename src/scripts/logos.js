// Analiza un logo ya cargado sin modificar el archivo original.
// "claro": logo blanco/claro sobre transparente, que hay que oscurecer para que se vea sobre una lona blanca.
export function analizarLogo(img) {
  const ancho = img.naturalWidth || img.width;
  const alto = img.naturalHeight || img.height;
  const escala = Math.min(1, 160 / Math.max(ancho, alto));
  const w = Math.max(1, Math.round(ancho * escala));
  const h = Math.max(1, Math.round(alto * escala));

  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let opacos = 0;
  let sumaLuz = 0;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const a = data[i + 3];
      if (a > 16) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
      if (a > 128) {
        opacos++;
        sumaLuz += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      }
    }
  }

  const transparente = opacos < w * h * 0.95;
  const luz = opacos ? sumaLuz / opacos : 0;
  const caja = maxX < 0
    ? { x: 0, y: 0, w: ancho, h: alto }
    : {
        x: minX / escala,
        y: minY / escala,
        w: (maxX - minX + 1) / escala,
        h: (maxY - minY + 1) / escala,
      };

  return { claro: transparente && luz > 0.6, caja };
}

// Devuelve un canvas recortado al contenido del logo, oscurecido si es claro.
export function prepararLogo(img, { maxLado = 512, tinte = '#151515' } = {}) {
  const { claro, caja } = analizarLogo(img);
  const escala = Math.min(1, maxLado / Math.max(caja.w, caja.h));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.max(1, Math.round(caja.w * escala));
  lienzo.height = Math.max(1, Math.round(caja.h * escala));
  const ctx = lienzo.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, caja.x, caja.y, caja.w, caja.h, 0, 0, lienzo.width, lienzo.height);
  if (claro) {
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = tinte;
    ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  }
  return lienzo;
}
