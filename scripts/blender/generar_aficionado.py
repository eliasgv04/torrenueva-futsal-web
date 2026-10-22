"""Genera el aficionado de la grada del pabellón y las texturas de sus camisetas.

    blender --background --python scripts/blender/generar_aficionado.py
    blender --background --python scripts/blender/generar_aficionado.py -- --vista carpeta/

(`npm run modelos` también lo lanza). Con --vista guarda además unas vistas de
comprobación (de frente y de lado) en esa carpeta.

  1. Modela una persona de 1,74 m: esqueleto de vértices con el modificador Skin y una
     subdivisión, cabeza con nariz y orejas, y pelo. Brazos abiertos en "A" (50º bajo la
     horizontal), que es como caen las mangas en los diseños.
  2. Marca cada vértice en su color (COLOR_0) para que la web lo vista y lo anime:
       R = parte (0 camiseta, 1 piel, 2 pelo, 3 pantalón, 4 zapatillas) / 4
       G = cuánto le afecta el giro del brazo (0 nada, 1 todo; suave en el hombro)
       B = lado del brazo (0 izquierda, 1 derecha, mirando desde delante)
  3. UV de la camiseta: proyección de frente sobre un atlas con el delantero a la
     izquierda y la espalda a la derecha.
  4. Exporta public/pabellon/aficionado.glb (Draco) y, por cada camiseta de
     src/data/productos.json, public/pabellon/aficion-<id>.webp (atlas de 1024 x 512).
"""

import json
import math
import sys
from pathlib import Path

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from generar_camisetas import (  # noqa: E402
    DATOS, RAIZ, cargar_imagen, crear_imagen, extender_bordes, muestrear, separar_vistas,
)

SALIDA = RAIZ / "public" / "pabellon"

# Medidas en metros (Blender: Z arriba, la persona mira hacia -Y)
HOMBRO = (0.19, 1.41)          # x, z del hombro (la web gira el brazo alrededor de este punto)
ANGULO_BRAZO = math.radians(50)
LARGO_BRAZO = (0.30, 0.27, 0.11)  # hombro-codo, codo-muñeca, mano
MANGA = 0.16                   # largo de la manga desde el hombro
CINTURA = 0.88                 # bajo de la camiseta
CUELLO_CAMISETA = 1.52         # altura del cuello en el diseño
MEDIO_ANCHO_DISENO = 0.36      # medio ancho que cubre el diseño (de manga a manga)
LADO_ATLAS = 512


# ---------------------------------------------------------------- malla

def esqueleto():
    """Vértices (posición, radios del Skin) y aristas del cuerpo, sin la cabeza."""
    v = []
    a = []

    def punto(p, r, desde=None):
        v.append((p, r))
        i = len(v) - 1
        if desde is not None:
            a.append((desde, i))
        return i

    pelvis = punto((0, 0, 0.96), (0.19, 0.135))
    cintura = punto((0, 0, 1.08), (0.18, 0.13), pelvis)
    pecho = punto((0, 0.005, 1.27), (0.215, 0.145), cintura)
    hombros = punto((0, 0.01, 1.41), (0.2, 0.13), pecho)
    cuello = punto((0, 0.01, 1.50), (0.07, 0.07), hombros)
    punto((0, 0.0, 1.57), (0.064, 0.064), cuello)

    c, s = math.cos(ANGULO_BRAZO), math.sin(ANGULO_BRAZO)
    for lado in (-1, 1):
        hx, hz = HOMBRO
        h = punto((lado * hx, 0.01, hz), (0.08, 0.08), hombros)
        d = 0
        prev = h
        for largo, radio in zip(LARGO_BRAZO, ((0.062, 0.062), (0.046, 0.046), (0.052, 0.026))):
            d += largo
            prev = punto((lado * (hx + d * c), 0.01, hz - d * s), radio, prev)

        cadera = punto((lado * 0.1, 0, 0.90), (0.11, 0.11), pelvis)
        rodilla = punto((lado * 0.105, 0.0, 0.50), (0.075, 0.075), cadera)
        tobillo = punto((lado * 0.105, 0.02, 0.09), (0.052, 0.052), rodilla)
        punto((lado * 0.105, -0.12, 0.035), (0.055, 0.036), tobillo)
    return v, a


def cuerpo():
    verts, aristas = esqueleto()
    malla = bpy.data.meshes.new("esqueleto")
    malla.from_pydata([p for p, _ in verts], aristas, [])
    obj = bpy.data.objects.new("esqueleto", malla)
    bpy.context.collection.objects.link(obj)
    skin = obj.modifiers.new("skin", "SKIN")
    skin.branch_smoothing = 0.6
    datos = malla.skin_vertices[0].data
    for i, (_, r) in enumerate(verts):
        datos[i].radius = r
    datos[0].use_root = True
    sub = obj.modifiers.new("sub", "SUBSURF")
    sub.levels = 1
    sub.render_levels = 1
    dg = bpy.context.evaluated_depsgraph_get()
    evaluada = obj.evaluated_get(dg)
    resultado = bpy.data.meshes.new_from_object(evaluada)
    bpy.data.objects.remove(obj)
    return resultado


def esfera(centro, radio, escala, seg=20, anillos=14):
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anillos, radius=radio)
    for vert in bm.verts:
        vert.co.x = vert.co.x * escala[0] + centro[0]
        vert.co.y = vert.co.y * escala[1] + centro[1]
        vert.co.z = vert.co.z * escala[2] + centro[2]
    return bm


def a_arrays(bm):
    bm.verts.ensure_lookup_table()
    pos = np.array([v.co[:] for v in bm.verts], np.float32)
    caras = [[v.index for v in f.verts] for f in bm.faces]
    bm.free()
    return pos, caras


def cabeza():
    """Cabeza, nariz y orejas (piel) y pelo, como listas de (posiciones, caras, parte)."""
    import bmesh
    piezas = []
    centro = (0, -0.005, 1.665)
    piezas.append((*a_arrays(esfera(centro, 0.1, (0.86, 0.98, 1.13), 24, 16)), 1))
    piezas.append((*a_arrays(esfera((0, -0.1, 1.655), 0.02, (0.75, 0.9, 1.35), 10, 8)), 1))
    for lado in (-1, 1):
        piezas.append((*a_arrays(esfera((lado * 0.085, 0.0, 1.665), 0.026, (0.35, 0.75, 1.15), 10, 8)), 1))

    # Pelo: casquete algo mayor que la cabeza, que deja la cara al aire
    bm = esfera((0, 0.0, 1.675), 0.103, (0.89, 1.01, 1.09), 24, 16)
    fuera = [v for v in bm.verts if v.co.z < 1.6 or (v.co.z < 1.70 and v.co.y < -0.035)]
    bmesh.ops.delete(bm, geom=fuera, context="VERTS")
    piezas.append((*a_arrays(bm), 2))
    return piezas


def clasificar(pos):
    """Parte, peso del brazo y lado de cada vértice del cuerpo."""
    n = len(pos)
    parte = np.full(n, 0, np.int32)
    peso = np.zeros(n, np.float32)
    lado = (pos[:, 0] > 0).astype(np.float32)

    c, s = math.cos(ANGULO_BRAZO), math.sin(ANGULO_BRAZO)
    signo = np.where(pos[:, 0] > 0, 1.0, -1.0)
    hx, hz = HOMBRO
    rel_x = pos[:, 0] - signo * hx
    rel_z = pos[:, 2] - hz
    t = rel_x * signo * c - rel_z * s               # avance a lo largo del brazo
    perp = np.hypot(rel_x * signo * s + rel_z * c, pos[:, 1] - 0.01)
    brazo = (perp < 0.1) & (t > -0.05) & (pos[:, 2] > 0.8)
    peso[brazo] = np.clip((t[brazo] + 0.03) / 0.09, 0, 1)
    peso = peso * peso * (3 - 2 * peso)

    z = pos[:, 2]
    parte[(z >= CINTURA) & (z > 1.465)] = 1         # cuello
    parte[brazo & (t > MANGA)] = 1                  # antebrazo y mano
    parte[(z < CINTURA) & ~brazo] = 3               # pantalón
    parte[(z < 0.11) & ~brazo] = 4                  # zapatillas
    return parte, peso, lado


def uv_camiseta(pos, normales):
    """Proyección de frente: delantero en la mitad izquierda del atlas, espalda en la derecha."""
    u = np.clip((pos[:, 0] + MEDIO_ANCHO_DISENO) / (2 * MEDIO_ANCHO_DISENO), 0.002, 0.998) * 0.5
    u = np.where(normales[:, 1] > 0, u + 0.5, u)    # +Y es la espalda
    v = np.clip((pos[:, 2] - CINTURA) / (CUELLO_CAMISETA - CINTURA), 0.002, 0.998)
    return np.stack([u, v], 1)


def construir():
    m = cuerpo()
    pos_c = np.array([v.co[:] for v in m.vertices], np.float32)
    caras_c = [list(p.vertices) for p in m.polygons]
    bpy.data.meshes.remove(m)
    parte_c, peso_c, lado_c = clasificar(pos_c)

    posiciones = [pos_c]
    caras = list(caras_c)
    partes = [parte_c]
    pesos = [peso_c]
    lados = [lado_c]
    base = len(pos_c)
    for pos, cs, parte in cabeza():
        posiciones.append(pos)
        caras += [[i + base for i in f] for f in cs]
        partes.append(np.full(len(pos), parte, np.int32))
        pesos.append(np.zeros(len(pos), np.float32))
        lados.append(np.zeros(len(pos), np.float32))
        base += len(pos)

    pos = np.vstack(posiciones)
    parte = np.concatenate(partes)
    peso = np.concatenate(pesos)
    lado = np.concatenate(lados)

    malla = bpy.data.meshes.new("aficionado")
    malla.from_pydata(pos.tolist(), [], caras)
    malla.update()
    for p in malla.polygons:
        p.use_smooth = True

    normales = np.array([v.normal[:] for v in malla.vertices], np.float32)
    uv_vert = uv_camiseta(pos, normales)
    capa = malla.uv_layers.new(name="UVMap")
    for bucle in malla.loops:
        capa.data[bucle.index].uv = uv_vert[bucle.vertex_index]

    color = malla.color_attributes.new("Color", "FLOAT_COLOR", "POINT")
    datos = np.zeros((len(pos), 4), np.float32)
    datos[:, 0] = parte / 4
    datos[:, 1] = peso
    datos[:, 2] = lado
    datos[:, 3] = 1
    color.data.foreach_set("color", datos.ravel())
    malla.color_attributes.active_color = color
    malla.color_attributes.render_color_index = 0
    malla.validate(clean_customdata=False)

    obj = bpy.data.objects.new("aficionado", malla)
    bpy.context.collection.objects.link(obj)
    print(f"   aficionado: {len(malla.vertices)} vértices, {len(malla.polygons)} caras")
    return obj


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
        export_materials="NONE",
        export_vertex_color="ACTIVE",
        export_all_vertex_colors=False,
        export_active_vertex_color_when_no_material=True,
        export_colors=True,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
        export_draco_color_quantization=10,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_extras=False,
    )
    validas = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    bpy.ops.export_scene.gltf(**{k: v for k, v in opciones.items() if k in validas})
    print(f"   {ruta.relative_to(RAIZ)}: {ruta.stat().st_size / 1024:.0f} KB")


# ---------------------------------------------------------------- texturas

def atlas_camiseta(producto):
    """Delantero | espalda (reflejada, vista desde delante), con el fondo relleno del color del borde."""
    rgba = cargar_imagen(RAIZ / producto["diseno"])
    rgb = rgba[:, :, :3]
    (m_del, c_del), (m_esp, c_esp) = separar_vistas(rgba)
    mitades = []
    for mascara, (x0, y0, x1, y1), reflejar in ((m_del, c_del, False), (m_esp, c_esp, True)):
        xs = x0 + (np.arange(LADO_ATLAS) + 0.5) * (x1 - x0) / LADO_ATLAS
        if reflejar:
            xs = xs[::-1]
        ys = y0 + (np.arange(LADO_ATLAS) + 0.5) * (y1 - y0) / LADO_ATLAS
        gx, gy = np.meshgrid(xs, ys)
        color = muestrear(rgb, gx - 0.5, gy - 0.5)
        dentro = mascara[np.clip(gy.astype(int), 0, rgba.shape[0] - 1), np.clip(gx.astype(int), 0, rgba.shape[1] - 1)]
        mitades.append(extender_bordes(color, dentro, pasos=40))
    atlas = np.hstack(mitades)
    return np.dstack([atlas, np.ones(atlas.shape[:2], np.float32)])


def guardar_atlas(rgba, ruta):
    img = crear_imagen(ruta.stem, rgba)
    img.filepath_raw = str(ruta)
    img.file_format = "WEBP"
    try:
        img.save(filepath=str(ruta), quality=82)
    except TypeError:
        img.save()
    bpy.data.images.remove(img)
    print(f"   {ruta.relative_to(RAIZ)}: {ruta.stat().st_size / 1024:.0f} KB")


# ---------------------------------------------------------------- vista de comprobación

def vistas(obj, carpeta, atlas):
    """Render rápido (Workbench) de frente y de lado con la primera camiseta."""
    carpeta.mkdir(parents=True, exist_ok=True)
    img = crear_imagen("atlas", atlas)
    mat = bpy.data.materials.new("vista")
    if not mat.node_tree:
        mat.use_nodes = True
    nodos = mat.node_tree.nodes
    tex = nodos.new("ShaderNodeTexImage")
    tex.image = img
    col = nodos.new("ShaderNodeVertexColor")
    col.layer_name = "Color"
    mezcla = nodos.new("ShaderNodeMix")
    mezcla.data_type = "RGBA"
    sep = nodos.new("ShaderNodeSeparateColor")
    mat.node_tree.links.new(col.outputs["Color"], sep.inputs["Color"])
    menor = nodos.new("ShaderNodeMath")
    menor.operation = "GREATER_THAN"
    menor.inputs[1].default_value = 0.1
    mat.node_tree.links.new(sep.outputs["Red"], menor.inputs[0])
    mat.node_tree.links.new(menor.outputs[0], mezcla.inputs["Factor"])
    mat.node_tree.links.new(tex.outputs["Color"], mezcla.inputs["A"])
    mezcla.inputs["B"].default_value = (0.78, 0.58, 0.45, 1)
    bsdf = nodos.get("Principled BSDF")
    mat.node_tree.links.new(mezcla.outputs["Result"], bsdf.inputs["Base Color"])
    obj.data.materials.append(mat)

    escena = bpy.context.scene
    escena.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in {e.identifier for e in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items} else "BLENDER_EEVEE"
    escena.view_settings.view_transform = "Standard"
    escena.render.resolution_x = 600
    escena.render.resolution_y = 900
    mundo = bpy.data.worlds.new("mundo")
    mundo.color = (0.35, 0.35, 0.38)
    escena.world = mundo
    luz = bpy.data.objects.new("luz", bpy.data.lights.new("luz", "SUN"))
    luz.rotation_euler = (math.radians(50), 0, math.radians(-30))
    bpy.context.collection.objects.link(luz)
    cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 2.0
    bpy.context.collection.objects.link(cam)
    escena.camera = cam
    for nombre, pos, rot in (
        ("frente", (0, -5, 0.9), (math.radians(90), 0, 0)),
        ("lado", (5, 0, 0.9), (math.radians(90), 0, math.radians(90))),
        ("espalda", (0, 5, 0.9), (math.radians(90), 0, math.radians(180))),
    ):
        cam.location = pos
        cam.rotation_euler = rot
        escena.render.filepath = str(carpeta / f"aficionado-{nombre}.png")
        bpy.ops.render.render(write_still=True)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    SALIDA.mkdir(parents=True, exist_ok=True)
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    carpeta_vista = Path(args[args.index("--vista") + 1]) if "--vista" in args else None

    print("\n== aficionado")
    obj = construir()
    exportar(obj, SALIDA / "aficionado.glb")

    primero = None
    for p in json.loads(DATOS.read_text(encoding="utf-8")):
        if p.get("tipo") != "camiseta":
            continue
        atlas = atlas_camiseta(p)
        guardar_atlas(atlas, SALIDA / f"aficion-{p['id']}.webp")
        if primero is None:
            primero = atlas
    if carpeta_vista and primero is not None:
        vistas(obj, carpeta_vista, primero)


if __name__ == "__main__":
    main()
