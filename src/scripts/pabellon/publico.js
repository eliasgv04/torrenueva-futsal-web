// Público de la grada: aficionados con las camisetas del club, de pie y animando.
// El aficionado (public/pabellon/aficionado.glb) y sus camisetas los genera
// scripts/blender/generar_aficionado.py. Cada vértice trae en su color qué parte es
// (camiseta, piel, pelo, pantalón o zapatillas) y cuánto le mueve el brazo; aquí se viste a
// cada uno distinto y se le animan los brazos en el shader, así todo el público son
// tres mallas instanciadas (una por camiseta).
// Los aficionados reales (src/data/aficionados.json) llevan además su cara, que prepara
// scripts/aficionados/preparar_caras.py, y van en primera fila.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import productos from '../../data/productos.json';
import aficionados from '../../data/aficionados.json';

const REPARTO = [0.5, 0.32, 0.18]; // cuántos llevan cada camiseta, en el orden de productos.json
const PIEL = ['#f6d7c0', '#f1c9a5', '#ecc09a', '#e8b98f', '#e0ad86', '#d9a27a'];
const PELO = ['#1c1410', '#2b1d14', '#3d2a1c', '#5a3d26', '#8a6a45', '#b9a089', '#d8cfc4', '#141414'];
const PANTALON = ['#1f2a44', '#2b3a5c', '#181818', '#3a3a3a', '#55606e', '#c9b99a', '#2f3b2a'];

// Gestos: 0 brazos en V agitándolos, 1 aplaudiendo sobre la cabeza, 2 puño arriba, 3 mirando
const GESTOS = [0.34, 0.26, 0.2, 0.2];

const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
function sortear(pesos) {
  let r = Math.random() * pesos.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pesos.length; i++) {
    r -= pesos[i];
    if (r <= 0) return i;
  }
  return pesos.length - 1;
}

// mapaCara: si se pasa, se pinta de frente sobre la cabeza (aficionados reales).
// complexion: { anchura, piernas } para darle a un aficionado real su cuerpo.
function vestir(material, uniformes, mapaCara = null, complexion = null) {
  material.defines = {};
  if (mapaCara) material.defines.CARA = '';
  if (complexion) {
    material.defines.GORDURA = (complexion.anchura ?? 1).toFixed(3);
    material.defines.PIERNAS = (complexion.piernas ?? 1).toFixed(3);
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTiempo = uniformes.uTiempo;
    shader.uniforms.mapaCara = { value: mapaCara };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
        attribute vec3 datos;       // parte / 4, peso del brazo, lado
        attribute vec4 aAnim;       // fase, gesto, velocidad, salto
        attribute vec3 aPiel;
        attribute vec3 aPelo;
        attribute vec3 aPantalon;
        uniform float uTiempo;
        varying float vParte;
        varying vec3 vColorParte;
        varying vec3 vPelo;
        varying vec2 vCaraUv;
        varying float vCaraPeso;

        // Ángulo que se levanta el brazo desde la pose de Blender (50º bajo la horizontal).
        // lado: 1 el de x > 0, -1 el otro.
        float anguloBrazo(float lado) {
          float t = uTiempo * aAnim.z + aAnim.x;
          if (aAnim.y < 0.5) return 2.0 + 0.25 * sin(t * 6.0 + lado * 0.8);
          if (aAnim.y < 1.5) return 2.62 + 0.08 * sin(t * 9.0);
          if (aAnim.y < 2.5) return lado > 0.0 ? 1.75 + 0.6 * max(0.0, sin(t * 5.0)) : -0.5;
          return -0.5 + 0.04 * sin(t * 1.3 + lado);
        }`)
      .replace('#include <beginnormal_vertex>', /* glsl */ `#include <beginnormal_vertex>
        float lado = datos.z > 0.5 ? 1.0 : -1.0;
        float giro = anguloBrazo(lado) * lado * datos.y;
        float cg = cos(giro);
        float sg = sin(giro);
        objectNormal.xy = vec2(cg * objectNormal.x - sg * objectNormal.y, sg * objectNormal.x + cg * objectNormal.y);`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        // El brazo gira alrededor del hombro (HOMBRO en generar_aficionado.py)
        #ifdef CARA
          // Se aplana la nariz del muñeco sobre la cabeza (elipsoide de generar_aficionado.py):
          // la de la foto ya lleva su relieve y, si no, se verían dos narices
          if (datos.x > 0.125 && datos.x < 0.375 && abs(position.x) < 0.05 && position.y > 1.6 && position.y < 1.72) {
            vec2 r = vec2(position.x / 0.086, (position.y - 1.665) / 0.113);
            transformed.z = min(transformed.z, 0.005 + 0.098 * sqrt(max(0.0, 1.0 - dot(r, r))));
          }
        #endif
        #ifdef GORDURA
          // Complexión propia (aficionados reales): tronco GORDURA veces más ancho y con barriga,
          // brazos y piernas más gruesos, y piernas acortadas a PIERNAS. La cabeza casi no cambia.
          {
            vec3 p = transformed;
            float G = GORDURA;
            float kT = p.y < 1.47 ? G : mix(G * 0.8, 1.08, smoothstep(1.47, 1.6, p.y));
            vec3 tronco = vec3(p.x * kT, p.y, 0.005 + (p.z - 0.005) * kT);
            tronco.z += 0.16 * (G - 1.0) * exp(-pow((p.y - 1.1) / 0.2, 2.0)) * clamp(p.z / 0.13, 0.0, 1.0);
            float Gp = 1.0 + (G - 1.0) * 0.75;
            float ejeX = sign(p.x) * 0.105;
            vec3 pierna = vec3(ejeX * G * 0.9 + (p.x - ejeX) * Gp, p.y, 0.01 + (p.z - 0.01) * Gp);
            vec3 cuerpo = mix(pierna, tronco, smoothstep(0.82, 1.0, p.y));
            // El brazo engorda alrededor de su eje y se separa lo que se ensancha el tronco
            float Ga = 1.0 + (G - 1.0) * 0.7;
            vec2 h = vec2(lado * 0.19, 1.41);
            vec2 eje = vec2(lado * 0.643, -0.766);
            vec2 r = p.xy - h;
            float t = dot(r, eje);
            vec3 brazo = vec3(h + t * eje + (r - t * eje) * Ga, 0.01 + (p.z - 0.01) * Ga);
            brazo.x += lado * 0.19 * (G - 1.0);
            transformed = mix(cuerpo, brazo, datos.y);
            transformed.y = transformed.y < 0.9 ? transformed.y * PIERNAS : transformed.y - 0.9 * (1.0 - PIERNAS);
          }
        #endif
        vec2 hombro = vec2(lado * 0.19, 1.41);
        #ifdef GORDURA
          hombro = vec2(lado * 0.19 * GORDURA, 1.41 - 0.9 * (1.0 - PIERNAS));
        #endif
        vec2 rel = transformed.xy - hombro;
        transformed.xy = hombro + vec2(cg * rel.x - sg * rel.y, sg * rel.x + cg * rel.y);
        float brinco = max(0.0, sin((uTiempo * aAnim.z + aAnim.x) * 3.0));
        transformed.y += aAnim.w * brinco * brinco * 0.07;

        vParte = datos.x * 4.0;
        // En la camiseta no se usa; se elige el color vecino para que los bordes no se mezclen raro
        vec3 zapatilla = fract(aAnim.x * 7.31) > 0.5 ? vec3(0.85) : vec3(0.03);
        vColorParte = vParte < 0.5 ? (position.y > 1.2 ? aPiel : aPantalon)
          : vParte < 1.5 ? aPiel
          : vParte < 2.5 ? aPelo
          : vParte < 3.5 ? aPantalon
          : zapatilla;
        vPelo = aPelo;
        // Proyección de frente sobre la cara: barbilla abajo, ojos algo por encima del centro
        vCaraUv = vec2(0.5 + position.x * 5.6, 0.06 + (position.y - 1.555) * 4.7);
        vCaraPeso = (vParte > 0.5 && vParte < 1.5)
          ? smoothstep(0.15, 0.45, normal.z) * smoothstep(1.545, 1.575, position.y)
          : 0.0;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vParte;
        varying vec3 vColorParte;
        varying vec3 vPelo;
        varying vec2 vCaraUv;
        varying float vCaraPeso;
        #ifdef CARA
          uniform sampler2D mapaCara;
        #endif`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        if (vParte > 0.5) diffuseColor.rgb = vColorParte;
        #ifdef CARA
          vec4 cara = texture2D(mapaCara, vCaraUv);
          diffuseColor.rgb = mix(diffuseColor.rgb, cara.rgb, cara.a * vCaraPeso);
        #else
          // Cara de los muñecos: ojos (blanco y pupila), cejas del color del pelo y boca sonriente
          if (vCaraPeso > 0.0) {
            vec3 cara = diffuseColor.rgb;
            for (int i = 0; i < 2; i++) {
              float u = i == 0 ? 0.315 : 0.685;
              vec2 ojo = vCaraUv - vec2(u, 0.59);
              float blanco = 1.0 - smoothstep(0.85, 1.15, length(ojo / vec2(0.062, 0.038)));
              float pupila = 1.0 - smoothstep(0.75, 1.1, length(ojo / vec2(0.03, 0.034)));
              vec2 ceja = vCaraUv - vec2(u, 0.668);
              float lineaCeja = 1.0 - smoothstep(0.75, 1.05, length(ceja / vec2(0.075, 0.014)));
              cara = mix(cara, vec3(0.8, 0.79, 0.76), blanco);
              cara = mix(cara, vec3(0.025, 0.018, 0.012), pupila);
              cara = mix(cara, vPelo * 0.8, lineaCeja);
            }
            vec2 m = vCaraUv - vec2(0.5, 0.27);
            float labio = abs(m.y - m.x * m.x * 2.8);
            float boca = (1.0 - smoothstep(0.011, 0.021, labio)) * (1.0 - smoothstep(0.1, 0.13, abs(m.x)));
            cara = mix(cara, vec3(0.32, 0.07, 0.06), boca);
            diffuseColor.rgb = mix(diffuseColor.rgb, cara, vCaraPeso);
          }
        #endif`);
  };
}

/**
 * @param {THREE.Scene} escena
 * @param {number[][]} plazas  [x, y, z] de cada sitio de la grada (de construirPabellon)
 */
export function crearPublico(escena, plazas, { reducirMovimiento = false, anisotropia = 1 } = {}) {
  const uniformes = { uTiempo: { value: 0 } };
  const camisetas = productos.filter((p) => p.tipo === 'camiseta');

  async function cargar() {
    if (!plazas.length || !camisetas.length) return;
    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    draco.setDecoderConfig({ type: 'wasm' });
    const gltf = new GLTFLoader();
    gltf.setDRACOLoader(draco);
    const cargadorTex = new THREE.TextureLoader();
    const [modelo, ...texturas] = await Promise.all([
      gltf.loadAsync('/pabellon/aficionado.glb'),
      ...camisetas.map((p) => cargadorTex.loadAsync(`/pabellon/aficion-${p.id}.webp`)),
    ]);
    draco.dispose();
    for (const tex of texturas) {
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = anisotropia;
    }

    let geometria = null;
    modelo.scene.traverse((o) => {
      if (o.isMesh && !geometria) geometria = o.geometry;
    });
    geometria.setAttribute('datos', geometria.getAttribute('color'));
    geometria.deleteAttribute('color');

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const eje = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    const color = new THREE.Color();

    // Una malla instanciada para un grupo de aficionados con la misma camiseta (y cara, si la hay).
    // Cada uno: { plaza, gesto, piel, pelo, giro, escala }
    function crearGrupo(lista, textura, cara = null, complexion = null) {
      if (!lista.length) return;
      const material = new THREE.MeshStandardMaterial({ map: textura, roughness: 0.78 });
      vestir(material, uniformes, cara, complexion);
      const n = lista.length;
      const geo = geometria.clone();
      const anim = new Float32Array(n * 4);
      const tonos = { aPiel: new Float32Array(n * 3), aPelo: new Float32Array(n * 3), aPantalon: new Float32Array(n * 3) };
      const malla = new THREE.InstancedMesh(geo, material, n);
      lista.forEach((a, i) => {
        // Miran a la pista (+x)
        q.setFromAxisAngle(eje, Math.PI / 2 + a.giro);
        s.setScalar(a.escala);
        malla.setMatrixAt(i, m.compose(p.set(...a.plaza), q, s));
        anim.set([Math.random() * 100, a.gesto, 0.8 + Math.random() * 0.45, a.gesto < 3 && Math.random() < 0.55 ? 1 : 0], i * 4);
        color.set(a.piel).toArray(tonos.aPiel, i * 3);
        color.set(a.pelo).toArray(tonos.aPelo, i * 3);
        color.set(azar(PANTALON)).toArray(tonos.aPantalon, i * 3);
      });
      geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 4));
      for (const [nombre, datos] of Object.entries(tonos)) geo.setAttribute(nombre, new THREE.InstancedBufferAttribute(datos, 3));
      malla.computeBoundingSphere();
      escena.add(malla);
    }

    // Los aficionados reales, en primera fila lo más cerca posible de su z
    const libres = [...plazas];
    const yPrimera = Math.min(...libres.map(([, y]) => y));
    for (const a of aficionados) {
      let mejor = -1;
      libres.forEach(([, y, z], i) => {
        if (y === yPrimera && (mejor < 0 || Math.abs(z - a.z) < Math.abs(libres[mejor][2] - a.z))) mejor = i;
      });
      if (mejor < 0) continue;
      const [plaza] = libres.splice(mejor, 1);
      const k = Math.max(0, camisetas.findIndex((c) => c.id === a.camiseta));
      const cara = await cargadorTex.loadAsync(a.cara).catch(() => null);
      if (cara) {
        cara.colorSpace = THREE.SRGBColorSpace;
        cara.anisotropy = anisotropia;
      }
      crearGrupo([{ plaza, gesto: a.gesto ?? 0, piel: a.piel, pelo: a.pelo, giro: 0, escala: a.escala ?? 0.95 }], texturas[k], cara, a.complexion ?? null);
    }

    // El resto del público: camiseta, gesto, colores y estatura al azar
    const grupos = camisetas.map(() => []);
    const pesos = camisetas.map((_, i) => REPARTO[i] ?? 0.1);
    for (const plaza of libres) {
      grupos[sortear(pesos)].push({
        plaza,
        gesto: sortear(GESTOS),
        piel: azar(PIEL),
        pelo: azar(PELO),
        giro: (Math.random() - 0.5) * 0.5,
        escala: 0.92 + Math.random() * 0.14,
      });
    }
    grupos.forEach((lista, k) => crearGrupo(lista, texturas[k]));
  }

  cargar().catch((error) => console.warn('No se pudo cargar el público de la grada', error));

  return {
    // Sin animaciones se quedan quietos en su gesto
    actualizar(t) {
      if (!reducirMovimiento) uniformes.uTiempo.value = t;
    },
  };
}
