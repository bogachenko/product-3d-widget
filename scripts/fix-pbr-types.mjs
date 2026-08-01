import fs from 'node:fs';
const path = 'src/three-viewer.ts';
const input = fs.readFileSync(path, 'utf8');
const from = `surface: NonNullable<ReturnType<typeof this.#config.colorsById.get>>['surface']`;
const to = `surface: { readonly repeat: readonly [number, number]; readonly offset: readonly [number, number]; readonly rotation: number } | null`;
if (!input.includes(from)) throw new Error('Expected PBR surface type fragment not found');
fs.writeFileSync(path, input.replace(from, to));
