// Base común de las escenas del Pabellón Municipal de Torrenueva (Patrocinadores y Tienda):
// motor de render, el edificio, sus luces y el balón.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Medidas en metros, tomadas a ojo de las fotos del pabellón municipal.
export const ALTO_ZOCALO = 2.0;
export const ALTO_AMARILLO = 5.0;
export const ALTO_PARED = 9.1;
export const ANCHO_BAHIA = 6;
export const FONDO_PISTA = 42;
export const ORO = new THREE.Color('#f5c518');
// Grada en el lateral izquierdo, por fuera de la nave (de x = -mitad hacia fuera), de z0 a z1.
// fondo: del frente de la grada a la pared de la planta alta.
const GRADA = { z0: 6, z1: 36, fondo: 5.2, filas: 3 };

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const suavizar = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function lienzo(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function cargarImagen(cargador, url) {
  return new Promise((resolver) => {
    if (!url) return resolver(null);
    cargador.load(url, resolver, undefined, () => resolver(null));
  });
}

export function caja(w, h, d, x, y, z, rotX = 0, rotZ = 0) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rotX) g.rotateX(rotX);
  if (rotZ) g.rotateZ(rotZ);
  g.translate(x, y, z);
  return g;
}

// ---------------------------------------------------------------- texturas

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

  // Círculo central relleno de un verde más claro, como en la foto IMG_4915
  ctx.fillStyle = '#5aa680';
  ctx.beginPath();
  ctx.arc(X(0), Z(21), 3 * s, 0, Math.PI * 2);
  ctx.fill();

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
    ctx.moveTo(X(3), Z(21));
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

  // Sombras de contacto horneadas: donde el suelo se junta con paredes, pilares, grada y porterías
  // llega menos luz rebotada, y eso es lo que más ancla los objetos al suelo.
  const degradado = (x0, y0, x1, y1, alfa) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(0,0,0,${alfa})`);
    g.addColorStop(0.35, `rgba(0,0,0,${alfa * 0.45})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    return g;
  };
  const franja = 1.1 * s;
  ctx.fillStyle = degradado(0, 0, 0, franja, 0.5);
  ctx.fillRect(0, 0, c.width, franja);
  ctx.fillStyle = degradado(0, c.height, 0, c.height - franja, 0.5);
  ctx.fillRect(0, c.height - franja, c.width, franja);
  ctx.fillStyle = degradado(c.width, 0, c.width - franja, 0, 0.5);
  ctx.fillRect(c.width - franja, 0, franja, c.height);
  ctx.fillStyle = degradado(0, 0, franja, 0, 0.5);
  ctx.fillRect(0, 0, franja, c.height);

  const mancha = (x, z, radio, alfa) => {
    const g = ctx.createRadialGradient(X(x), Z(z), 0, X(x), Z(z), radio * s);
    g.addColorStop(0, `rgba(0,0,0,${alfa})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(X(x) - radio * s, Z(z) - radio * s, radio * 2 * s, radio * 2 * s);
  };
  for (let x = -mitad; x <= mitad + 0.01; x += ANCHO_BAHIA) {
    mancha(x, 0, 1.0, 0.45);
    mancha(x, FONDO_PISTA, 1.0, 0.45);
  }
  for (let z = 0; z <= FONDO_PISTA + 0.01; z += ANCHO_BAHIA) mancha(mitad, z, 1.0, 0.45);
  for (const [z, fondo] of [[1, 0.25], [FONDO_PISTA - 1, FONDO_PISTA - 0.25]]) {
    for (const x of [-1.54, 1.54]) mancha(x, z, 0.4, 0.4);
    mancha(0, (z + fondo) / 2, 1.9, 0.18);
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

// Cartel de la mesa de la Concejalía, como en la foto IMG_4915. El escudo se dibuja al cargar.
function texturaCartelMesa() {
  const c = lienzo(1024, 314);
  const ctx = c.getContext('2d');
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const dibujar = (escudo) => {
    ctx.fillStyle = '#f7f7f4';
    ctx.fillRect(0, 0, c.width, c.height);
    if (escudo) ctx.drawImage(escudo, 215, 52, 210 * (960 / 1676), 210);
    ctx.fillStyle = '#1b1b1b';
    ctx.font = '600 40px Arial, Helvetica, sans-serif';
    ctx.fillText('Excmo. Ayuntamiento', 365, 112);
    ctx.font = 'bold 96px Arial, Helvetica, sans-serif';
    ctx.fillText('Torrenueva', 357, 204);
    ctx.font = '500 27px Arial, Helvetica, sans-serif';
    ctx.fillText('CONCEJALÍA DE DEPORTES', 420, 248);
    t.needsUpdate = true;
  };
  dibujar(null);
  const img = new Image();
  img.onload = () => dibujar(img);
  img.src = '/pabellon/escudo-torrenueva.webp';
  return t;
}

// Marcador electrónico: LOC. / VISIT., el reloj en el centro y los tanteos abajo
function texturaMarcador() {
  const c = lienzo(512, 306);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#060606';
  ctx.fillRect(0, 0, 512, 306);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 34px Arial, Helvetica, sans-serif';
  ctx.fillText('LOC.', 120, 150);
  ctx.fillText('VISIT.', 392, 150);
  ctx.fillStyle = '#ff9a1a';
  ctx.font = 'bold 104px "Courier New", monospace';
  ctx.fillText('00:00', 256, 105);
  for (const x of [120, 392]) {
    ctx.fillStyle = '#2a1a08';
    ctx.font = 'bold 96px "Courier New", monospace';
    ctx.fillText('88', x, 270);
    ctx.fillStyle = '#ff9a1a';
    ctx.fillText(' 0', x, 270);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Marcas de colores de los asientos en el borde de las filas. Un azulejo = 2,2 m.
function texturaMarcas() {
  const c = lienzo(440, 8);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#cfcfca';
  ctx.fillRect(0, 0, 440, 8);
  ['#1f4fbf', '#f2c200', '#c8262d', '#2f9e44'].forEach((color, i) => {
    ctx.fillStyle = color;
    ctx.fillRect(i * 110 + 15, 0, 80, 8);
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function texturaHalo() {
  const c = lienzo(64, 64);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
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

// ---------------------------------------------------------------- motor

// Render, escena, cámara y bucle. Las páginas se enganchan con alRedimensionar, alFotograma y trasRender.
export function crearMotor(contenedor, { alFallar = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const lienzoWebgl = renderer.domElement;
  lienzoWebgl.className = 'pabellon-lienzo';
  lienzoWebgl.setAttribute('aria-hidden', 'true');

  const escena = new THREE.Scene();
  escena.background = new THREE.Color('#06080b');
  escena.fog = new THREE.Fog('#06080b', 45, 95);
  const pmrem = new THREE.PMREMGenerator(renderer);
  escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  escena.environmentIntensity = 0.22;
  pmrem.dispose();

  const motor = {
    renderer,
    escena,
    camara: new THREE.PerspectiveCamera(48, 1, 0.1, 120),
    lienzo: lienzoWebgl,
    anisotropia: Math.min(8, renderer.capabilities.getMaxAnisotropy()),
    ancho: 1,
    alto: 1,
    alRedimensionar: [],
    alFotograma: [],
    trasRender: [],
  };

  function ajustar() {
    motor.ancho = Math.max(1, contenedor.clientWidth);
    motor.alto = Math.max(1, contenedor.clientHeight);
    renderer.setSize(motor.ancho, motor.alto, false);
    motor.camara.aspect = motor.ancho / motor.alto;
    for (const f of motor.alRedimensionar) f(motor.ancho, motor.alto);
    motor.camara.updateProjectionMatrix();
  }

  let raf = 0;
  let activo = false;
  let previo = performance.now();
  function fotograma(ahora) {
    if (!activo) return;
    raf = requestAnimationFrame(fotograma);
    const dt = Math.min(0.05, (ahora - previo) / 1000);
    previo = ahora;
    for (const f of motor.alFotograma) f(dt, ahora / 1000);
    renderer.render(escena, motor.camara);
    for (const f of motor.trasRender) f();
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

  lienzoWebgl.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    detener();
    alFallar();
  });

  // Pone el lienzo en la página y calcula tamaños (antes de colocar la cámara)
  motor.montar = () => {
    contenedor.prepend(lienzoWebgl);
    ajustar();
    new ResizeObserver(ajustar).observe(contenedor);
  };
  // Arranca el bucle; se para solo cuando la escena no se ve o la pestaña está oculta
  motor.arrancar = () => {
    let visible = true;
    const actualizar = () => (visible && !document.hidden ? arrancar() : detener());
    new IntersectionObserver(([entrada]) => {
      visible = entrada.isIntersecting;
      actualizar();
    }).observe(contenedor);
    document.addEventListener('visibilitychange', actualizar);
    actualizar();
  };
  return motor;
}

// ---------------------------------------------------------------- edificio

// Construye el pabellón: pista, paredes, cubierta de nave, grada, porterías y luces.
// mitad: media anchura interior.
// luz: multiplica la iluminación del pabellón (la Tienda lo apaga para que destaquen los productos).
export function construirPabellon(escena, { mitad, escudoImg = null, anisotropia = 1, luz = 1 }) {
  // ---------- Suelo ----------
  // Sintético mate: solo un brillo suave bajo los focos
  const sueloGeo = new THREE.PlaneGeometry(mitad * 2, FONDO_PISTA);
  sueloGeo.rotateX(-Math.PI / 2);
  sueloGeo.translate(0, 0, FONDO_PISTA / 2);
  const suelo = new THREE.Mesh(
    sueloGeo,
    new THREE.MeshStandardMaterial({ map: texturaSuelo(mitad, escudoImg, anisotropia), roughness: 0.62, metalness: 0 }),
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
  // ventanas(bx) decide qué bahías llevan ventanas (bx: centro local de la bahía).
  function pared(ancho, colocacion, { ventanas = () => true } = {}) {
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
    banda(ALTO_ZOCALO, ALTO_ZOCALO / 2,
      new THREE.MeshStandardMaterial({ map: conRepeticion(ruidoGris, ancho / 2, 1), roughness: 0.92 }));
    banda(ALTO_AMARILLO - ALTO_ZOCALO, (ALTO_AMARILLO + ALTO_ZOCALO) / 2,
      new THREE.MeshStandardMaterial({ map: conRepeticion(ruidoAmarillo, ancho / 2, 1.5), roughness: 0.85 }));
    banda(ALTO_PARED - ALTO_AMARILLO, (ALTO_PARED + ALTO_AMARILLO) / 2,
      new THREE.MeshStandardMaterial({ map: conRepeticion(chapaBase, ancho / 1.6, 1), roughness: 0.55, metalness: 0.25 }));
    escena.add(grupo);

    const b = [];
    const c = [];
    for (let x = -ancho / 2; x <= ancho / 2 + 0.01; x += ANCHO_BAHIA) {
      b.push(caja(0.32, ALTO_PARED + 0.6, 0.32, x, (ALTO_PARED + 0.6) / 2, 0.16));
    }
    b.push(caja(ancho, 0.18, 0.2, 0, ALTO_AMARILLO + 0.05, 0.1));
    b.push(caja(ancho, 0.08, 0.1, 0, 7.05, 0.05));
    b.push(caja(ancho, 0.08, 0.1, 0, 8.55, 0.05));

    const anchoHueco = ANCHO_BAHIA - 0.6;
    for (let bx = -ancho / 2 + ANCHO_BAHIA / 2; bx < ancho / 2; bx += ANCHO_BAHIA) {
      if (ventanas(bx)) {
        c.push(new THREE.PlaneGeometry(anchoHueco, 0.85).translate(bx, 5.85, 0.02));
        b.push(caja(anchoHueco, 0.06, 0.08, bx, 5.4, 0.04));
        b.push(caja(anchoHueco, 0.06, 0.08, bx, 6.3, 0.04));
        for (let i = 0; i <= 4; i++) b.push(caja(0.06, 0.92, 0.08, bx - anchoHueco / 2 + (i * anchoHueco) / 4, 5.85, 0.04));
      }
    }
    for (const g of b) blancas.push(g.applyMatrix4(grupo.matrix));
    for (const g of c) cristales.push(g.applyMatrix4(grupo.matrix));
  }

  // Fondos: el de las vallas y el de enfrente (sin hierros, como en las fotos). Los laterales,
  // la grada y los banquillos, se construyen aparte más abajo.
  pared(mitad * 2, { x: 0, z: 0, rotY: 0 }, { ventanas: (bx) => bx !== 0 });
  pared(mitad * 2, { x: 0, z: FONDO_PISTA, rotY: Math.PI }, { ventanas: (bx) => bx !== 0 });

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

  // ---------- Lateral de la grada, según las fotos de la grada (IMG_9714 e IMG_9711) ----------
  // A pie de pista, un muro de ladrillo con barandilla negra. Detrás, fuera de la nave, tres filas
  // de hormigón con las marcas de colores en el borde y un rellano con barandilla verde; al fondo
  // la planta alta (pared blanca con puertas y una sala verde). Encima, retranqueados sobre pilares
  // blancos que arrancan del rellano: la viga blanca, una franja de ladrillo y los ventanales.
  // Fuera de la grada, el lateral es de ladrillo con su cruz verde hasta la viga.
  const X0 = -mitad;                   // plano de la pared lateral (frente de la grada)
  const ALTO_PETO = 1.8;
  const GRUESO_PETO = 0.25;
  const TABICA = 0.4;
  const HUELLA_FILA = 0.8;
  const yFila = (i) => ALTO_PETO + TABICA * (i + 1);
  const Y_RELLANO = yFila(GRADA.filas);
  const xFila = (i) => X0 - GRUESO_PETO - i * HUELLA_FILA;   // borde delantero de cada fila
  const X_PILARES = xFila(GRADA.filas) - 0.1;                // frente del rellano
  const X_FONDO = X0 - GRADA.fondo;                          // pared del fondo de la planta alta
  const Y_FORJADO = 5.6;
  const zGrada = (GRADA.z0 + GRADA.z1) / 2;
  const PASILLOS = [
    { z: GRADA.z0 + 0.7, ancho: 1.1 },
    { z: zGrada, ancho: 1.3 },
    { z: GRADA.z1 - 0.7, ancho: 1.1 },
  ];

  // Tramos de z de la grada sin los pasillos
  const tramos = [];
  let desde = GRADA.z0;
  for (const p of PASILLOS) {
    if (p.z - p.ancho / 2 > desde) tramos.push([desde, p.z - p.ancho / 2]);
    desde = p.z + p.ancho / 2;
  }
  if (desde < GRADA.z1) tramos.push([desde, GRADA.z1]);

  // Planos con UV en metros (las texturas repiten por metro)
  const uvMetros = (g, w, h) => {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w, uv.getY(i) * h);
    return g;
  };
  // Vertical, mirando a +x (sentido 1) o a -x (-1)
  const planoX = (x, za, zb, ya, yb, sentido = 1) =>
    uvMetros(new THREE.PlaneGeometry(zb - za, yb - ya), zb - za, yb - ya)
      .rotateY((sentido * Math.PI) / 2)
      .translate(x, (ya + yb) / 2, (za + zb) / 2);
  // Vertical, mirando a +z (sentido 1) o a -z (-1)
  const planoZ = (z, xa, xb, ya, yb, sentido = 1) =>
    uvMetros(new THREE.PlaneGeometry(Math.abs(xb - xa), yb - ya), Math.abs(xb - xa), yb - ya)
      .rotateY(sentido > 0 ? 0 : Math.PI)
      .translate((xa + xb) / 2, (ya + yb) / 2, z);
  // Horizontal, mirando hacia abajo (techos)
  const techo = (y, xa, xb, za, zb) =>
    uvMetros(new THREE.PlaneGeometry(Math.abs(xb - xa), zb - za), Math.abs(xb - xa), zb - za)
      .rotateX(Math.PI / 2)
      .translate((xa + xb) / 2, y, (za + zb) / 2);

  const ladrillos = [];
  const hormigon = [];
  const enlucido = [];
  const oscuros = [];     // carpinterías, barandilla del frente y pasamanos
  const verdesOscuros = [];  // barandillas de arriba y remate del muro
  const marcas = [];

  // Fachada de arriba (viga, ladrillo y ventanales) en el plano x, entre za y zb
  function fachadaAlta(x, za, zb) {
    blancas.push(caja(0.32, 0.6, zb - za, x - 0.02, Y_FORJADO + 0.3, (za + zb) / 2));
    ladrillos.push(planoX(x, za, zb, Y_FORJADO + 0.6, 7.2));
    cristales.push(planoX(x - 0.05, za, zb, 7.2, ALTO_PARED));
    oscuros.push(caja(0.12, 0.1, zb - za, x, 7.2, (za + zb) / 2));
    oscuros.push(caja(0.12, 0.08, zb - za, x, 8.05, (za + zb) / 2));
    oscuros.push(caja(0.12, 0.14, zb - za, x, ALTO_PARED - 0.05, (za + zb) / 2));
    for (let z = za; z <= zb + 0.01; z += 1.5) oscuros.push(caja(0.12, ALTO_PARED - 7.2, 0.08, x, (7.2 + ALTO_PARED) / 2, z));
  }

  // Fuera de la grada: ladrillo con cruz verde hasta la viga
  for (const [za, zb] of [[0, GRADA.z0], [GRADA.z1, FONDO_PISTA]]) {
    ladrillos.push(planoX(X0, za, zb, 0, Y_FORJADO));
    fachadaAlta(X0, za, zb);
    if (za !== GRADA.z1) continue; // la cruz, solo en el rincón de la izquierda (foto IMG_9714)
    const largo = zb - za - 0.4;
    const alto = Y_FORJADO - 0.4;
    const ang = Math.atan2(alto, largo);
    for (const s of [1, -1]) verdes.push(caja(0.07, 0.09, Math.hypot(largo, alto), X0 + 0.05, 0.2 + alto / 2, (za + zb) / 2, s * ang));
  }
  // Pilares redondos: a pie de pista en los extremos de la grada y sobre el rellano dentro de ella
  for (let z = GRADA.z0; z <= GRADA.z1 + 0.01; z += ANCHO_BAHIA) {
    const extremo = z === GRADA.z0 || z === GRADA.z1;
    const x = extremo ? X0 + 0.16 : X_PILARES;
    const y0 = extremo ? 0 : Y_RELLANO;
    blancas.push(new THREE.CylinderGeometry(0.14, 0.14, ALTO_PARED + 0.6 - y0, 16).translate(x, (ALTO_PARED + 0.6 + y0) / 2, z));
  }

  // Muro de ladrillo a pie de pista con su remate, y la entrada a vestuarios bajo la grada,
  // centrada en la línea de medio campo, con su portal de ladrillo algo más alto
  const MEDIO_PORTAL = 1.3;
  ladrillos.push(planoX(X0, GRADA.z0, GRADA.z1, 0, ALTO_PETO));
  ladrillos.push(planoX(X0 + 0.02, zGrada - MEDIO_PORTAL, zGrada + MEDIO_PORTAL, ALTO_PETO, 2.45));
  oscuros.push(planoX(X0 + 0.03, zGrada - 0.7, zGrada + 0.7, 0, 2.25));
  for (const [za, zb] of [[GRADA.z0, zGrada - MEDIO_PORTAL], [zGrada + MEDIO_PORTAL, GRADA.z1]]) {
    verdesOscuros.push(caja(GRUESO_PETO + 0.06, 0.06, zb - za, X0 - GRUESO_PETO / 2 + 0.03, ALTO_PETO, (za + zb) / 2));
  }
  verdesOscuros.push(caja(GRUESO_PETO + 0.08, 0.06, 2 * MEDIO_PORTAL, X0 - GRUESO_PETO / 2 + 0.04, 2.45, zGrada));

  // Filas de hormigón (macizas) y escalones de los pasillos
  for (const [za, zb] of tramos) {
    for (let i = 0; i < GRADA.filas; i++) {
      const xa = xFila(i);
      const xb = xFila(i + 1);
      hormigon.push(caja(xa - xb, yFila(i), zb - za, (xa + xb) / 2, yFila(i) / 2, (za + zb) / 2));
    }
  }
  const PELDANOS = (Y_RELLANO - ALTO_PETO) / 0.2;
  const huellaPeldano = (xFila(0) - xFila(GRADA.filas)) / PELDANOS;
  for (const p of PASILLOS) {
    for (let k = 1; k <= PELDANOS; k++) {
      const xa = xFila(0) - (k - 1) * huellaPeldano;
      const xb = xa - huellaPeldano;
      const y = ALTO_PETO + 0.2 * k;
      hormigon.push(caja(xa - xb, y, p.ancho, (xa + xb) / 2, y / 2, p.z));
    }
    // Pasamanos a los dos lados del pasillo
    const dx = xFila(GRADA.filas) - xFila(0);
    const dy = Y_RELLANO - ALTO_PETO;
    for (const lado of [-1, 1]) {
      const z = p.z + (lado * p.ancho) / 2;
      oscuros.push(caja(Math.hypot(dx, dy), 0.05, 0.05, xFila(0) + dx / 2, ALTO_PETO + 0.95 + dy / 2, z, 0, Math.atan2(dy, dx)));
      for (const t of [0, 0.5, 1]) {
        oscuros.push(caja(0.045, 0.95, 0.045, xFila(0) + dx * t, ALTO_PETO + dy * t + 0.475, z));
      }
    }
  }
  // Rellano y planta alta
  hormigon.push(caja(xFila(GRADA.filas) - X_FONDO, Y_RELLANO, GRADA.z1 - GRADA.z0, (xFila(GRADA.filas) + X_FONDO) / 2, Y_RELLANO / 2, zGrada));

  // Marcas de colores de los asientos en el borde de cada fila y del rellano
  for (const [za, zb] of tramos) {
    for (let i = 0; i <= GRADA.filas; i++) {
      const g = new THREE.PlaneGeometry(zb - za, 0.07);
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setX(k, (uv.getX(k) * (zb - za) + za) / 2.2);
      marcas.push(g.rotateY(Math.PI / 2).translate(xFila(i) + 0.006, yFila(i) - 0.04, (za + zb) / 2));
    }
  }

  // Barandilla negra sobre el muro y verde en el frente del rellano (abierta en los pasillos)
  const largoGrada = GRADA.z1 - GRADA.z0;
  const xBarandilla = X0 - 0.12;
  oscuros.push(caja(0.05, 0.05, largoGrada, xBarandilla, ALTO_PETO + 1.0, zGrada));
  oscuros.push(caja(0.035, 0.035, largoGrada, xBarandilla, ALTO_PETO + 0.5, zGrada));
  for (let z = GRADA.z0; z <= GRADA.z1 + 0.01; z += 1.5) {
    if (Math.abs(z - zGrada) < MEDIO_PORTAL) continue;
    oscuros.push(caja(0.045, 1.0, 0.045, xBarandilla, ALTO_PETO + 0.5, z));
  }
  const xVerde = xFila(GRADA.filas) - 0.25;
  for (const [za, zb] of tramos) {
    verdesOscuros.push(caja(0.05, 0.05, zb - za, xVerde, Y_RELLANO + 1.0, (za + zb) / 2));
    verdesOscuros.push(caja(0.035, 0.035, zb - za, xVerde, Y_RELLANO + 0.5, (za + zb) / 2));
    for (let z = za; z <= zb + 0.01; z += Math.max(1, (zb - za) / Math.ceil((zb - za) / 1.6))) {
      verdesOscuros.push(caja(0.045, 1.0, 0.045, xVerde, Y_RELLANO + 0.5, z));
    }
  }

  // Planta alta: pared del fondo blanca con puertas, una sala pintada de verde y su techo
  // Vista desde la pista, la izquierda de la grada (foto IMG_9714) está hacia z1
  const zSala = [GRADA.z1 - 9, GRADA.z1 - 1.5];
  const PUERTAS = [GRADA.z0 + 4, GRADA.z0 + 9, zGrada - 3.5];
  enlucido.push(planoX(X_FONDO, GRADA.z0, zSala[0], Y_RELLANO, Y_FORJADO));
  enlucido.push(planoX(X_FONDO, zSala[1], GRADA.z1, Y_RELLANO, Y_FORJADO));
  enlucido.push(techo(Y_FORJADO, X_FONDO, X_PILARES, GRADA.z0, GRADA.z1));
  const sala = new THREE.Mesh(planoX(X_FONDO, zSala[0], zSala[1], Y_RELLANO, Y_FORJADO),
    new THREE.MeshStandardMaterial({ color: '#b5c46a', roughness: 0.9 }));
  for (const z of [zSala[0] + 2.2, zSala[1] - 2.2]) {
    oscuros.push(planoX(X_FONDO + 0.01, z - 0.6, z + 0.6, Y_RELLANO + 1.3, Y_RELLANO + 1.95));
    for (let k = 0; k <= 6; k++) verdesOscuros.push(caja(0.03, 0.65, 0.025, X_FONDO + 0.03, Y_RELLANO + 1.625, z - 0.6 + k * 0.2));
  }
  for (const z of PUERTAS) {
    oscuros.push(planoX(X_FONDO + 0.01, z - 0.45, z + 0.45, Y_RELLANO, Y_RELLANO + 2.1));
  }
  // Extremos de la grada
  for (const [z, sentido] of [[GRADA.z0, 1], [GRADA.z1, -1]]) {
    ladrillos.push(planoZ(z, X_FONDO, X0, 0, ALTO_PARED, sentido));
  }
  // Techo sobre las filas, a la altura del alero, y fachada de arriba retranqueada
  enlucido.push(techo(ALTO_PARED, X_PILARES, X0, GRADA.z0, GRADA.z1));
  fachadaAlta(X_PILARES, GRADA.z0, GRADA.z1);

  // ---------- Lateral de los banquillos, según la foto IMG_4915 ----------
  // Pared amarilla (gris por arriba en las bahías de los lados, sin hierros salvo en los
  // rincones), pilares blancos redondos y ventanales con carpintería verde. En el centro, sobre
  // la línea de medio campo: el escudo de Torrenueva pintado, la mesa de la Concejalía de
  // Deportes con su silla y su papelera, y el marcador colgado arriba. A cada lado de la mesa,
  // un banquillo verde y otro amarillo. (Los carteles de patrocinadores de esta pared no se copian.)
  const XB = mitad;
  const Z_MEDIO = FONDO_PISTA / 2;
  const Y_VENTANAS = 4.7;
  const amarillos = [];
  const grises = [];
  for (let za = 0; za < FONDO_PISTA - 0.01; za += ANCHO_BAHIA) {
    const zb = za + ANCHO_BAHIA;
    const rincon = za === 0 || zb >= FONDO_PISTA - 0.01;
    const central = za < Z_MEDIO && zb > Z_MEDIO;
    if (rincon) {
      // Como en la foto de la pared de las vallas: zócalo gris, amarillo y su cruz verde
      grises.push(planoX(XB, za, zb, 0, ALTO_ZOCALO, -1));
      amarillos.push(planoX(XB, za, zb, ALTO_ZOCALO, Y_VENTANAS, -1));
      const largo = ANCHO_BAHIA - 0.4;
      const alto = Y_VENTANAS - 0.4;
      const ang = Math.atan2(alto, largo);
      for (const s of [1, -1]) verdes.push(caja(0.07, 0.09, Math.hypot(largo, alto), XB - 0.05, 0.2 + alto / 2, (za + zb) / 2, s * ang));
    } else if (central) {
      amarillos.push(planoX(XB, za, zb, 0, Y_VENTANAS, -1));
    } else {
      amarillos.push(planoX(XB, za, zb, 0, 3.2, -1));
      grises.push(planoX(XB, za, zb, 3.2, Y_VENTANAS, -1));
    }
  }
  // Alféizar blanco, dos filas de ventanas y, encima, chapa blanca como en el resto del pabellón
  const Y_TOPE_VENTANAS = 6.9;
  blancas.push(caja(0.25, 0.22, FONDO_PISTA, XB - 0.1, Y_VENTANAS + 0.05, Z_MEDIO));
  cristales.push(planoX(XB - 0.04, 0, FONDO_PISTA, Y_VENTANAS + 0.16, Y_TOPE_VENTANAS, -1));
  for (const y of [Y_VENTANAS + 0.2, (Y_VENTANAS + 0.2 + Y_TOPE_VENTANAS) / 2, Y_TOPE_VENTANAS]) {
    verdesOscuros.push(caja(0.1, 0.09, FONDO_PISTA, XB - 0.06, y, Z_MEDIO));
  }
  for (let z = 0; z <= FONDO_PISTA + 0.01; z += 1.2) {
    verdesOscuros.push(caja(0.1, Y_TOPE_VENTANAS - Y_VENTANAS, 0.08, XB - 0.06, (Y_TOPE_VENTANAS + Y_VENTANAS) / 2, z));
  }
  const texChapaLateral = chapaBase.clone();
  texChapaLateral.repeat.set(1 / 1.6, 1);
  texChapaLateral.needsUpdate = true;
  escena.add(new THREE.Mesh(
    planoX(XB, 0, FONDO_PISTA, Y_TOPE_VENTANAS, ALTO_PARED, -1),
    new THREE.MeshStandardMaterial({ map: texChapaLateral, roughness: 0.55, metalness: 0.25 }),
  ));
  // Pilares blancos redondos de suelo a cercha
  for (let z = 0; z <= FONDO_PISTA + 0.01; z += ANCHO_BAHIA) {
    blancas.push(new THREE.CylinderGeometry(0.14, 0.14, ALTO_PARED + 0.6, 16).translate(XB - 0.2, (ALTO_PARED + 0.6) / 2, clamp(z, 0.2, FONDO_PISTA - 0.2)));
  }
  const conTextura = (tex, lista) => {
    const t = tex.clone();
    t.needsUpdate = true;
    return new THREE.Mesh(mergeGeometries(lista), new THREE.MeshStandardMaterial({ map: t, roughness: 0.88 }));
  };
  escena.add(conTextura(ruidoAmarillo, amarillos), conTextura(ruidoGris, grises));

  // Escudo de Torrenueva pintado en la pared, sobre la mesa
  const texEscudo = new THREE.TextureLoader().load('/pabellon/escudo-torrenueva.webp');
  texEscudo.colorSpace = THREE.SRGBColorSpace;
  texEscudo.anisotropy = anisotropia;
  const escudoPueblo = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8 * (960 / 1676), 1.8).rotateY(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: texEscudo, transparent: true, alphaTest: 0.05, roughness: 0.85 }),
  );
  escudoPueblo.position.set(XB - 0.015, 2.4, Z_MEDIO);
  escena.add(escudoPueblo);

  // Mesa de la Concejalía de Deportes con su cartel delante
  const matMesa = new THREE.MeshStandardMaterial({ color: '#f4f4f1', roughness: 0.6 });
  const mesa = new THREE.Group();
  mesa.add(new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.04, 2.0).translate(0, 0.75, 0), matMesa));
  for (const dz of [-0.92, 0.92]) mesa.add(new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.71, 0.03).translate(0, 0.355, dz), matMesa));
  const cartel = new THREE.Mesh(
    new THREE.PlaneGeometry(1.96, 0.6).rotateY(-Math.PI / 2).translate(-0.38, 0.42, 0),
    new THREE.MeshStandardMaterial({ map: texturaCartelMesa(), roughness: 0.7 }),
  );
  mesa.add(cartel);
  mesa.position.set(XB - 0.6, 0, Z_MEDIO);
  escena.add(mesa);

  // Silla blanca de plástico y papelera negra, a la derecha de la mesa
  const silla = new THREE.Group();
  const matSilla = new THREE.MeshStandardMaterial({ color: '#f1f1ee', roughness: 0.45 });
  silla.add(new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.04, 0.46).translate(0, 0.44, 0), matSilla));
  silla.add(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.44).translate(0.22, 0.7, 0).rotateZ(-0.12), matSilla));
  for (const [dx, dz] of [[-0.2, -0.2], [-0.2, 0.2], [0.2, -0.2], [0.2, 0.2]]) {
    silla.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.44, 6).translate(dx, 0.22, dz), matSilla));
  }
  silla.position.set(XB - 0.75, 0, Z_MEDIO + 2.3);
  silla.rotation.y = 0.3;
  const papelera = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.2, 0.62, 18).translate(0, 0.31, 0),
    new THREE.MeshStandardMaterial({ color: '#141516', roughness: 0.5 }),
  );
  papelera.position.set(XB - 0.45, 0, Z_MEDIO + 1.4);
  escena.add(silla, papelera);

  // Banquillos: largos y sin respaldo, con el banco y la estructura del mismo color.
  // Desde la pista, a la izquierda de la mesa verde y amarillo; a la derecha verde y amarillo.
  for (const [z, color] of [[Z_MEDIO - 6.7, '#2e8b3a'], [Z_MEDIO - 4.6, '#e8c21c'], [Z_MEDIO + 5.7, '#2e8b3a'], [Z_MEDIO + 7.8, '#e8c21c']]) {
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.3 });
    const piezas = [];
    for (const dx of [-0.11, 0, 0.11]) piezas.push(caja(0.09, 0.03, 2.0, dx, 0.45, 0));
    for (const dz of [-0.85, 0.85]) {
      piezas.push(caja(0.035, 0.44, 0.035, -0.15, 0.22, dz), caja(0.035, 0.44, 0.035, 0.15, 0.22, dz));
      piezas.push(caja(0.34, 0.035, 0.035, 0, 0.42, dz), caja(0.34, 0.03, 0.03, 0, 0.06, dz));
    }
    piezas.push(caja(0.03, 0.03, 1.7, 0, 0.12, 0));
    const banquillo = new THREE.Mesh(mergeGeometries(piezas), mat);
    banquillo.position.set(XB - 0.55, 0, z);
    escena.add(banquillo);
  }

  // Marcador colgado de la cubierta sobre el medio campo
  const marcador = new THREE.Group();
  marcador.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.35, 2.2), new THREE.MeshStandardMaterial({ color: '#0c0d0e', roughness: 0.6 })));
  marcador.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2.08, 1.24).rotateY(-Math.PI / 2).translate(-0.085, 0, 0),
    new THREE.MeshBasicMaterial({ map: texturaMarcador() }),
  ));
  for (const dz of [-0.8, 0.8]) marcador.add(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.8, 4).translate(0, 1.07, dz), matSilla));
  marcador.position.set(XB - 0.9, 8.15, Z_MEDIO);
  escena.add(marcador);

  const texLadrillo = ladrilloBase.clone();
  texLadrillo.repeat.set(1, 1 / 0.3);
  texLadrillo.needsUpdate = true;
  const texHormigon = texturaRuido('#a5a39d');
  const grada = new THREE.Mesh(mergeGeometries(hormigon), new THREE.MeshStandardMaterial({ map: texHormigon, roughness: 0.92 }));
  const peto = new THREE.Mesh(mergeGeometries(ladrillos), new THREE.MeshStandardMaterial({ map: texLadrillo, roughness: 0.9 }));
  escena.add(
    grada, peto, sala,
    new THREE.Mesh(mergeGeometries(enlucido), new THREE.MeshStandardMaterial({ color: '#e8e7e1', roughness: 0.92 })),
    new THREE.Mesh(mergeGeometries(oscuros), new THREE.MeshStandardMaterial({ color: '#1d2022', roughness: 0.5, metalness: 0.5 })),
    new THREE.Mesh(mergeGeometries(verdesOscuros), new THREE.MeshStandardMaterial({ color: '#28473a', roughness: 0.5, metalness: 0.4 })),
    new THREE.Mesh(mergeGeometries(marcas), new THREE.MeshStandardMaterial({ map: texturaMarcas(), roughness: 0.6 })),
  );

  // Señales verdes de salida sobre las puertas
  const matSalida = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2fd27a').multiplyScalar(1.6) });
  for (const z of PUERTAS) {
    const salida = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.15, 0.3), matSalida);
    salida.position.set(X_FONDO + 0.03, Y_RELLANO + 2.35, z);
    escena.add(salida);
  }
  // Ventiladores de techo de la planta alta
  const aspas = [new THREE.CylinderGeometry(0.09, 0.09, 0.12, 12).translate(0, -0.06, 0)];
  for (let k = 0; k < 4; k++) aspas.push(new THREE.BoxGeometry(0.62, 0.012, 0.12).translate(0.36, -0.1, 0).rotateY((k * Math.PI) / 2));
  aspas.push(new THREE.CylinderGeometry(0.015, 0.015, 0.4, 6).translate(0, 0.2, 0));
  const geoVentilador = mergeGeometries(aspas.map((g) => g.toNonIndexed()));
  const matVentilador = new THREE.MeshStandardMaterial({ color: '#f2f2ee', roughness: 0.6 });
  for (const z of [GRADA.z0 + 5, zGrada, GRADA.z1 - 5]) {
    const v = new THREE.Mesh(geoVentilador, matVentilador);
    v.position.set((X_FONDO + X_PILARES) / 2, Y_FORJADO - 0.4, z);
    v.rotation.y = Math.random();
    escena.add(v);
  }
  // Colchonetas apiladas en el rincón, como en la foto
  for (let k = 0; k < 6; k++) {
    const colchoneta = new THREE.Mesh(
      new THREE.BoxGeometry(1.0, 0.1, 2.0),
      new THREE.MeshStandardMaterial({ color: k % 2 ? '#c03a2e' : '#2552a8', roughness: 0.8 }),
    );
    colchoneta.position.set(X0 + 0.6, 0.05 + k * 0.1, FONDO_PISTA - 3);
    escena.add(colchoneta);
  }

  // Sitios del público, de pie en las filas y alguno en el rellano (no en los pasillos).
  // Los aficionados los pone publico.js, que los carga aparte.
  const plazas = [];
  for (const [za, zb] of tramos) {
    for (let i = 0; i <= GRADA.filas; i++) {
      const enRellano = i === GRADA.filas;
      const x = enRellano ? xFila(i) - 0.55 : xFila(i) - HUELLA_FILA / 2;
      const y = enRellano ? Y_RELLANO : yFila(i);
      for (let z = za + 0.35; z < zb - 0.3; z += 0.62) {
        if (Math.random() < (enRellano ? 0.8 : 0.4)) continue;
        plazas.push([x + (Math.random() - 0.5) * 0.12, y, z + (Math.random() - 0.5) * 0.12]);
      }
    }
  }
  const xFrente = X0;

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
    emissive: '#8a9097', emissiveIntensity: 0.75 * luz, side: THREE.DoubleSide,
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
  escena.add(new THREE.HemisphereLight('#dfe8ff', '#3a2a22', 0.5 * luz));

  const focos = [];
  for (let x = -mitad + 3; x <= mitad - 3; x += 6) {
    for (let z = 3; z < FONDO_PISTA; z += 6) focos.push(caja(0.55, 0.08, 0.32, x, 8.82, z));
  }
  const matFoco = new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(6) });
  escena.add(new THREE.Mesh(mergeGeometries(focos), matFoco));
  // Halo de cada LED: deslumbra un poco, como al mirar los focos de verdad
  const matHalo = new THREE.SpriteMaterial({
    map: texturaHalo(), color: '#fff2dc', blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false, opacity: 0.6 * Math.max(luz, 0.4),
  });
  for (let x = -mitad + 3; x <= mitad - 3; x += 6) {
    for (let z = 3; z < FONDO_PISTA; z += 6) {
      const halo = new THREE.Sprite(matHalo);
      halo.position.set(x, 8.74, z);
      halo.scale.setScalar(1.7);
      escena.add(halo);
    }
  }

  const foco = (x, y, z, tx, ty, tz, intensidad, angulo) => {
    const l = new THREE.SpotLight('#fff6e8', intensidad * luz, 0, angulo, 0.85, 2);
    l.position.set(x, y, z);
    l.target.position.set(tx, ty, tz);
    escena.add(l, l.target);
  };
  // Pared de las vallas, pista entera y fondo opuesto
  for (const x of [-8, 0, 8]) foco(x, 8.6, 7, x, 3.2, 0, 230, 0.62);
  for (const z of [7, 17, 27, 37]) foco(0, 8.7, z, 0, 0, z, 125, 0.95);
  foco(0, 8.6, FONDO_PISTA - 8, 0, 3, FONDO_PISTA, 160, 0.85);
  // Grada y planta alta
  for (const z of [11, 21, 31]) foco(-mitad + 5, 8.6, z, -mitad - 2.4, 2.6, z, 150, 0.75);
  // Banquillos, mesa y escudo
  for (const z of [11, 21, 31]) foco(mitad - 5, 8.6, z, mitad, 2.2, z, 150, 0.75);

  return { suelo, obstaculos: [grada, peto], mitad, xFrente, GRADA, yInf, plazas };
}

// ---------------------------------------------------------------- balón

// Un balón de futsal que rueda de vez en cuando y rebota contra paredes, porterías y grada.
export function crearBalon(escena, { mitad, xFrente, GRADA }) {
  const RADIO = 0.1;
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
  const balon = { vel: new THREE.Vector2(), parado: true, espera: 4.5 };

  const zMinBalon = (x) => (Math.abs(x) < 1.7 ? 1.06 + RADIO : 0.07 + RADIO);
  const ejeTmp = new THREE.Vector3();
  function mover(dt) {
    const { vel } = balon;
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
  return { mover };
}
