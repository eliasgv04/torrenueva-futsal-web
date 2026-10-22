"""Genera los modelos 3D de las camisetas de la tienda a partir de sus diseños.

    blender --background --python scripts/blender/generar_camisetas.py
    blender --background --python scripts/blender/generar_camisetas.py -- primera-equipacion

(o simplemente `npm run modelos`, que busca Blender en las rutas habituales)

Lee src/data/productos.json y, para cada producto de tipo "camiseta":
  1. Carga su diseño (delantero y espalda juntos sobre fondo negro, en assets/disenos/).
  2. Separa delantero y espalda, quita el fondo y los encuadra.
  3. Construye la camiseta con la silueta del propio diseño: un panel delantero y otro
     trasero unidos por el borde e inflados, como una camiseta colgada en su percha, con
     una caída suave de la tela hacia el bajo.
  4. UV: cada panel es una isla con su imagen proyectada tal cual, sin deformación.
     Los costados (donde se unen los paneles) toman el color del borde del diseño.
  5. Material de tela sintética: poco brillo y algo de sheen.
  6. Exporta public/tienda/<id>.glb (texturas WebP, malla con Draco) y las imágenes
     planas public/tienda/<id>-delante.webp y <id>-detras.webp (fondo transparente).

Los productos de tipo "carnet" no llevan modelo (la tarjeta se monta en la web): solo se
recorta su diseño en public/tienda/<id>-delante.webp.
"""

import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

RAIZ = Path(__file__).resolve().parents[2]
DATOS = RAIZ / "src" / "data" / "productos.json"
SALIDA = RAIZ / "public" / "tienda"

ALTO_CAMISETA = 0.74   # m, del cuello al bajo
GROSOR = 0.032         # m, medio grosor del inflado en el centro del panel
RADIO_BORDE = 0.07     # m, distancia al borde en la que la tela pasa de plana a inflada
PASO_INTERIOR = 0.02   # m, separación de los vértices interiores
PASO_BORDE = 0.012     # m, separación máxima entre vértices del contorno
TEXTURA_MAX = 2048     # px, lado máximo de las texturas del modelo
PLANA_MAX = 1024       # px, lado máximo de las imágenes planas para la web
UMBRAL_FONDO = 0.025   # luminancia por encima de la cual ya no es fondo negro


# ---------------------------------------------------------------- imágenes

def cargar_imagen(ruta):
    """Devuelve la imagen como array (alto, ancho, 4) en [0, 1], con la fila 0 arriba."""
    img = bpy.data.images.load(str(ruta), check_existing=False)
    ancho, alto = img.size
    px = np.empty(ancho * alto * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return px.reshape(alto, ancho, 4)[::-1].copy()


def crear_imagen(nombre, rgba, alpha=False):
    """Crea una imagen de Blender (empaquetada) a partir de un array con la fila 0 arriba."""
    alto, ancho = rgba.shape[:2]
    img = bpy.data.images.new(nombre, ancho, alto, alpha=alpha)
    img.pixels.foreach_set(np.ascontiguousarray(rgba[::-1], np.float32).ravel())
    img.update()
    return img


def guardar_webp(rgba, ruta, lado_max):
    img = crear_imagen(ruta.stem, rgba, alpha=True)
    ancho, alto = img.size
    k = min(1.0, lado_max / max(ancho, alto))
    if k < 1.0:
        img.scale(max(1, round(ancho * k)), max(1, round(alto * k)))
    img.filepath_raw = str(ruta)
    img.file_format = "WEBP"
    try:
        img.save(filepath=str(ruta), quality=86)
    except TypeError:
        img.save()
    bpy.data.images.remove(img)


def muestrear(img, xs, ys):
    """Muestreo bilineal de img en las coordenadas (xs, ys) en píxeles."""
    alto, ancho = img.shape[:2]
    x0 = np.clip(np.floor(xs).astype(np.int32), 0, ancho - 1)
    y0 = np.clip(np.floor(ys).astype(np.int32), 0, alto - 1)
    x1 = np.clip(x0 + 1, 0, ancho - 1)
    y1 = np.clip(y0 + 1, 0, alto - 1)
    fx = np.clip(xs - x0, 0, 1)[..., None]
    fy = np.clip(ys - y0, 0, 1)[..., None]
    arriba = img[y0, x0] * (1 - fx) + img[y0, x1] * fx
    abajo = img[y1, x0] * (1 - fx) + img[y1, x1] * fx
    return arriba * (1 - fy) + abajo * fy


# ---------------------------------------------------------------- máscaras

def dilatar(m, pasos=1):
    for _ in range(pasos):
        p = np.pad(m, 1)
        m = p[1:-1, 1:-1] | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]
    return m


def inundar(semilla, permitido):
    """Región de `permitido` conectada con `semilla` (relleno por dilataciones sucesivas)."""
    actual = semilla & permitido
    total = actual.sum()
    while True:
        actual = dilatar(actual, 8) & permitido
        nuevo = actual.sum()
        if nuevo == total:
            return actual
        total = nuevo


def rellenar_huecos(m):
    """Rellena los huecos interiores (zonas de fondo no conectadas con el borde)."""
    fondo = ~m
    borde = np.zeros_like(m)
    borde[0, :] = borde[-1, :] = borde[:, 0] = borde[:, -1] = True
    exterior = inundar(borde, fondo)
    return m | (fondo & ~exterior)


def separar_vistas(rgba):
    """Máscaras del delantero (mitad izquierda) y de la espalda (mitad derecha)."""
    alto, ancho = rgba.shape[:2]
    lum = rgba[:, :, :3].mean(axis=2)
    claro = lum > UMBRAL_FONDO
    f = 4  # se trabaja a 1/4 para ir rápido
    peq = claro[: alto // f * f, : ancho // f * f].reshape(alto // f, f, ancho // f, f).any(axis=(1, 3))

    vistas = []
    for x0, x1 in ((0, peq.shape[1] // 2), (peq.shape[1] // 2, peq.shape[1])):
        mitad = np.zeros_like(peq)
        mitad[:, x0:x1] = peq[:, x0:x1]
        ys, xs = np.nonzero(mitad)
        cy, cx = ys.mean(), xs.mean()
        d = (ys - cy) ** 2 + (xs - cx) ** 2
        semilla = np.zeros_like(peq)
        semilla[ys[d.argmin()], xs[d.argmin()]] = True
        comp = rellenar_huecos(inundar(semilla, peq))
        grande = np.repeat(np.repeat(dilatar(comp, 1), f, 0), f, 1)
        grande = np.pad(grande, ((0, alto - grande.shape[0]), (0, ancho - grande.shape[1])))
        mascara = rellenar_huecos(claro & grande)
        ys, xs = np.nonzero(mascara)
        caja = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        vistas.append((mascara, caja))
    return vistas


def extender_bordes(rgb, mascara, pasos=24):
    """Rellena fuera de la máscara repitiendo el color del borde (evita costuras al filtrar)."""
    rgb = rgb.copy()
    dentro = mascara.copy()
    for _ in range(pasos):
        p = np.pad(rgb * dentro[..., None], ((1, 1), (1, 1), (0, 0)))
        c = np.pad(dentro.astype(np.float32), 1)
        suma = p[1:-1, :-2] + p[1:-1, 2:] + p[:-2, 1:-1] + p[2:, 1:-1]
        n = c[1:-1, :-2] + c[1:-1, 2:] + c[:-2, 1:-1] + c[2:, 1:-1]
        nuevos = ~dentro & (n > 0)
        rgb[nuevos] = suma[nuevos] / n[nuevos][:, None]
        dentro |= nuevos
    if (~dentro).any():
        rgb[~dentro] = np.median(rgb[mascara], axis=0)
    return rgb


# ---------------------------------------------------------------- contorno

def contorno(campo, iso=0.5):
    """Contornos de nivel (marching squares) de un campo 2D. Coordenadas (x, y) del campo."""
    v = np.pad(campo, 1)
    alto, ancho = v.shape
    dentro = v > iso
    caso = (dentro[:-1, :-1] * 8 + dentro[:-1, 1:] * 4 + dentro[1:, 1:] * 2 + dentro[1:, :-1] * 1)
    tabla = {
        1: [("L", "B")], 2: [("B", "R")], 3: [("L", "R")], 4: [("T", "R")],
        5: [("T", "R"), ("L", "B")], 6: [("T", "B")], 7: [("T", "L")], 8: [("T", "L")],
        9: [("T", "B")], 10: [("T", "L"), ("B", "R")], 11: [("T", "R")], 12: [("L", "R")],
        13: [("R", "B")], 14: [("L", "B")],
    }

    def clave(lado, i, j):
        return {"T": ("h", i, j), "B": ("h", i + 1, j), "L": ("v", i, j), "R": ("v", i, j + 1)}[lado]

    vecinos = {}
    for i, j in zip(*np.nonzero((caso > 0) & (caso < 15))):
        for a, b in tabla[int(caso[i, j])]:
            ka, kb = clave(a, i, j), clave(b, i, j)
            vecinos.setdefault(ka, []).append(kb)
            vecinos.setdefault(kb, []).append(ka)

    def punto(k):
        tipo, i, j = k
        if tipo == "h":
            t = (iso - v[i, j]) / (v[i, j + 1] - v[i, j])
            return (j + t - 1, i - 1)
        t = (iso - v[i, j]) / (v[i + 1, j] - v[i, j])
        return (j - 1, i + t - 1)

    lazos = []
    visto = set()
    for inicio in vecinos:
        if inicio in visto:
            continue
        lazo = [inicio]
        visto.add(inicio)
        previo, actual = None, inicio
        while True:
            sig = [k for k in vecinos[actual] if k != previo]
            if not sig or sig[0] == inicio:
                break
            previo, actual = actual, sig[0]
            if actual in visto:
                break
            visto.add(actual)
            lazo.append(actual)
        lazos.append(np.array([punto(k) for k in lazo], np.float64))
    return lazos


def simplificar(puntos, tolerancia):
    """Douglas-Peucker sobre un polígono cerrado."""
    def dp(p):
        if len(p) < 3:
            return p
        a, b = p[0], p[-1]
        ab = b - a
        largo = np.hypot(*ab)
        if largo < 1e-9:
            d = np.hypot(*(p - a).T)
        else:
            d = np.abs(ab[0] * (p[:, 1] - a[1]) - ab[1] * (p[:, 0] - a[0])) / largo
        k = int(d.argmax())
        if d[k] <= tolerancia:
            return np.array([a, b])
        return np.vstack([dp(p[: k + 1])[:-1], dp(p[k:])])

    lejano = int(np.hypot(*(puntos - puntos[0]).T).argmax())
    mitad1 = dp(puntos[: lejano + 1])
    mitad2 = dp(np.vstack([puntos[lejano:], puntos[:1]]))
    return np.vstack([mitad1[:-1], mitad2[:-1]])


def densificar(puntos, paso):
    salida = []
    n = len(puntos)
    for i in range(n):
        a, b = puntos[i], puntos[(i + 1) % n]
        partes = max(1, int(math.ceil(np.hypot(*(b - a)) / paso)))
        for k in range(partes):
            salida.append(a + (b - a) * (k / partes))
    return np.array(salida)


def distancia_a_poligono(p, poli):
    a = poli
    b = np.roll(poli, -1, axis=0)
    mejor = np.full(len(p), np.inf)
    for i in range(0, len(a), 256):
        aa, bb = a[i:i + 256], b[i:i + 256]
        ab = bb - aa
        ap = p[:, None, :] - aa[None, :, :]
        t = np.clip((ap * ab[None]).sum(-1) / np.maximum((ab ** 2).sum(-1), 1e-12)[None], 0, 1)
        proy = aa[None] + t[..., None] * ab[None]
        mejor = np.minimum(mejor, np.hypot(*(p[:, None, :] - proy).transpose(2, 0, 1)).min(axis=1))
    return mejor


# ---------------------------------------------------------------- camiseta

def preparar_paneles(rgba):
    """Delantero y espalda encuadrados en el mismo marco (el del delantero)."""
    (m_del, c_del), (m_esp, c_esp) = separar_vistas(rgba)
    x0, y0, x1, y1 = c_del
    ancho, alto = x1 - x0, y1 - y0
    rgb = rgba[:, :, :3]

    delantero = rgb[y0:y1, x0:x1]
    mascara_del = m_del[y0:y1, x0:x1]

    # La espalda se encaja en el marco del delantero y se refleja: vista desde detrás,
    # su izquierda queda a la derecha del marco.
    ex0, ey0, ex1, ey1 = c_esp
    xs = ex1 - (np.arange(ancho) + 0.5) * (ex1 - ex0) / ancho
    ys = ey0 + (np.arange(alto) + 0.5) * (ey1 - ey0) / alto
    gx, gy = np.meshgrid(xs, ys)
    espalda = muestrear(rgb, gx - 0.5, gy - 0.5)
    mascara_esp = m_esp[np.clip(gy.astype(int), 0, rgba.shape[0] - 1), np.clip(gx.astype(int), 0, rgba.shape[1] - 1)]

    union = rellenar_huecos(mascara_del | mascara_esp)
    planas = (
        np.dstack([delantero, mascara_del.astype(np.float32)]),
        np.dstack([rgb[ey0:ey1, ex0:ex1], m_esp[ey0:ey1, ex0:ex1].astype(np.float32)]),
    )

    # Lo que se ve del panel contrario por el cuello: la cara interior, más oscura
    tex_del = np.where(mascara_del[..., None], delantero, espalda * 0.55)
    tex_esp = np.where(mascara_esp[..., None], espalda, delantero * 0.55)
    tex_del = extender_bordes(tex_del, union)
    tex_esp = extender_bordes(tex_esp, union)
    return union, tex_del, tex_esp, planas


def construir_malla(nombre, union, materiales):
    alto_px, ancho_px = union.shape
    escala = ALTO_CAMISETA / alto_px  # metros por píxel

    # Contorno con precisión de subpíxel sobre la silueta reducida a 1/4
    f = 4
    h, w = alto_px // f, ancho_px // f
    campo = union[: h * f, : w * f].reshape(h, f, w, f).mean(axis=(1, 3))
    lazos = contorno(campo)
    lazo = max(lazos, key=len)
    lazo = (lazo + 0.5) * f  # a píxeles
    lazo = simplificar(lazo, 1.2)
    lazo = densificar(lazo, PASO_BORDE / escala)

    # Puntos interiores en rejilla, lejos del borde
    paso = PASO_INTERIOR / escala
    gx, gy = np.meshgrid(np.arange(paso / 2, ancho_px, paso), np.arange(paso / 2, alto_px, paso))
    rej = np.column_stack([gx.ravel(), gy.ravel()])
    dentro = union[np.clip(rej[:, 1].astype(int), 0, alto_px - 1), np.clip(rej[:, 0].astype(int), 0, ancho_px - 1)]
    rej = rej[dentro]
    rej = rej[distancia_a_poligono(rej, lazo) > paso * 0.55]

    # Triangulación restringida al contorno (en píxeles, y hacia arriba)
    n_borde = len(lazo)
    puntos = [Vector((x, -y)) for x, y in np.vstack([lazo, rej])]
    aristas = [(i, (i + 1) % n_borde) for i in range(n_borde)]
    verts, _, caras, *_ = delaunay_2d_cdt(puntos, aristas, [list(range(n_borde))], 1, 1e-6)
    p2 = np.array([(v.x, -v.y) for v in verts])  # vuelve a (x, y) en píxeles

    # Inflado redondeado hacia el borde y pliegues suaves que crecen hacia el bajo
    d = distancia_a_poligono(p2, lazo) * escala
    perfil = np.sqrt(1 - (1 - np.clip(d / RADIO_BORDE, 0, 1)) ** 2)
    X = (p2[:, 0] - ancho_px / 2) * escala
    Z = -p2[:, 1] * escala
    caida = np.clip((-Z - 0.28) / (ALTO_CAMISETA - 0.28), 0, 1) ** 1.4
    pliegues = (0.011 * np.sin(2 * math.pi * X / 0.17 + 0.6) + 0.005 * np.sin(2 * math.pi * X / 0.075 + 2.2)) * caida
    pliegues *= np.clip(d / RADIO_BORDE, 0, 1)
    hinchado = GROSOR * perfil * (1 + 0.15 * caida)

    # Vértices: los del contorno se comparten; los interiores, uno por panel.
    # Blender: X derecha, Z arriba, el delantero mira hacia -Y.
    en_borde = d < 1e-6
    coords = []
    idx_del = np.empty(len(p2), int)
    idx_esp = np.empty(len(p2), int)
    for i in range(len(p2)):
        if en_borde[i]:
            idx_del[i] = idx_esp[i] = len(coords)
            coords.append((X[i], 0.0, Z[i]))
        else:
            idx_del[i] = len(coords)
            coords.append((X[i], -hinchado[i] - pliegues[i], Z[i]))
            idx_esp[i] = len(coords)
            coords.append((X[i], hinchado[i] * 0.9 - pliegues[i], Z[i]))

    caras_del = [[int(idx_del[a]) for a in c] for c in caras]
    caras_esp = [[int(idx_esp[a]) for a in reversed(c)] for c in caras]
    malla = bpy.data.meshes.new(nombre)
    malla.from_pydata(coords, [], caras_del + caras_esp)
    malla.update()

    # UV: proyección plana del marco común. La textura de la espalda ya va reflejada.
    uv = malla.uv_layers.new(name="UVMap")
    uvs = np.column_stack([p2[:, 0] / ancho_px, 1 - p2[:, 1] / alto_px])
    n = len(caras)
    for k, poly in enumerate(malla.polygons):
        tri = caras[k] if k < n else list(reversed(caras[k - n]))
        poly.material_index = 0 if k < n else 1
        poly.use_smooth = True
        for li, vi in zip(poly.loop_indices, tri):
            uv.data[li].uv = uvs[vi]

    for m in materiales:
        malla.materials.append(m)
    malla.validate(clean_customdata=False)  # quita triángulos degenerados de la triangulación
    obj = bpy.data.objects.new(nombre, malla)
    bpy.context.collection.objects.link(obj)
    return obj, len(coords), len(malla.polygons)


def material_tela(nombre, imagen):
    m = bpy.data.materials.new(nombre)
    if not m.node_tree:
        m.use_nodes = True
    nodos = m.node_tree.nodes
    bsdf = nodos.get("Principled BSDF")
    tex = nodos.new("ShaderNodeTexImage")
    tex.image = imagen
    m.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    # El exportador de glTF pasa el sheen como color (tinte), así que la intensidad va en el tinte
    ajustes = {
        "Roughness": 0.84,
        "Metallic": 0.0,
        "Specular IOR Level": 0.25,
        "Sheen Weight": 1.0,
        "Sheen Roughness": 0.5,
        "Sheen Tint": (0.28, 0.28, 0.28, 1.0),
    }
    for clave, valor in ajustes.items():
        if clave in bsdf.inputs:
            bsdf.inputs[clave].default_value = valor
    m.use_backface_culling = True  # la camiseta es cerrada: una sola cara
    return m


def exportar(obj, ruta):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    opciones = dict(
        filepath=str(ruta),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="WEBP",
        export_image_quality=88,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
    )
    validas = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    bpy.ops.export_scene.gltf(**{k: v for k, v in opciones.items() if k in validas})


def generar(producto):
    ident = producto["id"]
    print(f"\n== {ident}")
    rgba = cargar_imagen(RAIZ / producto["diseno"])
    union, tex_del, tex_esp, (plana_del, plana_esp) = preparar_paneles(rgba)

    guardar_webp(plana_del, SALIDA / f"{ident}-delante.webp", PLANA_MAX)
    guardar_webp(plana_esp, SALIDA / f"{ident}-detras.webp", PLANA_MAX)

    imagenes = []
    for sufijo, tex in (("delante", tex_del), ("detras", tex_esp)):
        img = crear_imagen(f"{ident}-{sufijo}", np.dstack([tex, np.ones(tex.shape[:2], np.float32)]))
        ancho, alto = img.size
        k = min(1.0, TEXTURA_MAX / max(ancho, alto))
        if k < 1.0:
            img.scale(round(ancho * k), round(alto * k))
        img.pack()
        imagenes.append(img)

    materiales = [material_tela(f"{ident}-delante", imagenes[0]), material_tela(f"{ident}-detras", imagenes[1])]
    obj, n_verts, n_caras = construir_malla(ident, union, materiales)
    ruta = SALIDA / f"{ident}.glb"
    exportar(obj, ruta)
    print(f"   {ruta.relative_to(RAIZ)}: {n_verts} vértices, {n_caras} triángulos, {ruta.stat().st_size / 1024:.0f} KB")


def generar_carnet(producto):
    """El carnet no lleva modelo: solo se recorta su diseño (sin el margen transparente)."""
    ident = producto["id"]
    print(f"\n== {ident}")
    rgba = cargar_imagen(RAIZ / producto["diseno"])
    opaco = rgba[:, :, 3] > 0.5
    # Filas y columnas con algo de tarjeta (ignora motas sueltas del margen)
    filas = np.nonzero(opaco.mean(axis=1) > 0.05)[0]
    columnas = np.nonzero(opaco.mean(axis=0) > 0.05)[0]
    recorte = rgba[filas[0]:filas[-1] + 1, columnas[0]:columnas[-1] + 1]
    ruta = SALIDA / f"{ident}-delante.webp"
    guardar_webp(recorte, ruta, PLANA_MAX)
    print(f"   {ruta.relative_to(RAIZ)}: {recorte.shape[1]}x{recorte.shape[0]} px")


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SALIDA.mkdir(parents=True, exist_ok=True)
    productos = json.loads(DATOS.read_text(encoding="utf-8"))
    pedidos = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    for p in productos:
        if pedidos and p["id"] not in pedidos:
            continue
        if p.get("tipo") == "camiseta":
            generar(p)
        elif p.get("tipo") == "carnet" and p.get("diseno"):
            generar_carnet(p)
        bpy.ops.wm.read_factory_settings(use_empty=True)


if __name__ == "__main__":
    main()
