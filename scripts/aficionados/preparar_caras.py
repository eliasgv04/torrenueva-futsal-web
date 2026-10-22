"""Prepara las caras de los aficionados reales de la grada.

    python3 scripts/aficionados/preparar_caras.py

Lee src/data/aficionados.json y, por cada aficionado, recorta su cara de la foto original
(assets/aficionados/, que no se publica) y la guarda en public/pabellon/caras/ como un WebP de
256 x 256 con los bordes difuminados. El recorte es un cuadrado [x0, y0, x1, y1] en píxeles de
la foto, con la barbilla cerca del borde de abajo, el nacimiento del pelo cerca del de arriba y
los ojos un poco por encima del centro: así casa con la cabeza del aficionado de la web.
"""

import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parents[2]
DATOS = RAIZ / "src" / "data" / "aficionados.json"
LADO = 256


def mascara(lado):
    """Óvalo de la cara con el borde difuminado (alfa 1 dentro, 0 fuera)."""
    y, x = np.mgrid[0:lado, 0:lado] / (lado - 1)
    d = np.hypot((x - 0.5) / 0.45, (y - 0.5) / 0.48)
    return np.clip((1.0 - d) / 0.18, 0, 1)


def main():
    for a in json.loads(DATOS.read_text(encoding="utf-8")):
        foto = ImageOps.exif_transpose(Image.open(RAIZ / a["foto"])).convert("RGB")
        cara = foto.crop(tuple(a["recorte"])).resize((LADO, LADO), Image.LANCZOS)
        rgba = np.dstack([np.asarray(cara), (mascara(LADO) * 255).astype(np.uint8)])
        salida = RAIZ / "public" / a["cara"].lstrip("/")
        salida.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(rgba, "RGBA").save(salida, "WEBP", quality=90)
        print(f"{a['nombre']}: {salida.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
