import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const noticias = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/noticias' }),
  schema: z.object({
    titulo:      z.string(),
    fecha:       z.date(),
    imagen:      z.string(),
    descripcion: z.string(),
    autor:       z.string().optional(),
  }),
});

export const collections = { noticias };
