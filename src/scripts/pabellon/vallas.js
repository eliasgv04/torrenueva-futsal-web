// Vallas (lonas) de los patrocinadores en la franja amarilla de la pared del fondo.
import * as THREE from 'three';
import { ANCHO_BAHIA, ORO, lienzo } from './base.js';
import { prepararLogo } from '../logos.js';

const FILAS_VALLAS = [4.2, 2.86];

// La principal, grande, va en la bahía central; el resto por nivel, alternando a derecha
// e izquierda desde el centro. Devuelve también la media anchura que necesita el pabellón.
export function distribuirVallas(lista) {
  const vallas = [];
  if (!lista.length) return { vallas, bahiasUsadas: new Set([0]), anillos: 1, mitad: 15 };

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
  const anillos = Math.max(anillo, 2);
  return { vallas, bahiasUsadas, anillos, mitad: Math.max(15, anillos * ANCHO_BAHIA + 3) };
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

// Crea las lonas con su halo dorado (para el hover). Devuelve [{ lona, halo, valla, brillo }].
export function crearVallas(escena, patrocinadores, vallas, logosImg, anisotropia) {
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
  return lonas;
}
