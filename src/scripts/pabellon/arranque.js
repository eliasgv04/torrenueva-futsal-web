// Arranque común de las escenas del pabellón: comprueba WebGL, carga la escena solo cuando
// se acerca a la pantalla, mueve la barra de carga y pasa a la versión 2D si algo falla.

export function webglDisponible() {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

/**
 * @param {object} o
 * @param {boolean} o.hayContenido  Si no hay nada que mostrar, se queda la versión 2D.
 * @param {(ctx: {alProgresar: (p: number) => void, alFallar: () => void, reducirMovimiento: boolean}) => Promise<any>} o.cargar
 * @param {(control: any) => void} [o.alListo]
 */
export function arrancarEscena({ hayContenido = true, cargar, alListo = () => {} }) {
  const escena = document.querySelector('[data-escena]');
  const aviso = document.querySelector('[data-aviso]');
  const carga = escena.querySelector('[data-carga]');
  const barra = escena.querySelector('[data-carga-barra]');
  const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mostrarVersion2D() {
    escena.hidden = true;
    aviso.hidden = false;
  }

  async function iniciar() {
    try {
      const control = await cargar({
        reducirMovimiento,
        alProgresar: (p) => {
          barra.style.transform = `scaleX(${p})`;
        },
        alFallar: mostrarVersion2D,
      });
      carga.hidden = true;
      escena.classList.add('is-lista');
      alListo(control);
    } catch (error) {
      console.warn('No se pudo cargar el pabellón 3D', error);
      mostrarVersion2D();
    }
  }

  if (!hayContenido || !webglDisponible()) {
    mostrarVersion2D();
    return { escena, reducirMovimiento };
  }
  escena.hidden = false;
  const observador = new IntersectionObserver(
    (entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        observador.disconnect();
        iniciar();
      }
    },
    { rootMargin: '300px' },
  );
  observador.observe(escena);
  return { escena, reducirMovimiento };
}
