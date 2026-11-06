import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const noticias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/noticias' }),
  schema: z.object({
    titulo:      z.string(),
    // coerce: el panel (/admin) puede guardar la fecha como texto "2026-11-06"
    fecha:       z.coerce.date(),
    imagen:      z.string(),
    descripcion: z.string(),
    autor:       z.string().optional(),
  }),
});

export const collections = { noticias };
