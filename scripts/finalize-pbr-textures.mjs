import fs from 'node:fs';

const path = 'src/three-viewer.ts';
let text = fs.readFileSync(path, 'utf8');

const applyFrom = `          if (loaded !== undefined) {
            material.map = loaded.baseColorTexture;
            material.normalMap = loaded.normalTexture;
            material.roughnessMap = loaded.metallicRoughnessTexture;
            material.metalnessMap = loaded.metallicRoughnessTexture;
            material.aoMap = loaded.occlusionTexture;
            if (color.surface !== null) material.normalScale.set(color.surface.normalScale[0], color.surface.normalScale[1]);
          }`;
const applyTo = `          if (loaded !== undefined) {
            if (loaded.baseColorTexture !== null) material.map = loaded.baseColorTexture;
            if (loaded.normalTexture !== null) material.normalMap = loaded.normalTexture;
            if (loaded.metallicRoughnessTexture !== null) {
              material.roughnessMap = loaded.metallicRoughnessTexture;
              material.metalnessMap = loaded.metallicRoughnessTexture;
            }
            if (loaded.occlusionTexture !== null) material.aoMap = loaded.occlusionTexture;
            if (color.surface !== null && loaded.normalTexture !== null) {
              material.normalScale.set(color.surface.normalScale[0], color.surface.normalScale[1]);
            }
          }`;
if (!text.includes(applyFrom)) throw new Error('PBR application fragment not found');
text = text.replace(applyFrom, applyTo);

const cleanupFrom = `    } catch { /* cleanup continues */ }
    try { this.#mixer?.stopAllAction(); } catch { /* cleanup continues */ }`;
const cleanupTo = `    } catch { /* cleanup continues */ }
    for (const surface of this.#loadedSurfaces.values()) {
      for (const texture of [surface.baseColorTexture, surface.normalTexture, surface.metallicRoughnessTexture, surface.occlusionTexture]) {
        if (texture !== null && !disposedTextures.has(texture)) {
          disposedTextures.add(texture);
          try { texture.dispose(); } catch { /* cleanup continues */ }
        }
      }
    }
    try { this.#mixer?.stopAllAction(); } catch { /* cleanup continues */ }`;
if (!text.includes(cleanupFrom)) throw new Error('Resource cleanup fragment not found');
text = text.replace(cleanupFrom, cleanupTo);

fs.writeFileSync(path, text);
