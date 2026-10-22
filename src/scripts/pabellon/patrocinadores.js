// Escena de la página de Patrocinadores: paseo libre por la pista y vallas interactivas.
import * as THREE from 'three';
import {
  FONDO_PISTA, ORO, clamp, lerp, suavizar, cargarImagen,
  crearMotor, construirPabellon, crearBalon,
} from './base.js';
import { distribuirVallas, crearVallas } from './vallas.js';
import { crearPublico } from './publico.js';

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

  const motor = crearMotor(contenedor, { alFallar });
  const { escena, camara, lienzo: lienzoWebgl } = motor;

  // Carga de imágenes (logos y escudo) con progreso
  const gestor = new THREE.LoadingManager();
  gestor.onProgress = (_url, cargados, total) => alProgresar(cargados / total);
  const cargador = new THREE.ImageLoader(gestor);
  const [escudoImg, ...logosImg] = await Promise.all([
    cargarImagen(cargador, escudo),
    ...patrocinadores.map((p) => cargarImagen(cargador, p.logo)),
  ]);
  alProgresar(1);

  const { vallas, mitad } = distribuirVallas(patrocinadores);
  const { suelo, obstaculos, xFrente, GRADA, plazas } = construirPabellon(escena, { mitad, escudoImg, anisotropia: motor.anisotropia });
  const publico = crearPublico(escena, plazas, { reducirMovimiento, anisotropia: motor.anisotropia });
  const lonas = crearVallas(escena, patrocinadores, vallas, logosImg, motor.anisotropia);
  const mallasLonas = lonas.map((l) => l.lona);
  const lonaPorIndice = new Map(lonas.map((l) => [l.valla.indice, l]));
  const balon = reducirMovimiento ? null : crearBalon(escena, { mitad, xFrente, GRADA });

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

  motor.alRedimensionar.push((ancho, alto) => {
    const t = clamp((ancho / alto - 0.6) / 1.2, 0, 1);
    distInicial = lerp(10.5, 14.5, t);
    camara.fov = lerp(56, 46, t);
  });

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
      meta.yaw += (dx / motor.ancho) * 2.6;
      if (arrastre.raton) meta.pitch += (dy / motor.alto) * 1.6;
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
  const esquina = new THREE.Vector3();
  const centro = new THREE.Vector3();

  function colocarBotones() {
    const { ancho, alto } = motor;
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

  motor.alFotograma.push((dt, t) => {
    publico.actualizar(t);
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

    balon?.mover(dt);
  });
  motor.trasRender.push(colocarBotones);

  motor.montar();
  // Vista de partida: frente a la pared de las vallas
  vista.z = distInicial;
  vista.pitch = Math.atan2(3.3 - ALTURA_OJO, distInicial);
  Object.assign(meta, vista);
  aplicarVista(vista);
  if (intro < 1) {
    camara.position.copy(inicioPos);
    camara.lookAt(inicioObj);
  }
  motor.arrancar();

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
