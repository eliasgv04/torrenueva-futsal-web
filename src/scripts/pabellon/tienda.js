// Escena de la Tienda: los productos cuelgan de hilos desde una cercha del techo del pabellón,
// cada camiseta en su percha y el carnet de abonado con su lanyard, como en un escaparate.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import {
  ORO, clamp, lerp, suavizar, cargarImagen, lienzo,
  crearMotor, construirPabellon,
} from './base.js';
import { distribuirVallas } from './vallas.js';
import { crearPublico } from './publico.js';

const Z_EXPO = 12;          // cercha de la que cuelgan los productos (las cerchas van cada 6 m)
const ESCALA = 1.5;         // tamaño de escaparate: los productos se ven más grandes que al natural
const SEPARACION = 1.35;    // m entre productos
const Y_GANCHO = 3.15;      // altura del gancho de las perchas
const ALTO_CAMISETA = 0.74; // igual que en scripts/blender/generar_camisetas.py
const CUELLO = 0.1;         // del gancho al cuello de la camiseta
const ANCHO_CARNET = 0.5;
const ALTO_OJO = 2.3;
const Y_MIRA = 2.42;        // altura a la que mira la cámara en la vista general
const GIRO_VEL = 0.4;       // rad/s: los productos giran solos para enseñar la espalda
const LUZ_PABELLON = 0.3;   // el pabellón queda en penumbra para que destaquen los productos
const VUELTA = Math.PI * 2;

// ---------------------------------------------------------------- piezas

function materialOro() {
  return new THREE.MeshStandardMaterial({ color: '#d9ab1e', metalness: 0.95, roughness: 0.28 });
}

// Percha: gancho dorado y cuerpo negro (los brazos quedan dentro de la camiseta).
function crearPercha() {
  const grupo = new THREE.Group();
  const gancho = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.105, 0),
    new THREE.Vector3(0, -0.06, 0),
    new THREE.Vector3(-0.004, -0.025, 0),
    new THREE.Vector3(0.012, 0, 0),
    new THREE.Vector3(0.03, -0.012, 0),
    new THREE.Vector3(0.033, -0.034, 0),
  ]);
  const geoGancho = new THREE.TubeGeometry(gancho, 32, 0.0045, 8, false);
  geoGancho.computeBoundingBox();
  const cima = geoGancho.boundingBox.max.y;
  geoGancho.translate(-0.01, -cima, 0);
  grupo.add(new THREE.Mesh(geoGancho, materialOro()));

  const cuerpo = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.21, -0.2, 0),
    new THREE.Vector3(-0.05, -0.13, 0),
    new THREE.Vector3(0, -0.112, 0),
    new THREE.Vector3(0.05, -0.13, 0),
    new THREE.Vector3(0.21, -0.2, 0),
  ]);
  const matNegro = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.45, metalness: 0.2 });
  grupo.add(new THREE.Mesh(new THREE.TubeGeometry(cuerpo, 40, 0.011, 8, false), matNegro));
  grupo.add(new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.42, 8).rotateZ(Math.PI / 2).translate(0, -0.2, 0), matNegro));
  return grupo;
}

function texturaLanyard() {
  const c = lienzo(32, 256);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0b0b0b';
  ctx.fillRect(0, 0, 32, 256);
  ctx.fillStyle = '#d9ab1e';
  ctx.fillRect(3, 0, 4, 256);
  ctx.fillRect(25, 0, 4, 256);
  for (let y = 0; y < 256; y += 4) {
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, y, 32, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Cinta plana a lo largo de una curva, en el plano XY.
function cinta(curva, ancho, segmentos = 40) {
  const pos = [];
  const uv = [];
  const idx = [];
  const largo = curva.getLength();
  for (let i = 0; i <= segmentos; i++) {
    const t = i / segmentos;
    const p = curva.getPointAt(t);
    const tg = curva.getTangentAt(t);
    const n = new THREE.Vector3(-tg.y, tg.x, 0).normalize().multiplyScalar(ancho / 2);
    pos.push(p.x - n.x, p.y - n.y, p.z, p.x + n.x, p.y + n.y, p.z);
    uv.push(0, (t * largo) / 0.12, 1, (t * largo) / 0.12);
    if (i < segmentos) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function rectanguloRedondeado(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

function caraPlana(forma, w, h) {
  const g = new THREE.ShapeGeometry(forma, 6);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

// Trasera del carnet: cartulina negra lisa con un borde dorado fino.
function texturaTraseraCarnet(w, h) {
  const c = lienzo(1024, Math.round((1024 * h) / w));
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#d9ab1e';
  ctx.lineWidth = 6;
  const m = 26;
  const r = 34;
  ctx.beginPath();
  ctx.roundRect(m, m, c.width - 2 * m, c.height - 2 * m, r);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Carnet de abonado colgado de su lanyard: anilla, cinta negra y oro, pinza y tarjeta con sus dos caras.
function crearCarnet(imagen, envMap, anisotropia) {
  const grupo = new THREE.Group();
  const oro = materialOro();

  const anilla = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.0028, 8, 24), oro);
  anilla.position.y = -0.014;
  grupo.add(anilla);

  const texCinta = texturaLanyard();
  const matCinta = new THREE.MeshStandardMaterial({ map: texCinta, roughness: 0.7, side: THREE.DoubleSide });
  for (const lado of [-1, 1]) {
    const curva = new THREE.CatmullRomCurve3([
      new THREE.Vector3(lado * 0.004, -0.026, 0),
      new THREE.Vector3(lado * 0.065, -0.15, 0.004),
      new THREE.Vector3(lado * 0.058, -0.29, 0.002),
      new THREE.Vector3(lado * 0.012, -0.392, 0),
    ]);
    grupo.add(new THREE.Mesh(cinta(curva, 0.024), matCinta));
  }
  grupo.add(new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.04, 0.009).translate(0, -0.405, 0), oro));

  const aspecto = imagen ? imagen.width / imagen.height : 1.6;
  const w = ANCHO_CARNET;
  const h = w / aspecto;
  const grosor = 0.006;
  const forma = rectanguloRedondeado(w, h, 0.03);
  const yCentro = -0.43 - h / 2;

  const cuerpo = new THREE.Mesh(
    new THREE.ExtrudeGeometry(forma, { depth: grosor, bevelEnabled: false, curveSegments: 6 }).translate(0, 0, -grosor / 2),
    [new THREE.MeshStandardMaterial({ color: '#0a0a0a', roughness: 0.5 }), oro],
  );
  cuerpo.position.y = yCentro;

  const texFrente = imagen ? new THREE.Texture(imagen) : null;
  if (texFrente) {
    texFrente.colorSpace = THREE.SRGBColorSpace;
    texFrente.anisotropy = anisotropia;
    texFrente.needsUpdate = true;
  }
  // Plastificado brillante: refleja el pabellón al girar (brillo metálico)
  const brillo = { roughness: 0.22, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.06, envMap, envMapIntensity: 1.4 };
  const frente = new THREE.Mesh(caraPlana(forma, w, h), new THREE.MeshPhysicalMaterial({ map: texFrente, ...brillo }));
  frente.position.set(0, yCentro, grosor / 2 + 0.0005);
  const trasera = new THREE.Mesh(
    caraPlana(forma, w, h).rotateY(Math.PI),
    new THREE.MeshPhysicalMaterial({ map: texturaTraseraCarnet(w, h), ...brillo }),
  );
  trasera.position.set(0, yCentro, -grosor / 2 - 0.0005);
  grupo.add(cuerpo, frente, trasera);
  return { grupo, alto: 0.43 + h };
}

// Mientras llega el modelo 3D, la camiseta se ve como sus dos imágenes planas (delante y detrás).
function crearPlana(texDelante, texDetras) {
  const grupo = new THREE.Group();
  const img = texDelante?.image;
  const w = img ? (ALTO_CAMISETA * img.width) / img.height : ALTO_CAMISETA;
  for (const [tex, girada] of [[texDelante, false], [texDetras, true]]) {
    if (!tex) continue;
    const geo = new THREE.PlaneGeometry(w, ALTO_CAMISETA);
    if (girada) geo.rotateY(Math.PI);
    geo.translate(0, -ALTO_CAMISETA / 2, girada ? -0.012 : 0.012);
    grupo.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, roughness: 0.85 })));
  }
  return grupo;
}

// ---------------------------------------------------------------- escena

export async function iniciarTienda(opciones) {
  const {
    contenedor,
    productos,
    patrocinadores = [],
    escudo,
    etiquetas = [],
    reducirMovimiento = false,
    hueco = () => ({ derecha: 0, abajo: 0 }),
    alProgresar = () => {},
    alSeleccionar = () => {},
    alLado = () => {},
    alFallar = () => {},
  } = opciones;

  const motor = crearMotor(contenedor, { alFallar });
  const { escena, camara, lienzo: lienzoWebgl } = motor;

  // Carga lo imprescindible (escudo e imágenes planas); los modelos 3D llegan después.
  const gestor = new THREE.LoadingManager();
  gestor.onProgress = (_url, cargados, total) => alProgresar(cargados / total);
  const cargadorImg = new THREE.ImageLoader(gestor);
  const cargadorTex = new THREE.TextureLoader(gestor);
  const textura = (url) =>
    new Promise((resolver) => {
      if (!url) return resolver(null);
      cargadorTex.load(url, (t) => {
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = motor.anisotropia;
        resolver(t);
      }, undefined, () => resolver(null));
    });
  const [escudoImg, ...planas] = await Promise.all([
    cargarImagen(cargadorImg, escudo),
    ...productos.map((p) =>
      p.tipo === 'carnet'
        ? cargarImagen(cargadorImg, p.imagenDelantera).then((img) => ({ img }))
        : Promise.all([textura(p.imagenDelantera), textura(p.imagenTrasera)]).then(([delante, detras]) => ({ delante, detras })),
    ),
  ]);
  alProgresar(1);

  // Mismo pabellón que en Patrocinadores (misma anchura y paredes)
  const { mitad } = distribuirVallas(patrocinadores);
  const edificio = construirPabellon(escena, {
    mitad, escudoImg, anisotropia: motor.anisotropia, luz: LUZ_PABELLON,
  });
  const publico = crearPublico(escena, edificio.plazas, { reducirMovimiento, anisotropia: motor.anisotropia });
  // La niebla oscura se come el fondo del pabellón y deja limpia la fila de productos;
  // el parqué se oscurece para que los focos del escaparate no lo hagan brillar
  escena.fog.near = 9;
  escena.fog.far = 34;
  edificio.suelo.material.color.setScalar(0.3);
  edificio.suelo.material.roughness = 0.8;

  // Luz de escaparate: cenital sobre la fila, otra de frente y un foco que sigue al producto señalado
  const escaparate = new THREE.SpotLight('#fff3df', 230, 0, 0.5, 0.7, 2);
  escaparate.position.set(0, 7.5, Z_EXPO - 5.5);
  escaparate.target.position.set(0, 2.4, Z_EXPO);
  const frontal = new THREE.SpotLight('#ffffff', 120, 0, 0.62, 0.8, 2);
  frontal.position.set(0, 3.4, Z_EXPO - 6.5);
  frontal.target.position.set(0, 2.3, Z_EXPO);
  const focoHover = new THREE.SpotLight('#fff6e6', 0, 0, 0.2, 0.55, 2);
  focoHover.position.set(0, 6.2, Z_EXPO - 3.2);
  focoHover.target.position.set(0, 2.4, Z_EXPO);
  escena.add(escaparate, escaparate.target, frontal, frontal.target, focoHover, focoHover.target);

  // ---------- Productos colgados ----------
  const geoPercha = crearPercha();
  const matHilo = new THREE.LineBasicMaterial({ color: '#d8d8d2', transparent: true, opacity: 0.75 });
  const n = productos.length;
  const piezas = productos.map((p, i) => {
    const x = ((n - 1) / 2 - i) * SEPARACION; // la cámara mira hacia +z: el primero queda a la izquierda
    const ancla = new THREE.Group();
    ancla.position.set(x, edificio.yInf(x), Z_EXPO);
    const pendulo = new THREE.Group();
    const largo = ancla.position.y - Y_GANCHO;
    const hilo = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -largo, 0)]),
      matHilo,
    );
    const colgante = new THREE.Group();
    colgante.position.y = -largo;
    // Todo se construye mirando a +z y se gira para que el delantero mire a la cámara
    const contenido = new THREE.Group();
    contenido.rotation.y = Math.PI;
    contenido.scale.setScalar(ESCALA);
    colgante.add(contenido);
    pendulo.add(hilo, colgante);
    ancla.add(pendulo);
    escena.add(ancla);

    let alto;
    let prenda = null;
    if (p.tipo === 'carnet') {
      const carnet = crearCarnet(planas[i].img, escena.environment, motor.anisotropia);
      contenido.add(carnet.grupo);
      alto = carnet.alto;
    } else {
      contenido.add(geoPercha.clone());
      prenda = new THREE.Group();
      prenda.position.y = -CUELLO;
      prenda.add(crearPlana(planas[i].delante, planas[i].detras));
      contenido.add(prenda);
      alto = CUELLO + ALTO_CAMISETA;
    }
    contenido.traverse((o) => {
      o.userData.indice = i;
    });
    // Cada uno empieza girado distinto para que a la vez se vean delanteros y espaldas
    const giro = reducirMovimiento ? 0 : i * 1.9;
    return {
      p, x, ancla, pendulo, colgante, contenido, prenda, alto: alto * ESCALA,
      fase: [Math.random() * 6, Math.random() * 6, Math.random() * 6],
      cerca: 0, quieto: 0, giro, giroMeta: giro,
    };
  });
  const yCentro = (pz) => Y_GANCHO - pz.alto / 2;

  // Modelos 3D de las camisetas: se cargan después y sustituyen a las imágenes planas
  function cargarModelos() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    draco.setDecoderConfig({ type: 'wasm' });
    const gltf = new GLTFLoader();
    gltf.setDRACOLoader(draco);
    const pendientes = piezas.filter((pz) => pz.prenda && pz.p.modelo3d);
    return Promise.all(pendientes.map(async (pz) => {
      try {
        const modelo = (await gltf.loadAsync(pz.p.modelo3d)).scene;
        modelo.traverse((o) => {
          o.userData.indice = piezas.indexOf(pz);
          if (o.isMesh) {
            const mats = Array.isArray(o.material) ? o.material : [o.material];
            for (const m of mats) if (m.map) m.map.anisotropy = motor.anisotropia;
          }
        });
        pz.prenda.clear();
        pz.prenda.add(modelo);
      } catch (error) {
        console.warn('No se pudo cargar', pz.p.modelo3d, error);
      }
    })).finally(() => draco.dispose());
  }

  // ---------- Cámara ----------
  const filaAncho = (n - 1) * SEPARACION + 0.75 * ESCALA;
  const altoMax = Math.max(...piezas.map((pz) => pz.alto));
  const cam = { x: 0, y: ALTO_OJO, z: Z_EXPO - 5, tx: 0, ty: Y_MIRA };
  const meta = { ...cam };
  let panMax = 0;
  let distGeneral = 5;
  let tanV = Math.tan(THREE.MathUtils.degToRad(21));
  let seleccion = null;
  let resaltado = null;

  motor.alRedimensionar.push((ancho, alto) => {
    const aspecto = ancho / alto;
    camara.fov = lerp(52, 42, clamp((aspecto - 0.6) / 1.2, 0, 1));
    tanV = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
    const tanH = tanV * aspecto;
    // Toda la fila si cabe sin que los productos queden pequeños (un 30 % del alto como mínimo,
    // un 42 % en vertical);
    // si no cabe (móvil), se ve uno o dos y se desliza a lo largo de la fila
    const dFila = (filaAncho / 2 + 0.2) / tanH;
    const dMin = (altoMax / 2 + 0.45) / tanV;
    const dTope = Math.max(dMin, altoMax / (2 * (aspecto < 1 ? 0.42 : 0.3) * tanV));
    distGeneral = clamp(dFila, dMin, dTope);
    panMax = dFila > dTope ? ((n - 1) / 2) * SEPARACION : 0;
    if (seleccion === null) vistaGeneral();
    else vistaDetalle(seleccion, false);
  });

  function vistaGeneral(conservarX = true) {
    meta.x = conservarX ? clamp(meta.x, -panMax, panMax) : panMax; // el primero, a la izquierda
    meta.z = Z_EXPO - distGeneral;
    meta.y = ALTO_OJO;
    meta.tx = meta.x;
    meta.ty = Y_MIRA;
  }

  function vistaDetalle(i, animar = true) {
    const pz = piezas[i];
    const { ancho, alto } = motor;
    const { derecha = 0, abajo = 0 } = hueco();
    const altoLibre = Math.max(alto - abajo, alto * 0.4);
    const tanH = tanV * (ancho / alto);
    const d = ((pz.alto / 2 + 0.12) / tanV) * (alto / altoLibre);
    const dx = (derecha / ancho) * d * tanH;   // el producto queda a la izquierda del panel
    const dy = (abajo / alto) * d * tanV;      // o por encima del panel de abajo (móvil)
    meta.x = pz.x - dx;
    meta.tx = pz.x - dx;
    meta.y = yCentro(pz) - dy;
    meta.ty = yCentro(pz) - dy;
    meta.z = Z_EXPO - d;
    if (!animar || reducirMovimiento) Object.assign(cam, meta);
  }

  const inicio = { x: 0, y: 6.5, z: Z_EXPO - 13, tx: 0, ty: 1.5 };
  let intro = reducirMovimiento ? 1 : 0;
  const DURACION_INTRO = 2.6;

  // ---------- Interacción ----------
  const raycaster = new THREE.Raycaster();
  const puntero = new THREE.Vector2();
  const objetivos = piezas.map((pz) => pz.contenido);
  let ultimoRaton = null;
  let hover = null;
  let arrastre = null;

  function productoBajo(clientX, clientY) {
    const r = lienzoWebgl.getBoundingClientRect();
    puntero.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(puntero, camara);
    const hit = raycaster.intersectObjects(objetivos, true)[0];
    return hit ? hit.object.userData.indice ?? null : null;
  }

  lienzoWebgl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    intro = 1;
    arrastre = { id: e.pointerId, x: e.clientX, x0: e.clientX, y0: e.clientY, t0: performance.now() };
    if (e.pointerType === 'mouse') lienzoWebgl.setPointerCapture(e.pointerId);
  });
  lienzoWebgl.addEventListener('pointermove', (e) => {
    if (arrastre && arrastre.id === e.pointerId) {
      const dx = e.clientX - arrastre.x;
      arrastre.x = e.clientX;
      if (seleccion !== null) {
        // En el detalle, arrastrar gira el producto 360º
        const pz = piezas[seleccion];
        pz.giroMeta += (dx / motor.ancho) * VUELTA * 0.9;
        if (reducirMovimiento) pz.giro = pz.giroMeta;
      } else {
        // En la vista general, arrastrar desliza a lo largo de la fila
        const porPixel = (2 * distGeneral * tanV) / motor.alto;
        meta.x = clamp(meta.x + dx * porPixel, -panMax, panMax);
        meta.tx = meta.x;
        if (reducirMovimiento) Object.assign(cam, meta);
      }
    } else if (e.pointerType === 'mouse') {
      ultimoRaton = { x: e.clientX, y: e.clientY };
    }
  });
  const soltar = (e) => {
    if (!arrastre || arrastre.id !== e.pointerId) return;
    const movido = Math.hypot(e.clientX - arrastre.x0, e.clientY - arrastre.y0);
    const breve = performance.now() - arrastre.t0 < 600;
    arrastre = null;
    if (e.type !== 'pointerup' || movido >= 7 || !breve) return;
    const i = productoBajo(e.clientX, e.clientY);
    if (i !== null && i !== seleccion) alSeleccionar(i);
  };
  lienzoWebgl.addEventListener('pointerup', soltar);
  lienzoWebgl.addEventListener('pointercancel', soltar);
  lienzoWebgl.addEventListener('pointerleave', (e) => {
    if (e.pointerType === 'mouse' && !arrastre) {
      ultimoRaton = null;
      hover = null;
      lienzoWebgl.style.cursor = '';
    }
  });

  // ---------- Bucle ----------
  const ancla = new THREE.Vector3();
  let ladoAnterior = false;

  function colocarEtiquetas() {
    const { ancho, alto } = motor;
    piezas.forEach((pz, i) => {
      const etiqueta = etiquetas[i];
      if (!etiqueta) return;
      ancla.set(pz.x, Y_GANCHO - pz.alto - 0.1, Z_EXPO).project(camara);
      const px = (ancla.x + 1) * 0.5 * ancho;
      const py = (1 - ancla.y) * 0.5 * alto;
      etiqueta.style.transform = `translate(${px.toFixed(1)}px, ${py.toFixed(1)}px) translate(-50%, 0)`;
      etiqueta.classList.toggle('is-activa', i === hover || i === resaltado);
    });
  }

  motor.alFotograma.push((dt, t) => {
    publico.actualizar(t);
    // Cámara
    if (intro < 1) {
      intro = Math.min(1, intro + dt / DURACION_INTRO);
      const e = suavizar(intro);
      for (const k of Object.keys(cam)) cam[k] = lerp(inicio[k], meta[k], e);
    } else {
      const k = reducirMovimiento ? 1 : 1 - Math.exp(-dt * 3.5);
      for (const c of Object.keys(cam)) cam[c] += (meta[c] - cam[c]) * k;
    }
    camara.position.set(cam.x, cam.y, cam.z);
    camara.lookAt(cam.tx, cam.ty, Z_EXPO);
    camara.updateMatrixWorld();

    if (ultimoRaton && !arrastre) {
      hover = productoBajo(ultimoRaton.x, ultimoRaton.y);
      if (seleccion !== null && hover !== seleccion) hover = null;
      lienzoWebgl.style.cursor = seleccion !== null ? 'grab' : hover !== null ? 'pointer' : 'grab';
    }
    const destacado = seleccion === null ? (hover ?? resaltado) : null;

    // Productos: balanceo lento con desfase, acercamiento al señalarlos y giro en el detalle
    const kRapido = reducirMovimiento ? 1 : 1 - Math.exp(-dt * 6);
    const kGiro = reducirMovimiento ? 1 : 1 - Math.exp(-dt * 7);
    for (const [i, pz] of piezas.entries()) {
      const elegido = i === seleccion;
      pz.quieto += ((elegido ? 1 : 0) - pz.quieto) * kRapido;
      pz.cerca += ((i === destacado ? 1 : 0) - pz.cerca) * kRapido;
      const amp = reducirMovimiento ? 0 : 1 - pz.quieto;
      const [a, b, c] = pz.fase;
      pz.pendulo.rotation.z = amp * 0.0035 * Math.sin(t * 0.9 + a);
      pz.pendulo.rotation.x = amp * 0.0025 * Math.sin(t * 0.7 + b);
      const vaiven = amp * (0.06 * Math.sin(t * 0.42 + c) + 0.02 * Math.sin(t * 1.1 + a));
      // En la vista general giran solos (más despacio el que se señala); en el detalle manda el usuario
      if (!elegido && !reducirMovimiento) pz.giroMeta += dt * GIRO_VEL * (1 - 0.7 * pz.cerca);
      pz.giro += (pz.giroMeta - pz.giro) * kGiro;
      pz.colgante.rotation.y = vaiven + pz.giro;
      pz.colgante.position.z = -0.22 * pz.cerca;
      pz.colgante.scale.setScalar(1 + 0.03 * pz.cerca);
    }

    // Foco que se va al producto señalado
    const objetivoFoco = destacado !== null ? piezas[destacado] : null;
    focoHover.intensity += ((objetivoFoco ? 70 : 0) - focoHover.intensity) * kRapido;
    if (objetivoFoco) {
      focoHover.position.x += (objetivoFoco.x - focoHover.position.x) * kRapido;
      focoHover.target.position.set(focoHover.position.x, yCentro(objetivoFoco), Z_EXPO);
    }

    if (seleccion !== null) {
      const detras = Math.cos(piezas[seleccion].giro) < 0;
      if (detras !== ladoAnterior) {
        ladoAnterior = detras;
        alLado(detras);
      }
    }
  });
  motor.trasRender.push(colocarEtiquetas);

  motor.montar();
  vistaGeneral(false);
  Object.assign(cam, intro < 1 ? inicio : meta);
  motor.arrancar();
  cargarModelos();

  return {
    // Abre el detalle: la cámara se acerca y el producto deja de balancearse
    abrir(i) {
      intro = 1;
      // Termina la vuelta que lleva para quedar de frente, sin volver hacia atrás
      const pz = piezas[i];
      pz.giroMeta = Math.ceil(pz.giroMeta / VUELTA) * VUELTA;
      if (reducirMovimiento) pz.giro = pz.giroMeta;
      seleccion = i;
      hover = null;
      ladoAnterior = false;
      vistaDetalle(i);
    },
    // Vuelve a la vista general: el producto sigue girando desde donde se dejó
    // (sin animaciones, vuelve a quedar de frente)
    cerrar() {
      if (seleccion === null) return;
      if (reducirMovimiento) this.restaurarGiro(seleccion);
      const x = piezas[seleccion].x;
      seleccion = null;
      vistaGeneral(false);
      meta.x = clamp(x, -panMax, panMax);
      meta.tx = meta.x;
      if (reducirMovimiento) Object.assign(cam, meta);
    },
    restaurarGiro(i) {
      const pz = piezas[i];
      pz.giroMeta = Math.round(pz.giroMeta / VUELTA) * VUELTA;
      if (reducirMovimiento) pz.giro = pz.giroMeta;
    },
    // Gira 180º: de delante a detrás o al revés
    girar() {
      if (seleccion === null) return;
      const pz = piezas[seleccion];
      pz.giroMeta = (Math.round(pz.giroMeta / Math.PI) + 1) * Math.PI;
      if (reducirMovimiento) pz.giro = pz.giroMeta;
    },
    rotar(angulo) {
      if (seleccion === null) return;
      const pz = piezas[seleccion];
      pz.giroMeta += angulo;
      if (reducirMovimiento) pz.giro = pz.giroMeta;
    },
    // Al recorrer las etiquetas con el teclado: resalta el producto y lo trae a la vista
    enfocar(i) {
      resaltado = i;
      if (i === null || seleccion !== null) return;
      intro = 1;
      meta.x = clamp(piezas[i].x, -panMax, panMax);
      meta.tx = meta.x;
      if (reducirMovimiento) Object.assign(cam, meta);
    },
    // El panel de detalle ha cambiado de tamaño (p. ej. al girar el móvil)
    reencuadrar() {
      if (seleccion !== null) vistaDetalle(seleccion);
    },
  };
}
