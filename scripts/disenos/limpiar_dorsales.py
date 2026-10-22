"""Borra el nombre y el dorsal de muestra ("ELÍAS 16") de la espalda de los diseños.

Los diseños originales vienen personalizados. Este script reconstruye el fondo bajo
el nombre y el número y guarda la versión limpia, que es la que usa Blender.

    python scripts/disenos/limpiar_dorsales.py

Entrada:  assets/disenos/originales/<id>.jpg   (delantero y espalda juntos, fondo negro)
Salida:   assets/disenos/<id>.png

Si un diseño nuevo ya viene sin nombre ni dorsal, basta con copiarlo como PNG a
assets/disenos/ y no añadirlo aquí.
"""

from pathlib import Path

import cv2
import numpy as np

RAIZ = Path(__file__).resolve().parents[2]
ORIGEN = RAIZ / "assets" / "disenos" / "originales"
DESTINO = RAIZ / "assets" / "disenos"

# Cajas (x0, y0, x1, y1) en píxeles del diseño original que contienen el texto a borrar.
NOMBRE = (2690, 405, 2895, 520)
DORSAL_BAJO = (2540, 600, 3075, 1132)  # número bajo la franja (1ª y portero)
DORSAL_ALTO = (2540, 545, 3075, 1082)  # Borricá: el número empieza más arriba

# "plano": fondo de colores lisos. "ondas": anillos concéntricos de dos tonos (Borricá),
# con el punto (x, y) que cae dentro del anillo central, junto al cuello.
DISENOS = {
    "primera": {"cajas": [NOMBRE, DORSAL_BAJO], "fondo": "plano"},
    "segunda": {"cajas": [NOMBRE, DORSAL_ALTO], "fondo": "ondas", "centro": (2800, 380)},
    "portero": {"cajas": [NOMBRE, DORSAL_BAJO], "fondo": "plano"},
}


def colores_de_fondo(img, caja, borde=6, minimo=0.12):
    """Colores dominantes del marco de la caja (el fondo que rodea al texto)."""
    x0, y0, x1, y1 = caja
    marco = np.concatenate([
        img[y0:y0 + borde, x0:x1].reshape(-1, 3),
        img[y1 - borde:y1, x0:x1].reshape(-1, 3),
        img[y0:y1, x0:x0 + borde].reshape(-1, 3),
        img[y0:y1, x1 - borde:x1].reshape(-1, 3),
    ]).astype(np.int32)
    cuant = (marco // 12) * 12 + 6
    valores, cuentas = np.unique(cuant, axis=0, return_counts=True)
    orden = np.argsort(-cuentas)
    colores = []
    for i in orden:
        if cuentas[i] / len(marco) < minimo:
            break
        cercanos = marco[np.abs(cuant - valores[i]).sum(axis=1) == 0]
        colores.append(np.median(cercanos, axis=0))
    return np.array(colores, dtype=np.float32)


def mascara_texto(img, caja):
    """Píxeles del texto dentro de la caja: lo que no se parece a ningún color del fondo."""
    x0, y0, x1, y1 = caja
    fondo = colores_de_fondo(img, caja)
    zona = img[y0:y1, x0:x1].astype(np.float32)
    dist = np.min(np.linalg.norm(zona[:, :, None, :] - fondo[None, None, :, :], axis=3), axis=2)
    texto = (dist > 18).astype(np.uint8) * 255
    # Cierra las líneas finas interiores del número y cubre el antialias del borde
    texto = cv2.morphologyEx(texto, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (17, 17)))
    texto = cv2.dilate(texto, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (13, 13)))
    mascara = np.zeros(img.shape[:2], np.uint8)
    mascara[y0:y1, x0:x1] = texto
    return mascara, fondo


def limpiar_plano(img, cajas):
    salida = img.copy()
    for caja in cajas:
        mascara, fondo = mascara_texto(salida, caja)
        relleno = cv2.inpaint(salida, mascara, 12, cv2.INPAINT_NS).astype(np.float32)
        # Fondo liso: cada píxel reconstruido toma el color de fondo más cercano
        idx = np.argmin(np.linalg.norm(relleno[:, :, None, :] - fondo[None, None, :, :], axis=3), axis=2)
        plano = cv2.GaussianBlur(fondo[idx], (0, 0), 1.2)
        sel = mascara > 0
        salida[sel] = np.clip(plano[sel], 0, 255).astype(np.uint8)
    return salida


def armonica(valor, libre, niveles=(8, 4, 2, 1), pasos=(4000, 2000, 800, 300)):
    """Rellena las celdas libres resolviendo la ecuación de Laplace (multimalla + Jacobi).

    Una función armónica no tiene máximos ni mínimos dentro del hueco, así que sus curvas
    de nivel no pueden formar anillos cerrados nuevos: solo unen lo que entra por el borde.
    """
    alto, ancho = valor.shape
    conocido = ~libre
    solucion = None
    for f, n in zip(niveles, pasos):
        h, w = -(-alto // f), -(-ancho // f)
        pad = ((0, h * f - alto), (0, w * f - ancho))
        v = np.pad(np.where(conocido, valor, 0), pad).reshape(h, f, w, f).sum(axis=(1, 3))
        c = np.pad(conocido.astype(np.float32), pad).reshape(h, f, w, f).sum(axis=(1, 3))
        fijo = c > 0
        v = np.where(fijo, v / np.maximum(c, 1), 0).astype(np.float32)
        if solucion is None:
            v[~fijo] = v[fijo].mean()
        else:
            previo = cv2.resize(solucion, (w, h), interpolation=cv2.INTER_LINEAR)
            v[~fijo] = previo[~fijo]
        for _ in range(n):
            p = np.pad(v, 1, mode="edge")
            media = (p[1:-1, :-2] + p[1:-1, 2:] + p[:-2, 1:-1] + p[2:, 1:-1]) * 0.25
            v = np.where(fijo, v, media)
        solucion = v
    return solucion[:alto, :ancho]


def limpiar_ondas(img, cajas, centro):
    """Reconstruye los anillos de dos tonos de la Borricá bajo el texto.

    1. Zona a reconstruir: el texto y los trocitos de fondo que asoman entre las letras.
    2. Con lo que se ve alrededor se numeran los anillos desde el central (0, 1, 2...) y
       cada píxel recibe una fase continua = número de anillo + posición dentro de él.
    3. En la zona tapada la fase se interpola de forma armónica y de ella salen los
       anillos: continuos, suaves y sin anillos inventados.
    """
    hueco = np.zeros(img.shape[:2], np.uint8)
    for caja in cajas:
        hueco |= mascara_texto(img, caja)[0]

    # Ventana de trabajo alrededor del hueco y del cuello
    ys, xs = np.nonzero(hueco)
    x0, x1 = max(xs.min() - 260, 0), min(xs.max() + 260, img.shape[1])
    y0, y1 = max(min(ys.min(), centro[1]) - 160, 0), min(ys.max() + 220, img.shape[0])
    ven = img[y0:y1, x0:x1]
    hue = hueco[y0:y1, x0:x1] > 0
    cx, cy = centro[0] - x0, centro[1] - y0

    # 1. Zona a reconstruir. Los trocitos de fondo entre las cifras (el hueco del 6, entre
    #    el 1 y el 6, entre nombre y número) también entran: si se dejan fijos, quedan
    #    como islas sueltas y además unen anillos que no se tocan.
    envolvente = cv2.morphologyEx(hue.astype(np.uint8), cv2.MORPH_CLOSE,
                                  cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (121, 121))) > 0
    envolvente |= hue

    lum = ven.astype(np.float32).mean(axis=2)
    oscuro = (lum > 6) & (lum < 22) & ~envolvente
    claro = (lum >= 22) & (lum < 50) & ~envolvente
    colores = np.array([np.median(ven[oscuro], axis=0), np.median(ven[claro], axis=0)], np.float32)

    # 2. Numeración de anillos: distancia en el grafo de vecindad desde el anillo central
    comps = []
    for oscura, sel in ((True, oscuro), (False, claro)):
        n, lab = cv2.connectedComponents(sel.astype(np.uint8), connectivity=8)
        tam = np.bincount(lab.ravel())
        for i in range(1, n):
            if tam[i] >= 400:
                comps.append((oscura, lab == i))
    oscuras = [o for o, _ in comps]
    comps = [m for _, m in comps]
    nucleo = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    dil = [cv2.dilate(m.astype(np.uint8), nucleo) > 0 for m in comps]
    # Anillo central: la mancha oscura más cercana al punto de referencia del cuello
    cerca = np.zeros(lum.shape, np.uint8)
    cerca[cy, cx] = 1
    d_centro = cv2.distanceTransform(1 - cerca, cv2.DIST_L2, 5)
    inicio = min((i for i in range(len(comps)) if oscuras[i]), key=lambda i: d_centro[comps[i]].min())
    anillo = {inicio: 0}
    cola = [inicio]
    while cola:
        i = cola.pop(0)
        for j, m in enumerate(comps):
            if j not in anillo and (dil[i] & m).any():
                anillo[j] = anillo[i] + 1
                cola.append(j)

    indice = np.full(lum.shape, -1, np.int32)
    for i, k in anillo.items():
        indice[comps[i]] = k

    fase = np.full(lum.shape, np.nan, np.float32)
    for k in range(indice.max() + 1):
        dentro = indice == k
        hay_in = k > 0 and (indice == k - 1).any()
        hay_out = (indice == k + 1).any()
        d_in = cv2.distanceTransform((indice != k - 1).astype(np.uint8), cv2.DIST_L2, 5) if hay_in else None
        d_out = cv2.distanceTransform((indice != k + 1).astype(np.uint8), cv2.DIST_L2, 5) if hay_out else None
        if d_in is not None and d_out is not None:
            f = d_in / np.maximum(d_in + d_out, 1e-3)
        elif d_out is not None:
            f = 1 - np.clip(d_out / 70.0, 0, 1)
        elif d_in is not None:
            f = np.clip(d_in / 70.0, 0, 1)
        else:
            continue
        fase[dentro] = k + np.clip(f[dentro], 0.02, 0.98)

    # 3. Fase armónica en la zona tapada, calculada solo con lo que se ve alrededor
    libre = envolvente | np.isnan(fase)
    fase_h = armonica(np.nan_to_num(fase, nan=0.0), libre)
    tono = np.where(oscuro, 0, np.where(claro, 1, -1))
    tono[envolvente] = np.floor(fase_h[envolvente]).astype(np.int32) % 2

    # 4. Manchas pequeñas sueltas junto a la zona reconstruida: trozos de anillo que han
    #    quedado aislados. Se funden con el anillo que las rodea.
    cerca = cv2.dilate(envolvente.astype(np.uint8), cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (81, 81))) > 0
    retocar = envolvente.copy()
    for t in (0, 1):
        n, lab, stats, _ = cv2.connectedComponentsWithStats((tono == t).astype(np.uint8), connectivity=8)
        for i in range(1, n):
            if stats[i, cv2.CC_STAT_AREA] < 6000:
                m = lab == i
                if (m & cerca).any():
                    tono[m] = 1 - t
                    retocar |= m

    plano = cv2.GaussianBlur(colores[np.clip(tono, 0, 1)], (0, 0), 1.0)
    salida = img.copy()
    trozo = salida[y0:y1, x0:x1]
    trozo[retocar] = np.clip(plano[retocar], 0, 255).astype(np.uint8)
    return salida


def main():
    for nombre, cfg in DISENOS.items():
        origen = ORIGEN / f"{nombre}.jpg"
        img = cv2.imread(str(origen), cv2.IMREAD_COLOR)
        if img is None:
            raise SystemExit(f"No se encuentra {origen}")
        if cfg["fondo"] == "ondas":
            img = limpiar_ondas(img, cfg["cajas"], cfg["centro"])
        else:
            img = limpiar_plano(img, cfg["cajas"])
        destino = DESTINO / f"{nombre}.png"
        cv2.imwrite(str(destino), img)
        print(f"{nombre}: {destino.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
