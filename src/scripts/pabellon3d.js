import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { prepararLogo } from './logos.js';

// Medidas en metros, tomadas a ojo de la foto del pabellón municipal.
const ALTO_ZOCALO = 2.0;
const ALTO_AMARILLO = 5.0;
const ALTO_PARED = 9.1;
const ANCHO_BAHIA = 6;
const FONDO_PISTA = 42;
const FILAS_VALLAS = [4.2, 2.86];
const ORO = new THREE.Color('#f5c518');

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function cargarImagen(cargador, url) {
  return new Promise((resolver) => {
    if (!url) return resolver(null);
    cargador.load(url, resolver, undefined, () => resolver(null));
  });
}

// Las vallas van en la franja amarilla: la principal, grande, en la bahía central;
// el resto por nivel, alternando a derecha e izquierda desde el centro.
function distribuirVallas(lista) {
  const vallas = [];
  if (!lista.length) return { vallas, bahiasUsadas: new Set([0]), anillos: 1 };

  vallas.push({ indice: 0, x: 0, y: 3.5, ancho: 4.9, alto: 2.3, bahia: 0 });
  const bahiasUsadas = new Set([0]);
  let pendientes = lista.slice(1).map((p, k) => ({ indice: k + 1, completa: p.nivel === 0 }));
  let anillo = 0;

  while (pendientes.length) {
    anillo++;
    const filas = [];
    for (const y of FILAS_VALLAS) {
      for (const lado of [1, -1]) filas.push({ x: lado * anillo * ANCHO_BAHIA, y, ocupantes: [] });
    }
    const sinSitio = [];
    for (const p of pendientes) {
      const fila = p.completa
        ? filas.find((f) => f.ocupantes.length === 0)
        : filas.find((f) => f.ocupantes.length === 1 && !f.ocupantes[0].completa) || filas.find((f) => f.ocupantes.length === 0);
      if (fila) fila.ocupantes.push(p);
      else sinSitio.push(p);
    }
    for (const f of filas) {
      if (!f.ocupantes.length) continue;
      bahiasUsadas.add(f.x);
      if (f.ocupantes[0].completa) {
        vallas.push({ indice: f.ocupantes[0].indice, x: f.x, y: f.y, ancho: 5.2, alto: 1.0, bahia: f.x });
      } else if (f.ocupantes.length === 1) {
        vallas.push({ indice: f.ocupantes[0].indice, x: f.x, y: f.y, ancho: 2.55, alto: 1.0, bahia: f.x });
      } else {
        f.ocupantes.forEach((o, k) => {
          vallas.push({ indice: o.indice, x: f.x + (k === 0 ? -1.4 : 1.4), y: f.y, ancho: 2.55, alto: 1.0, bahia: f.x });
        });
      }
    }
    pendientes = sinSitio;
  }
  return { vallas, bahiasUsadas, anillos: Math.max(anillo, 2) };
}

function texturaSuelo(mitad, escudoImg, anisotropia) {
  const ancho = 1024;
  const s = ancho / (mitad * 2);
  const c = lienzo(ancho, Math.round(FONDO_PISTA * s));
  const ctx = c.getContext('2d');
  const X = (x) => (x + mitad) * s;
  const Z = (z) => z * s;

  ctx.fillStyle = '#9b4a3d';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#3f8466';
  ctx.fillRect(X(-10), Z(1), 20 * s, 40 * s);

  // Desgaste del sintético: grano fino y alguna marca de goma
  for (let i = 0; i < 14000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.045)';
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * c.width;
    const y = Math.random() * c.height;
    const largo = 6 + Math.random() * 30;
    const ang = Math.random() * Math.PI;
    ctx.strokeStyle = 'rgba(20,20,20,0.06)';
    ctx.lineWidth = 0.8 + Math.random();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(ang) * largo * 0.5 + 4, y + Math.sin(ang) * largo * 0.5 - 4, x + Math.cos(ang) * largo, y + Math.sin(ang) * largo);
    ctx.stroke();
  }

  const linea = (color, grosor, dibujar) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = grosor * s;
    ctx.beginPath();
    dibujar();
    ctx.stroke();
  };

  // Líneas de otros deportes, como en un pabellón municipal
  linea('rgba(214, 66, 54, 0.85)', 0.05, () => {
    ctx.rect(X(-7.5), Z(7), 15 * s, 28 * s);
    ctx.moveTo(X(-7.5), Z(21));
    ctx.lineTo(X(7.5), Z(21));
    ctx.rect(X(-2.45), Z(7), 4.9 * s, 5.8 * s);
    ctx.rect(X(-2.45), Z(29.2), 4.9 * s, 5.8 * s);
  });
  linea('rgba(236, 196, 48, 0.9)', 0.05, () => {
    ctx.rect(X(-4.5), Z(12), 9 * s, 18 * s);
    ctx.moveTo(X(-4.5), Z(18));
    ctx.lineTo(X(4.5), Z(18));
    ctx.moveTo(X(-4.5), Z(24));
    ctx.lineTo(X(4.5), Z(24));
  });

  // Fútbol sala
  linea('rgba(245, 245, 240, 0.95)', 0.08, () => {
    ctx.rect(X(-10), Z(1), 20 * s, 40 * s);
    ctx.moveTo(X(-10), Z(21));
    ctx.lineTo(X(10), Z(21));
    ctx.moveTo(X(3) , Z(21));
    ctx.arc(X(0), Z(21), 3 * s, 0, Math.PI * 2);
    ctx.moveTo(X(-7.5), Z(1));
    ctx.arc(X(-1.5), Z(1), 6 * s, Math.PI, Math.PI / 2, true);
    ctx.lineTo(X(1.5), Z(7));
    ctx.arc(X(1.5), Z(1), 6 * s, Math.PI / 2, 0, true);
    ctx.moveTo(X(-7.5), Z(41));
    ctx.arc(X(-1.5), Z(41), 6 * s, Math.PI, Math.PI * 1.5, false);
    ctx.lineTo(X(1.5), Z(35));
    ctx.arc(X(1.5), Z(41), 6 * s, Math.PI * 1.5, Math.PI * 2, false);
  });
  ctx.fillStyle = 'rgba(245, 245, 240, 0.95)';
  for (const z of [7, 11, 21, 31, 35]) {
    ctx.beginPath();
    ctx.arc(X(0), Z(z), 0.1 * s, 0, Math.PI * 2);
    ctx.fill();
  }

  if (escudoImg) {
    const lado = 2.6 * s;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(escudoImg, X(0) - lado / 2, Z(21) - lado / 2, lado, lado);
    ctx.globalAlpha = 1;
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

function texturaChapa() {
  const c = lienzo(256, 64);
  const ctx = c.getContext('2d');
  for (let x = 0; x < 256; x++) {
    const v = 0.5 + 0.5 * Math.sin((x / 32) * Math.PI * 2);
    const tono = Math.round(200 + v * 45);
    ctx.fillStyle = `rgb(${tono},${tono + 2},${tono + 4})`;
    ctx.fillRect(x, 0, 1, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

// Ladrillo caravista rojizo. Un azulejo de textura = 1 m de ancho x 0,3 m de alto.
function texturaLadrillo() {
  const c = lienzo(256, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c7b39c';
  ctx.fillRect(0, 0, 256, 128);
  const filas = 4;
  const columnas = 4;
  const alto = 128 / filas;
  const ancho = 256 / columnas;
  for (let f = 0; f < filas; f++) {
    for (let k = -1; k <= columnas; k++) {
      const x = k * ancho + (f % 2 ? ancho / 2 : 0);
      const t = 0.85 + Math.random() * 0.25;
      ctx.fillStyle = `rgb(${Math.round(176 * t)},${Math.round(86 * t)},${Math.round(58 * t)})`;
      ctx.fillRect(x + 3, f * alto + 3, ancho - 6, alto - 6);
    }
  }
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.06})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Chapa de cubierta: las ondas varían en v, así que las crestas siguen la pendiente (eje u).
function texturaTecho() {
  const c = lienzo(64, 256);
  const ctx = c.getContext('2d');
  for (let y = 0; y < 256; y++) {
    const v = 0.5 + 0.5 * Math.sin((y / 32) * Math.PI * 2);
    const tono = Math.round(178 + v * 52);
    ctx.fillStyle = `rgb(${tono},${tono + 4},${tono + 9})`;
    ctx.fillRect(0, y, 64, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function texturaRuido(base) {
  const c = lienzo(128, 128);
  const ctx = c.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2200; i++) {
    ctx.fillStyle = `rgba(${Math.random() > 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    ctx.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Red de la portería hecha con líneas (no con textura) para que se vea igual de cerca que de lejos.
// Coordenadas locales: la boca de la portería en z = 0 y el fondo en z = -0.75.
function crearRed() {
  const W = 1.52;
  const H = 1.98;
  const D = 0.75;
  const PASO = 0.1;
  const TRAMOS = 6;
  const puntos = [];
  const bolsa = (u, v, a) => a * Math.sin(Math.PI * u) * Math.sin(Math.PI * v);

  const cara = (f, largoU, largoV) => {
    const nu = Math.round(largoU / PASO);
    const nv = Math.round(largoV / PASO);
    for (let i = 0; i <= nu; i++) {
      for (let s = 0; s < TRAMOS; s++) puntos.push(...f(i / nu, s / TRAMOS), ...f(i / nu, (s + 1) / TRAMOS));
    }
    for (let j = 0; j <= nv; j++) {
      for (let s = 0; s < TRAMOS; s++) puntos.push(...f(s / TRAMOS, j / nv), ...f((s + 1) / TRAMOS, j / nv));
    }
  };

  cara((u, v) => [-W + 2 * W * u, 0.03 + (H - 0.03) * v, -D - bolsa(u, v, 0.07)], 2 * W, H);
  cara((u, v) => [-W + 2 * W * u, H - bolsa(u, v, 0.05), -D * v], 2 * W, D);
  for (const lado of [-1, 1]) {
    cara((u, v) => [lado * (W + bolsa(u, v, 0.04)), 0.03 + (H - 0.03) * v, -D * u], D, H);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(puntos, 3));
  return geo;
}

function texturaBalon() {
  const W = 512, H = 256;
  const c = lienzo(W, H);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f4f2';
  ctx.fillRect(0, 0, W, H);
  const phi = (1 + Math.sqrt(5)) / 2;
  const caras = [
    [0, 1, phi], [0, -1, phi], [0, 1, -phi], [0, -1, -phi],
    [1, phi, 0], [-1, phi, 0], [1, -phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [-phi, 0, 1], [phi, 0, -1], [-phi, 0, -1],
  ];
  const r = 0.33;
  ctx.fillStyle = '#161616';
  for (const [x, y, z] of caras) {
    const n = Math.hypot(x, y, z);
    const lat = Math.asin(y / n);
    const lon = Math.atan2(x / n, z / n);
    for (const desfase of [-W, 0, W]) {
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * Math.PI * 2;
        const px = ((lon + (r * Math.cos(a)) / Math.cos(lat)) / (Math.PI * 2) + 0.5) * W + desfase;
        const py = (0.5 - (lat + r * Math.sin(a)) / Math.PI) * H;
        if (k) ctx.lineTo(px, py);
        else ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function texturaSombra() {
  const c = lienzo(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(0,0,0,0.55)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function texturaLona(ancho, alto, logo, nombre, anisotropia) {
  const pxW = ancho > 3 ? 1024 : 768;
  const pxH = Math.round((pxW * alto) / ancho);
  const c = lienzo(pxW, pxH);
  const ctx = c.getContext('2d');

  const g = ctx.createLinearGradient(0, 0, 0, pxH);
  g.addColorStop(0, '#fbfbf8');
  g.addColorStop(1, '#e9e9e4');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pxW, pxH);

  // Arrugas suaves de la lona
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * pxW;
    const pliegue = ctx.createLinearGradient(x - 40, 0, x + 40, 0);
    pliegue.addColorStop(0, 'rgba(0,0,0,0)');
    pliegue.addColorStop(0.5, 'rgba(0,0,0,0.035)');
    pliegue.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pliegue;
    ctx.fillRect(x - 40, 0, 80, pxH);
  }

  if (logo) {
    const maxW = pxW * 0.84;
    const maxH = pxH * 0.8;
    const k = Math.min(maxW / logo.width, maxH / logo.height);
    const w = logo.width * k;
    const h = logo.height * k;
    ctx.drawImage(logo, (pxW - w) / 2, (pxH - h) / 2, w, h);
  } else {
    ctx.fillStyle = '#151515';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(pxH * 0.22)}px system-ui, sans-serif`;
    ctx.fillText(nombre.toUpperCase(), pxW / 2, pxH / 2, pxW * 0.85);
  }

  // Ojales
  const radio = Math.max(4, pxH * 0.022);
  const margen = radio * 2.4;
  const pasos = Math.max(2, Math.round(ancho / 0.6));
  for (let i = 0; i <= pasos; i++) {
    const x = margen + ((pxW - margen * 2) * i) / pasos;
    for (const y of [margen, pxH - margen]) {
      ctx.fillStyle = '#9a9a96';
      ctx.beginPath();
      ctx.arc(x, y, radio, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3a38';
      ctx.beginPath();
      ctx.arc(x, y, radio * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = anisotropia;
  return t;
}

function caja(w, h, d, x, y, z, rotX = 0, rotZ = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
}

export async function iniciarPabellon(opciones) {
  const {
    contenedor,
    patrocinadores,
    escudo,
    botones = [],
    reducirMovimiento = false,
    alProgresar = () => {},
    alAbrir = () => {},
    alFallar = () => {},
  } = opciones;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const lienzoWebgl = renderer.domElement;
  lienzoWebgl.className = 'pabellon-lienzo';
  lienzoWebgl.setAttribute('aria-hidden', 'true');
  lienzoWebgl.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    detener();
    alFallar();
  });
  const anisotropia = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  // Carga de imágenes (logos y escudo) con progreso
  const gestor = new THREE.LoadingManager();
  gestor.onProgress = (_url, cargados, total) => alProgresar(cargados / total);
  const cargador = new THREE.ImageLoader(gestor);
  const [escudoImg, ...logosImg] = await Promise.all([
    cargarImagen(cargador, escudo),
    ...patrocinadores.map((p) => cargarImagen(cargador, p.logo)),
  ]);
  alProgresar(1);

  const escena = new THREE.Scene();
  escena.background = new THREE.Color('#06080b');
  escena.fog = new THREE.Fog('#06080b', 45, 95);

  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.22;
  pmrem.dispose();

  const camara = new THREE.PerspectiveCamera(48, 1, 0.1, 120);

  const { vallas, bahiasUsadas, anillos } = distribuirVallas(patrocinadores);
  const mitad = Math.max(15, anillos * ANCHO_BAHIA + 3);

  // ---------- Suelo ----------
  const sueloGeo = new THREE.PlaneGeometry(mitad * 2, FONDO_PISTA);
  sueloGeo.rotateX(-Math.PI / 2);
  sueloGeo.translate(0, 0, FONDO_PISTA / 2);
  const suelo = new THREE.Mesh(
    sueloGeo,
    new THREE.MeshStandardMaterial({ map: texturaSuelo(mitad, escudoImg, anisotropia), roughness: 0.42, metalness: 0 }),
  );
  escena.add(suelo);

  // ---------- Paredes: zócalo gris, franja amarilla y chapa blanca ----------
  const ruidoGris = texturaRuido('#8c8f94');
  const ruidoAmarillo = texturaRuido('#f0c000');
  const chapaBase = texturaChapa();
  const ladrilloBase = texturaLadrillo();
  // La estructura blanca, las cruces verdes y los cristales se juntan en una malla por material.
  const blancas = [];
  const verdes = [];
  const cristales = [];

  // Construye una pared en coordenadas locales (cara hacia +z) y la coloca en el pabellón.
  // ventanas(bx, k) y cruz(bx, k) deciden qué lleva cada bahía (bx: centro local, k: número).
  function pared(ancho, colocacion, { ventanas = () => true, cruz = () => false, ladrillo = false } = {}) {
    const grupo = new THREE.Group();
    grupo.position.set(colocacion.x, 0, colocacion.z);
    grupo.rotation.y = colocacion.rotY;
    grupo.updateMatrix();

    const conRepeticion = (tex, rx, ry) => {
      const t = tex.clone();
      t.repeat.set(rx, ry);
      t.needsUpdate = true;
      return t;
    };
    const banda = (alto, y, material) => {
      const malla = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), material);
      malla.position.y = y;
      grupo.add(malla);
    };
    if (ladrillo) {
      banda(ALTO_AMARILLO, ALTO_AMARILLO / 2,
        new THREE.MeshStandardMaterial({ map: conRepeticion(ladrilloBase, ancho, ALTO_AMARILLO / 0.3), roughness: 0.9 }));
    } else {
      banda(ALTO_ZOCALO, ALTO_ZOCALO / 2,
        new THREE.MeshStandardMaterial({ map: conRepeticion(ruidoGris, ancho / 2, 1), roughness: 0.92 }));
      banda(ALTO_AMARILLO - ALTO_ZOCALO, (ALTO_AMARILLO + ALTO_ZOCALO) / 2,
        new THREE.MeshStandardMaterial({ map: conRepeticion(ruidoAmarillo, ancho / 2, 1.5), roughness: 0.85 }));
    }
    banda(ALTO_PARED - ALTO_AMARILLO, (ALTO_PARED + ALTO_AMARILLO) / 2,
      new THREE.MeshStandardMaterial({ map: conRepeticion(chapaBase, ancho / 1.6, 1), roughness: 0.55, metalness: 0.25 }));
    escena.add(grupo);

    const b = [];
    const v = [];
    const c = [];
    for (let x = -ancho / 2; x <= ancho / 2 + 0.01; x += ANCHO_BAHIA) {
      b.push(caja(0.32, ALTO_PARED + 0.6, 0.32, x, (ALTO_PARED + 0.6) / 2, 0.16));
    }
    b.push(caja(ancho, 0.18, 0.2, 0, ALTO_AMARILLO + 0.05, 0.1));
    b.push(caja(ancho, 0.08, 0.1, 0, 7.05, 0.05));
    b.push(caja(ancho, 0.08, 0.1, 0, 8.55, 0.05));

    const anchoHueco = ANCHO_BAHIA - 0.6;
    for (let k = 0, bx = -ancho / 2 + ANCHO_BAHIA / 2; bx < ancho / 2; k++, bx += ANCHO_BAHIA) {
      if (ventanas(bx, k)) {
        c.push(new THREE.PlaneGeometry(anchoHueco, 0.85).translate(bx, 5.85, 0.02));
        b.push(caja(anchoHueco, 0.06, 0.08, bx, 5.4, 0.04));
        b.push(caja(anchoHueco, 0.06, 0.08, bx, 6.3, 0.04));
        for (let i = 0; i <= 4; i++) b.push(caja(0.06, 0.92, 0.08, bx - anchoHueco / 2 + (i * anchoHueco) / 4, 5.85, 0.04));
      }
      if (cruz(bx, k)) {
        const w = ANCHO_BAHIA - 0.4;
        const h = ALTO_AMARILLO - 0.3;
        const ang = Math.atan2(h, w);
        v.push(caja(Math.hypot(w, h), 0.09, 0.07, bx, 0.15 + h / 2, 0.06, 0, ang));
        v.push(caja(Math.hypot(w, h), 0.09, 0.07, bx, 0.15 + h / 2, 0.06, 0, -ang));
      }
    }
    for (const g of b) blancas.push(g.applyMatrix4(grupo.matrix));
    for (const g of v) verdes.push(g.applyMatrix4(grupo.matrix));
    for (const g of c) cristales.push(g.applyMatrix4(grupo.matrix));
  }

  // Fondo de las vallas (como en la foto: cruces en las bahías libres), fondo opuesto y laterales
  pared(mitad * 2, { x: 0, z: 0, rotY: 0 }, { ventanas: (bx) => bx !== 0, cruz: (bx) => !bahiasUsadas.has(bx) });
  pared(mitad * 2, { x: 0, z: FONDO_PISTA, rotY: Math.PI }, { ventanas: (bx) => bx !== 0, cruz: (_bx, k) => k % 2 === 1 });
  // Lateral de la grada: ladrillo y ventanas, como en la foto de la grada
  pared(FONDO_PISTA, { x: -mitad, z: FONDO_PISTA / 2, rotY: Math.PI / 2 }, { ladrillo: true });
  pared(FONDO_PISTA, { x: mitad, z: FONDO_PISTA / 2, rotY: -Math.PI / 2 }, { cruz: (_bx, k) => k % 2 === 0 });

  // ---------- Cubierta de nave a dos aguas, como en la foto de la pared ----------
  // Cerchas blancas de celosía que cruzan el pabellón (eje x) sobre los pilares de los laterales,
  // correas a lo largo y chapa gris clara con las ondas siguiendo la pendiente.
  const ALERO = 8.95;
  const SUBIDA = 1.15;
  const CANTO = 0.9;
  const yInf = (x) => ALERO + SUBIDA * (1 - Math.abs(x) / mitad);
  const ySup = (x) => yInf(x) + CANTO;
  const pendiente = Math.atan2(SUBIDA, mitad);
  const faldon = Math.hypot(mitad, SUBIDA);
  const barra = (xa, ya, xb, yb, z, grosor) =>
    caja(Math.hypot(xb - xa, yb - ya), grosor, grosor, (xa + xb) / 2, (ya + yb) / 2, z, 0, Math.atan2(yb - ya, xb - xa));

  for (let z = 0; z <= FONDO_PISTA + 0.01; z += ANCHO_BAHIA) {
    const zc = clamp(z, 0.3, FONDO_PISTA - 0.3);
    for (const lado of [-1, 1]) {
      blancas.push(barra(lado * mitad, yInf(mitad), 0, yInf(0), zc, 0.14));
      blancas.push(barra(lado * mitad, ySup(mitad), 0, ySup(0), zc, 0.14));
    }
    const PASO = 1.5;
    for (let x = -mitad; x <= mitad + 0.01; x += PASO) {
      blancas.push(barra(x, yInf(x), x, ySup(x), zc, 0.07));
      if (x >= mitad - 0.01) continue;
      const x2 = x + PASO;
      // Diagonales tipo Pratt, inclinadas hacia la cumbrera
      blancas.push(x < 0 ? barra(x, ySup(x), x2, yInf(x2), zc, 0.06) : barra(x, yInf(x), x2, ySup(x2), zc, 0.06));
    }
  }
  for (let x = -mitad + 0.6; x <= mitad - 0.6 + 0.01; x += 2.4) {
    blancas.push(caja(0.1, 0.14, FONDO_PISTA, x, ySup(x) + 0.09, FONDO_PISTA / 2));
  }
  blancas.push(caja(0.12, 0.16, FONDO_PISTA, 0, ySup(0) + 0.09, FONDO_PISTA / 2));

  const matBlanco = new THREE.MeshStandardMaterial({ color: '#eef0ee', roughness: 0.5, metalness: 0.25 });
  escena.add(new THREE.Mesh(mergeGeometries(blancas), matBlanco));
  if (verdes.length) {
    escena.add(new THREE.Mesh(mergeGeometries(verdes), new THREE.MeshStandardMaterial({ color: '#2f5e3d', roughness: 0.6, metalness: 0.3 })));
  }
  if (cristales.length) {
    escena.add(new THREE.Mesh(
      mergeGeometries(cristales),
      new THREE.MeshStandardMaterial({ color: '#0d1b28', roughness: 0.08, metalness: 0.85, emissive: '#0b1d33', emissiveIntensity: 0.4 }),
    ));
  }

  // Chapa de la cubierta. Un poco de emisivo imita la luz que rebota en la pista hacia arriba.
  const texTecho = texturaTecho();
  texTecho.repeat.set(1, (FONDO_PISTA + 1) / 0.25 / 8);
  const matTecho = new THREE.MeshStandardMaterial({
    map: texTecho, color: '#eef1f4', roughness: 0.6, metalness: 0.1,
    emissive: '#8a9097', emissiveIntensity: 0.75, side: THREE.DoubleSide,
  });
  for (const lado of [-1, 1]) {
    const geo = new THREE.PlaneGeometry(faldon + 0.4, FONDO_PISTA + 1)
      .rotateX(Math.PI / 2)
      .rotateZ(-lado * pendiente)
      .translate((lado * mitad) / 2, ySup(mitad / 2) + 0.17, FONDO_PISTA / 2);
    escena.add(new THREE.Mesh(geo, matTecho));
  }

  // Cierre de chapa entre lo alto de las paredes y la cubierta (piñones en los fondos, franja en los laterales)
  const texCierre = chapaBase.clone();
  texCierre.repeat.set(1 / 1.6, 1);
  texCierre.needsUpdate = true;
  const matCierre = new THREE.MeshStandardMaterial({ map: texCierre, roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide });
  const forma = new THREE.Shape();
  forma.moveTo(-mitad, ALTO_PARED);
  forma.lineTo(mitad, ALTO_PARED);
  forma.lineTo(mitad, ySup(mitad) + 0.3);
  forma.lineTo(0, ySup(0) + 0.3);
  forma.lineTo(-mitad, ySup(mitad) + 0.3);
  forma.closePath();
  const pinon = new THREE.ShapeGeometry(forma);
  escena.add(new THREE.Mesh(pinon.clone().translate(0, 0, 0.01), matCierre));
  escena.add(new THREE.Mesh(pinon.clone().rotateY(Math.PI).translate(0, 0, FONDO_PISTA - 0.01), matCierre));
  for (const lado of [-1, 1]) {
    const alto = ySup(mitad) + 0.3 - ALTO_PARED;
    const franja = new THREE.PlaneGeometry(FONDO_PISTA, alto)
      .rotateY(-lado * Math.PI / 2)
      .translate(lado * (mitad - 0.01), ALTO_PARED + alto / 2, FONDO_PISTA / 2);
    escena.add(new THREE.Mesh(franja, matCierre));
  }

  // ---------- Grada en el lateral izquierdo, según la foto de la grada ----------
  // Peto de ladrillo con barandilla, cuatro filas de gradas de hormigón y algo de público.
  const GRADA = { z0: 6, z1: 36, fondo: 4.2, filas: 4 };
  const xFrente = -mitad + GRADA.fondo;
  const largoGrada = GRADA.z1 - GRADA.z0;
  const zGrada = (GRADA.z0 + GRADA.z1) / 2;
  const huella = (GRADA.fondo - 0.25) / GRADA.filas;
  const alturaFila = (i) => 0.75 + i * 0.42;

  const escalones = [];
  for (let i = 0; i < GRADA.filas; i++) {
    const xa = xFrente - 0.25 - i * huella;
    const xb = i === GRADA.filas - 1 ? -mitad : xa - huella;
    escalones.push(caja(xa - xb, alturaFila(i), largoGrada, (xa + xb) / 2, alturaFila(i) / 2, zGrada));
  }
  const grada = new THREE.Mesh(
    mergeGeometries(escalones),
    new THREE.MeshStandardMaterial({ map: texturaRuido('#a5a39d'), roughness: 0.92 }),
  );

  const conLadrillo = (rx, ry) => {
    const t = ladrilloBase.clone();
    t.repeat.set(rx, ry);
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 });
  };
  const peto = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.1, largoGrada), conLadrillo(largoGrada, 1.1 / 0.3));
  peto.position.set(xFrente - 0.125, 0.55, zGrada);
  const altoCierre = alturaFila(GRADA.filas - 1) + 0.3;
  const matCierreGrada = conLadrillo(GRADA.fondo, altoCierre / 0.3);
  const cierres = [GRADA.z0 - 0.125, GRADA.z1 + 0.125].map((z) => {
    const malla = new THREE.Mesh(new THREE.BoxGeometry(GRADA.fondo, altoCierre, 0.25), matCierreGrada);
    malla.position.set(-mitad + GRADA.fondo / 2, altoCierre / 2, z);
    return malla;
  });

  const barandilla = [
    caja(0.05, 0.05, largoGrada, xFrente - 0.12, 2.0, zGrada),
    caja(0.04, 0.04, largoGrada, xFrente - 0.12, 1.55, zGrada),
  ];
  for (let z = GRADA.z0; z <= GRADA.z1 + 0.01; z += 1.5) barandilla.push(caja(0.05, 0.9, 0.05, xFrente - 0.12, 1.55, z));

  const puerta = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 2.3).rotateY(Math.PI / 2).translate(-mitad + 0.03, alturaFila(GRADA.filas - 1) + 1.15, zGrada),
    new THREE.MeshStandardMaterial({ color: '#121417', roughness: 0.9 }),
  );

  escena.add(
    grada, peto, puerta, ...cierres,
    new THREE.Mesh(mergeGeometries(barandilla), new THREE.MeshStandardMaterial({ color: '#2a2d30', roughness: 0.5, metalness: 0.6 })),
  );

  // Público sentado (sin ocupar el pasillo central)
  const plazas = [];
  for (let i = 0; i < GRADA.filas; i++) {
    const x = xFrente - 0.25 - i * huella - huella * 0.55;
    for (let z = GRADA.z0 + 0.5; z < GRADA.z1 - 0.3; z += 0.6) {
      if (Math.abs(z - zGrada) < 1.1 || Math.random() < 0.45) continue;
      plazas.push([x + (Math.random() - 0.5) * 0.12, alturaFila(i), z + (Math.random() - 0.5) * 0.14]);
    }
  }
  const cuerpos = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.17, 0.38, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.85 }), plazas.length);
  const cabezas = new THREE.InstancedMesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ roughness: 0.7 }), plazas.length);
  const ropa = ['#f2c200', '#2e7d32', '#111111', '#f4f4f4', '#1f4fa8', '#b3262d', '#6b6b6b', '#e8d9c0', '#d9a3c2'].map((c) => new THREE.Color(c));
  const piel = ['#f1c9a5', '#e0ac85', '#c68a62', '#8d5a3b'].map((c) => new THREE.Color(c));
  const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
  const colocacionPersona = new THREE.Matrix4();
  plazas.forEach(([x, y, z], i) => {
    cuerpos.setMatrixAt(i, colocacionPersona.makeTranslation(x, y + 0.42, z));
    cuerpos.setColorAt(i, azar(ropa));
    cabezas.setMatrixAt(i, colocacionPersona.makeTranslation(x, y + 0.9, z));
    cabezas.setColorAt(i, azar(piel));
  });
  escena.add(cuerpos, cabezas);
  const obstaculos = [grada, peto, ...cierres];

  // Presas del rocódromo en el zócalo, como en la foto
  const presas = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.07, 0),
    new THREE.MeshStandardMaterial({ roughness: 0.7 }),
    46,
  );
  const colores = ['#d9442b', '#2b7bd9', '#e8c22a', '#3aa655', '#a64bc9', '#e07b1f'].map((c) => new THREE.Color(c));
  const m = new THREE.Matrix4();
  for (let i = 0; i < presas.count; i++) {
    const esc = 0.6 + Math.random() * 0.9;
    m.compose(
      new THREE.Vector3(-ANCHO_BAHIA - 2.6 + Math.random() * 5.2, 0.3 + Math.random() * 1.55, 0.03),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)),
      new THREE.Vector3(esc, esc * 0.8, esc * 0.5),
    );
    presas.setMatrixAt(i, m);
    presas.setColorAt(i, colores[i % colores.length]);
  }
  escena.add(presas);

  // Porterías de fútbol sala con red, una en cada fondo (en local: boca en z = 0, fondo en z = -0.75)
  const geoMarco = mergeGeometries([
    caja(0.08, 2, 0.08, -1.54, 1, 0),
    caja(0.08, 2, 0.08, 1.54, 1, 0),
    caja(3.16, 0.08, 0.08, 0, 2.0, 0),
  ]);
  const geoFondoMarco = mergeGeometries([
    caja(3.1, 0.05, 0.05, 0, 0.03, -0.75),
    caja(0.05, 0.05, 0.75, -1.52, 0.03, -0.375),
    caja(0.05, 0.05, 0.75, 1.52, 0.03, -0.375),
    caja(3.1, 0.05, 0.05, 0, 1.98, -0.75),
    caja(0.05, 0.05, 0.75, -1.52, 1.98, -0.375),
    caja(0.05, 0.05, 0.75, 1.52, 1.98, -0.375),
  ]);
  const geoRed = crearRed();
  const matMarco = new THREE.MeshStandardMaterial({ color: '#f4f4f2', roughness: 0.4, metalness: 0.2 });
  const matFondoMarco = new THREE.MeshStandardMaterial({ color: '#1f5fbf', roughness: 0.4, metalness: 0.3 });
  const matRed = new THREE.LineBasicMaterial({ color: '#f2f2ee', transparent: true, opacity: 0.7 });
  for (const [z, rotY] of [[1, 0], [FONDO_PISTA - 1, Math.PI]]) {
    const porteria = new THREE.Group();
    porteria.add(new THREE.Mesh(geoMarco, matMarco), new THREE.Mesh(geoFondoMarco, matFondoMarco), new THREE.LineSegments(geoRed, matRed));
    porteria.position.z = z;
    porteria.rotation.y = rotY;
    escena.add(porteria);
  }

  // ---------- Luces: focos LED del pabellón ----------
  escena.add(new THREE.HemisphereLight('#dfe8ff', '#3a2a22', 0.5));

  const focos = [];
  for (let x = -mitad + 3; x <= mitad - 3; x += 6) {
    for (let z = 3; z < FONDO_PISTA; z += 6) focos.push(caja(0.55, 0.08, 0.32, x, 8.82, z));
  }
  const matFoco = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(6) });
  escena.add(new THREE.Mesh(mergeGeometries(focos), matFoco));

  const foco = (x, y, z, tx, ty, tz, intensidad, angulo) => {
    const l = new THREE.SpotLight('#fff6e8', intensidad, 0, angulo, 0.85, 2);
    l.position.set(x, y, z);
    l.target.position.set(tx, ty, tz);
    escena.add(l, l.target);
  };
  // Pared de las vallas, pista entera y fondo opuesto
  for (const x of [-8, 0, 8]) foco(x, 8.6, 7, x, 3.2, 0, 230, 0.62);
  for (const z of [7, 17, 27, 37]) foco(0, 8.7, z, 0, 0, z, 125, 0.95);
  foco(0, 8.6, FONDO_PISTA - 8, 0, 3, FONDO_PISTA, 160, 0.85);
  for (const z of [13, 29]) foco(-7, 8.5, z, -12.5, 1, z, 110, 0.85);

  // ---------- Vallas (lonas) ----------
  const lonas = [];
  for (const v of vallas) {
    const p = patrocinadores[v.indice];
    const logoImg = logosImg[v.indice];
    const logo = logoImg ? prepararLogo(logoImg, { maxLado: 640 }) : null;
    const tex = texturaLona(v.ancho, v.alto, logo, p.nombre, anisotropia);

    const geo = new THREE.PlaneGeometry(v.ancho, v.alto, 12, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) / v.ancho + 0.5;
      const w = pos.getY(i) / v.alto + 0.5;
      pos.setZ(i, 0.014 * Math.sin(Math.PI * u) * Math.sin(Math.PI * w) + 0.004 * Math.sin(u * 19));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.78,
      metalness: 0,
      emissive: '#ffffff',
      emissiveMap: tex,
      emissiveIntensity: 0,
    });
    const lona = new THREE.Mesh(geo, mat);
    lona.position.set(v.x, v.y, 0.07);
    lona.rotation.z = (Math.random() - 0.5) * 0.008;
    lona.userData.indice = v.indice;

    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(v.ancho + 0.16, v.alto + 0.16),
      new THREE.MeshBasicMaterial({ color: ORO.clone().multiplyScalar(2.2), transparent: true, opacity: 0, depthWrite: false }),
    );
    halo.position.set(v.x, v.y, 0.062);
    halo.rotation.z = lona.rotation.z;

    escena.add(halo, lona);
    lonas.push({ lona, halo, valla: v, brillo: 0 });
  }
  const mallasLonas = lonas.map((l) => l.lona);
  const lonaPorIndice = new Map(lonas.map((l) => [l.valla.indice, l]));

  // ---------- Balón de futsal ----------
  const RADIO = 0.1;
  let balon = null;
  if (!reducirMovimiento) {
    const malla = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO, 32, 16),
      new THREE.MeshStandardMaterial({ map: texturaBalon(), roughness: 0.45 }),
    );
    const sombra = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false }),
    );
    malla.position.set(1.4, RADIO, 7.5);
    escena.add(malla, sombra);
    balon = { malla, sombra, vel: new THREE.Vector2(), parado: true, espera: 4.5 };
  }

  const zMinBalon = (x) => (Math.abs(x) < 1.7 ? 1.06 + RADIO : 0.07 + RADIO);
  const ejeTmp = new THREE.Vector3();
  function moverBalon(dt) {
    if (!balon) return;
    const { malla, sombra, vel } = balon;
    if (balon.parado) {
      balon.espera -= dt;
      if (balon.espera <= 0) {
        const destinoX = clamp(malla.position.x + (Math.random() - 0.5) * 8, -mitad + 2, mitad - 2);
        const destinoZ = Math.random() < 0.5 ? 0.2 : FONDO_PISTA - 0.2;
        const dir = new THREE.Vector2(destinoX - malla.position.x, destinoZ - malla.position.z).normalize();
        vel.copy(dir.multiplyScalar(4.5 + Math.random() * 2.5));
        balon.parado = false;
      }
    } else {
      const p = malla.position;
      p.x += vel.x * dt;
      p.z += vel.y * dt;
      vel.multiplyScalar(Math.exp(-dt * 0.32));

      const zMin = zMinBalon(p.x);
      const zMax = FONDO_PISTA - zMin;
      if ((p.z < zMin && vel.y < 0) || (p.z > zMax && vel.y > 0)) {
        p.z = clamp(p.z, zMin, zMax);
        vel.y = -vel.y * 0.72;
        vel.x *= 0.9;
      }
      const junto = p.z < 1.1 || p.z > FONDO_PISTA - 1.1;
      if (junto && Math.abs(p.x) > 1.55 && Math.abs(p.x) < 1.8 && Math.sign(vel.x) === -Math.sign(p.x)) vel.x = -vel.x * 0.7;
      const enGrada = p.z > GRADA.z0 && p.z < GRADA.z1;
      const minX = enGrada ? xFrente + RADIO + 0.02 : -mitad + 0.4;
      const maxX = mitad - 0.4;
      if ((p.x < minX && vel.x < 0) || (p.x > maxX && vel.x > 0)) {
        p.x = clamp(p.x, minX, maxX);
        vel.x = -vel.x * 0.7;
      }

      const velocidad = vel.length();
      if (velocidad > 0.001) {
        ejeTmp.set(vel.y, 0, -vel.x).normalize();
        malla.rotateOnWorldAxis(ejeTmp, (velocidad * dt) / RADIO);
      }
      if (velocidad < 0.18) {
        balon.parado = true;
        balon.espera = 5 + Math.random() * 6;
      }
    }
    sombra.position.set(malla.position.x, 0.003, malla.position.z);
  }

  // ---------- Cámara: paseo libre por la pista ----------
  // yaw = 0 mira a la pared de las vallas; yaw positivo gira a la izquierda; pitch positivo mira arriba.
  const ALTURA_OJO = 2.5;
  const LIMITE_X = [xFrente + 1.4, mitad - 2];
  const LIMITE_Z = [3, FONDO_PISTA - 3];
  const PITCH = [-0.55, 0.5];
  const VUELTA = Math.PI * 2;
  const vista = { x: 0, z: 14.5, yaw: 0, pitch: 0 };
  const meta = { ...vista };
  const posTmp = new THREE.Vector3();
  const objTmp = new THREE.Vector3();
  let distInicial = 14.5;

  function aplicarVista(v) {
    const cp = Math.cos(v.pitch);
    posTmp.set(v.x, ALTURA_OJO, v.z);
    objTmp.set(v.x - Math.sin(v.yaw) * cp, ALTURA_OJO + Math.sin(v.pitch), v.z - Math.cos(v.yaw) * cp);
    camara.position.copy(posTmp);
    camara.lookAt(objTmp);
  }
  function limitarMeta() {
    meta.x = clamp(meta.x, LIMITE_X[0], LIMITE_X[1]);
    meta.z = clamp(meta.z, LIMITE_Z[0], LIMITE_Z[1]);
    meta.pitch = clamp(meta.pitch, PITCH[0], PITCH[1]);
    if (reducirMovimiento) Object.assign(vista, meta);
  }
  // Avanza (metros > 0) y se desplaza de lado (lateral > 0 a la derecha) según hacia dónde se mira.
  function avanzar(metros, lateral = 0) {
    meta.x += -Math.sin(meta.yaw) * metros + Math.cos(meta.yaw) * lateral;
    meta.z += -Math.cos(meta.yaw) * metros - Math.sin(meta.yaw) * lateral;
    limitarMeta();
  }

  let ancho = 1;
  let alto = 1;
  function ajustarTamano() {
    ancho = Math.max(1, contenedor.clientWidth);
    alto = Math.max(1, contenedor.clientHeight);
    renderer.setSize(ancho, alto, false);
    const aspecto = ancho / alto;
    const t = clamp((aspecto - 0.6) / 1.2, 0, 1);
    distInicial = lerp(10.5, 14.5, t);
    camara.fov = lerp(56, 46, t);
    camara.aspect = aspecto;
    camara.updateProjectionMatrix();
  }

  const inicioPos = new THREE.Vector3(0, 8.2, 37);
  const inicioObj = new THREE.Vector3(0, 1.2, 14);
  let intro = reducirMovimiento ? 1 : 0;
  const DURACION_INTRO = 3.2;
  const terminarIntro = () => {
    intro = 1;
  };

  // ---------- Interacción ----------
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  let ultimoRaton = null;
  let hover = null;
  let enfocada = null;
  let arrastre = null;
  const toques = new Map();
  let pellizco = null;

  // Marca dorada en el suelo bajo el ratón: indica que se puede ir ahí con un clic.
  const marca = new THREE.Mesh(
    new THREE.RingGeometry(0.32, 0.42, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ORO, transparent: true, opacity: 0.8, depthWrite: false }),
  );
  marca.visible = false;
  escena.add(marca);

  function apuntar(clientX, clientY) {
    const r = lienzoWebgl.getBoundingClientRect();
    puntero.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camara);
    const valla = raycaster.intersectObjects(mallasLonas, false)[0];
    if (valla) return { indice: valla.object.userData.indice };
    // La grada tapa la pista que hay detrás: solo vale si lo primero que se toca es el suelo.
    const pista = raycaster.intersectObjects([suelo, ...obstaculos], false)[0];
    return pista && pista.object === suelo ? { punto: pista.point } : null;
  }

  lienzoWebgl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    terminarIntro();
    marca.visible = false;
    if (e.pointerType === 'touch') {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (toques.size === 2) {
        const [a, b] = [...toques.values()];
        pellizco = Math.hypot(a.x - b.x, a.y - b.y);
        arrastre = null;
        return;
      }
    }
    arrastre = { id: e.pointerId, x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t0: performance.now(), raton: e.pointerType === 'mouse' };
    if (arrastre.raton) lienzoWebgl.setPointerCapture(e.pointerId);
  });
  lienzoWebgl.addEventListener('pointermove', (e) => {
    if (toques.has(e.pointerId)) {
      toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pellizco !== null && toques.size === 2) {
        const [a, b] = [...toques.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        avanzar((d - pellizco) * 0.03);
        pellizco = d;
        return;
      }
    }
    if (arrastre && arrastre.id === e.pointerId) {
      const dx = e.clientX - arrastre.x;
      const dy = e.clientY - arrastre.y;
      arrastre.x = e.clientX;
      arrastre.y = e.clientY;
      meta.yaw += (dx / ancho) * 2.6;
      if (arrastre.raton) meta.pitch += (dy / alto) * 1.6;
      limitarMeta();
    } else if (e.pointerType === 'mouse') {
      ultimoRaton = { x: e.clientX, y: e.clientY };
    }
  });
  const soltar = (e) => {
    toques.delete(e.pointerId);
    if (toques.size < 2) pellizco = null;
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const movido = Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0);
    const breve = performance.now() - arrastre.t0 < 600;
    arrastre = null;
    if (e.type !== 'pointerup' || movido >= 7 || !breve) return;
    const objetivo = apuntar(e.clientX, e.clientY);
    if (objetivo?.indice !== undefined) {
      alAbrir(objetivo.indice);
    } else if (objetivo?.punto) {
      meta.x = objetivo.punto.x;
      meta.z = objetivo.punto.z;
      limitarMeta();
    }
  };
  lienzoWebgl.addEventListener('pointerup', soltar);
  lienzoWebgl.addEventListener('pointercancel', soltar);
  lienzoWebgl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !arrastre) {
      ultimoRaton = null;
      hover = null;
      marca.visible = false;
      lienzoWebgl.style.cursor = '';
    }
  });

  // Ctrl + rueda (y el pellizco del trackpad, que llega así) avanza; la rueda sola sigue bajando la página.
  lienzoWebgl.addEventListener('wheel', (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    terminarIntro();
    avanzar(clamp(-e.deltaY * 0.006, -0.8, 0.8));
  }, { passive: false });

  // Teclado (con el foco en una valla): flechas o WASD para moverse
  const TECLAS = {
    ArrowUp: [1.2, 0, 0], KeyW: [1.2, 0, 0],
    ArrowDown: [-1.2, 0, 0], KeyS: [-1.2, 0, 0],
    KeyA: [0, -1.2, 0], KeyD: [0, 1.2, 0],
    ArrowLeft: [0, 0, 0.18], ArrowRight: [0, 0, -0.18],
  };
  contenedor.addEventListener('keydown', (e) => {
    const t = TECLAS[e.code];
    if (!t || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    terminarIntro();
    meta.yaw += t[2];
    avanzar(t[0], t[1]);
  });

  // ---------- Bucle ----------
  let raf = 0;
  let activo = false;
  let previo = performance.now();
  const esquina = new THREE.Vector3();
  const centro = new THREE.Vector3();

  function colocarBotones() {
    for (const { lona, valla } of lonas) {
      const boton = botones[valla.indice];
      if (!boton) continue;
      // Las vallas que quedan a la espalda dejan su botón quieto y sin tamaño (sigue siendo enfocable).
      centro.setFromMatrixPosition(lona.matrixWorld).applyMatrix4(camara.matrixWorldInverse);
      const detras = centro.z > -0.5;
      boton.classList.toggle('is-detras', detras);
      if (detras) {
        boton.style.transform = `translate(${(ancho / 2).toFixed(1)}px, ${(alto / 2).toFixed(1)}px)`;
        boton.style.width = '0px';
        boton.style.height = '0px';
        continue;
      }
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const sx of [-0.5, 0.5]) {
        for (const sy of [-0.5, 0.5]) {
          esquina.set(sx * valla.ancho, sy * valla.alto, 0).applyMatrix4(lona.matrixWorld).project(camara);
          const px = (esquina.x + 1) * 0.5 * ancho;
          const py = (1 - esquina.y) * 0.5 * alto;
          minX = Math.min(minX, px); maxX = Math.max(maxX, px);
          minY = Math.min(minY, py); maxY = Math.max(maxY, py);
        }
      }
      // Dentro del lienzo, para que enfocar con Tab nunca desplace el contenedor.
      minX = clamp(minX, 0, ancho); maxX = clamp(maxX, 0, ancho);
      minY = clamp(minY, 0, alto); maxY = clamp(maxY, 0, alto);
      boton.style.transform = `translate(${minX.toFixed(1)}px, ${minY.toFixed(1)}px)`;
      boton.style.width = `${(maxX - minX).toFixed(1)}px`;
      boton.style.height = `${(maxY - minY).toFixed(1)}px`;
    }
  }

  function fotograma(ahora) {
    if (!activo) return;
    raf = requestAnimationFrame(fotograma);
    const dt = Math.min(0.05, (ahora - previo) / 1000);
    previo = ahora;

    if (intro < 1) {
      intro = Math.min(1, intro + dt / DURACION_INTRO);
      const e = suavizar(intro);
      aplicarVista(vista);
      camara.position.lerpVectors(inicioPos, posTmp, e);
      objTmp.lerpVectors(inicioObj, objTmp, e);
      camara.lookAt(objTmp);
    } else {
      const kPos = reducirMovimiento ? 1 : 1 - Math.exp(-dt * 3.2);
      const kAng = reducirMovimiento ? 1 : 1 - Math.exp(-dt * 8);
      vista.x += (meta.x - vista.x) * kPos;
      vista.z += (meta.z - vista.z) * kPos;
      vista.yaw += (meta.yaw - vista.yaw) * kAng;
      vista.pitch += (meta.pitch - vista.pitch) * kAng;
      aplicarVista(vista);
    }
    camara.updateMatrixWorld();

    // La cámara también se mueve sola (entrada, paseo, foco con teclado): el hover se recalcula siempre.
    if (ultimoRaton && !arrastre) {
      const objetivo = apuntar(ultimoRaton.x, ultimoRaton.y);
      hover = objetivo?.indice ?? null;
      marca.visible = Boolean(objetivo?.punto);
      if (marca.visible) marca.position.set(objetivo.punto.x, 0.012, objetivo.punto.z);
      lienzoWebgl.style.cursor = objetivo ? 'pointer' : 'grab';
    }

    const kb = 1 - Math.exp(-dt * 10);
    for (const l of lonas) {
      const i = l.valla.indice;
      const objetivo = i === hover || i === enfocada ? 1 : 0;
      l.brillo += (objetivo - l.brillo) * (reducirMovimiento ? 1 : kb);
      l.lona.material.emissiveIntensity = l.brillo * 0.28;
      l.lona.position.z = 0.07 + l.brillo * 0.04;
      l.halo.material.opacity = l.brillo;
      botones[i]?.classList.toggle('is-activa', objetivo === 1);
    }

    moverBalon(dt);
    renderer.render(escena, camara);
    colocarBotones();
  }

  function arrancar() {
    if (activo) return;
    activo = true;
    previo = performance.now();
    raf = requestAnimationFrame(fotograma);
  }
  function detener() {
    activo = false;
    cancelAnimationFrame(raf);
  }

  let visible = true;
  const actualizarActividad = () => (visible && !document.hidden ? arrancar() : detener());
  new IntersectionObserver(([entrada]) => {
    visible = entrada.isIntersecting;
    actualizarActividad();
  }).observe(contenedor);
  document.addEventListener('visibilitychange', actualizarActividad);
  new ResizeObserver(() => ajustarTamano()).observe(contenedor);

  contenedor.prepend(lienzoWebgl);
  ajustarTamano();
  // Vista de partida: frente a la pared de las vallas
  vista.z = distInicial;
  vista.pitch = Math.atan2(3.3 - ALTURA_OJO, distInicial);
  Object.assign(meta, vista);
  aplicarVista(vista);
  if (intro < 1) {
    camara.position.copy(inicioPos);
    camara.lookAt(inicioObj);
  }
  actualizarActividad();

  return {
    // Al enfocar una valla con el teclado, la cámara va delante de ella.
    enfocar(indice) {
      enfocada = indice;
      if (indice === null) return;
      terminarIntro();
      const l = lonaPorIndice.get(indice);
      if (!l) return;
      meta.x = l.valla.x;
      meta.z = distInicial * 0.8;
      limitarMeta();
      // Mira hacia la valla aunque no se pueda poner justo delante (la grada lo impide en el lado izquierdo)
      const dx = l.valla.x - meta.x;
      const dz = -meta.z;
      const yaw = Math.atan2(-dx, -dz);
      meta.yaw = yaw + Math.round((vista.yaw - yaw) / VUELTA) * VUELTA;
      meta.pitch = Math.atan2(l.valla.y - ALTURA_OJO, Math.hypot(dx, dz));
      limitarMeta();
    },
  };
}
