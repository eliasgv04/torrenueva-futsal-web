// Lanza los scripts de Blender en segundo plano:
//   npm run modelos                       → camisetas, carnet y aficionado de la grada
//   npm run modelos -- primera-equipacion → solo los productos indicados
//   npm run modelos -- aficionado         → solo el aficionado y las camisetas de la grada
// Busca Blender en la variable BLENDER, en el PATH y en las rutas de instalación habituales.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ruta = (nombre) => fileURLToPath(new URL(`./${nombre}`, import.meta.url));

function candidatos() {
  const lista = [];
  if (process.env.BLENDER) lista.push(process.env.BLENDER);
  if (process.platform === 'win32') {
    const base = join(process.env.ProgramFiles || 'C:\\Program Files', 'Blender Foundation');
    if (existsSync(base)) {
      for (const d of readdirSync(base).sort().reverse()) lista.push(join(base, d, 'blender.exe'));
    }
  } else if (process.platform === 'darwin') {
    lista.push('/Applications/Blender.app/Contents/MacOS/Blender');
  }
  lista.push('blender');
  return lista;
}

const blender = candidatos().find((c) => c === 'blender' || existsSync(c));
const pedidos = process.argv.slice(2);
const productos = pedidos.filter((p) => p !== 'aficionado');
const trabajos = [];
if (!pedidos.length || productos.length) trabajos.push(['generar_camisetas.py', productos]);
if (!pedidos.length || pedidos.includes('aficionado')) trabajos.push(['generar_aficionado.py', []]);

for (const [script, extra] of trabajos) {
  const r = spawnSync(blender, ['--background', '--factory-startup', '--python', ruta(script), '--', ...extra], { stdio: 'inherit' });
  if (r.error) {
    console.error('No encuentro Blender. Instálalo o indica su ruta en la variable BLENDER.');
    process.exit(1);
  }
  if (r.status) process.exit(r.status);
}
