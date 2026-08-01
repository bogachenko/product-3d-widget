from __future__ import annotations

import base64
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, addition: str, label: str) -> str:
    index = text.find(marker)
    if index < 0:
        raise RuntimeError(f"{label}: marker not found")
    return text[:index] + addition + text[index:]


product = read("src/product-3d-widget.ts")
product = replace_once(
    product,
    "export interface RangeSource {\n  readonly kind: 'range';\n  readonly clipName: string;\n  readonly startSeconds: number;\n  readonly endSeconds: number;\n}\n",
    "export interface RangeSource {\n  readonly kind: 'range';\n  readonly clipName: string;\n  readonly startSeconds: number;\n  readonly endSeconds: number;\n}\n\nexport interface RestPoseConfig {\n  readonly kind: 'animation-end';\n  readonly animationId: string;\n}\n",
    "RestPoseConfig interface",
)
product = replace_once(
    product,
    "  readonly usdzUrl?: string;\n  readonly colors?: readonly ColorVariantConfig[];",
    "  readonly usdzUrl?: string;\n  readonly restPose?: RestPoseConfig;\n  readonly colors?: readonly ColorVariantConfig[];",
    "ProductConfiguration restPose",
)
product = replace_once(
    product,
    "  | 'ANIMATION_DISABLED'\n  | 'SCENARIO_DISABLED'",
    "  | 'ANIMATION_DISABLED'\n  | 'REST_POSE_DISABLED'\n  | 'SCENARIO_DISABLED'",
    "WidgetErrorCode rest pose",
)
write("src/product-3d-widget.ts", product)

configuration = read("src/configuration.ts")
configuration = replace_once(
    configuration,
    "  ProductConfiguration,\n  RangeSource,",
    "  ProductConfiguration,\n  RangeSource,\n  RestPoseConfig,",
    "RestPoseConfig import",
)
configuration = replace_once(
    configuration,
    "export interface NormalizedScenario {",
    "export interface NormalizedRestPose extends RestPoseConfig {}\n\nexport interface NormalizedScenario {",
    "NormalizedRestPose",
)
configuration = replace_once(
    configuration,
    "  readonly usdzUrl: string | null;\n  readonly colorsById:",
    "  readonly usdzUrl: string | null;\n  readonly restPose: NormalizedRestPose | null;\n  readonly colorsById:",
    "normalized configuration restPose",
)
normalize_rest_pose = """const normalizeRestPose = (
  value: unknown,
  animationsById: ReadonlyMap<string, NormalizedAnimation>,
  localErrors: WidgetError[],
): NormalizedRestPose | null => {
  if (value === undefined) return null;
  if (!isObject(value)
    || value.kind !== 'animation-end'
    || !nonEmptyString(value.animationId)
    || !animationsById.has(value.animationId.trim())) {
    localErrors.push(error(
      'REST_POSE_DISABLED',
      'animation',
      'restPose must reference the endpoint of an enabled configured animation.',
      isObject(value) && nonEmptyString(value.animationId) ? value.animationId.trim() : undefined,
    ));
    return null;
  }
  return Object.freeze({
    kind: 'animation-end',
    animationId: value.animationId.trim(),
  });
};

"""
configuration = insert_before(
    configuration,
    "const normalizeScenarios = (",
    normalize_rest_pose,
    "normalizeRestPose",
)
configuration = replace_once(
    configuration,
    "  const animationsById = normalizeAnimations(input.animations, variantsById, localErrors);\n  const scenariosById = normalizeScenarios(input.scenarios, animationsById, localErrors);",
    "  const animationsById = normalizeAnimations(input.animations, variantsById, localErrors);\n  const restPose = normalizeRestPose(input.restPose, animationsById, localErrors);\n  const scenariosById = normalizeScenarios(input.scenarios, animationsById, localErrors);",
    "normalize restPose call",
)
configuration = replace_once(
    configuration,
    "    usdzUrl,\n    colorsById,",
    "    usdzUrl,\n    restPose,\n    colorsById,",
    "normalized restPose assignment",
)
write("src/configuration.ts", configuration)

viewer = read("src/three-viewer.ts")
viewer = replace_once(
    viewer,
    "  readonly #baseTransforms = new Map<Object3D, TransformSnapshot>();\n  readonly #baseVisibility",
    "  readonly #baseTransforms = new Map<Object3D, TransformSnapshot>();\n  readonly #ordinaryTransforms = new Map<Object3D, TransformSnapshot>();\n  readonly #baseVisibility",
    "ordinary transform map",
)
viewer = replace_once(
    viewer,
    "      const result = this.#validateModelBoundCapabilities();\n      this.#currentSelection = result.selection;\n      this.#restoreBasePose();\n      this.#applySelectionDirect();",
    "      const result = this.#validateModelBoundCapabilities();\n      this.#captureOrdinaryPose();\n      this.#currentSelection = result.selection;\n      this.#restoreOrdinaryTransforms();\n      this.#applySelectionDirect();",
    "initialize ordinary pose",
)
viewer = replace_once(
    viewer,
    "    this.#baseTransforms.clear();\n    this.#baseVisibility.clear();",
    "    this.#baseTransforms.clear();\n    this.#ordinaryTransforms.clear();\n    this.#baseVisibility.clear();",
    "clear ordinary transforms while indexing",
)
viewer = replace_once(
    viewer,
    "    for (const scenario of this.#config!.scenariosById.values()) {",
    "    const restPose = this.#config!.restPose;\n    if (restPose !== null && !this.#enabledAnimations.has(restPose.animationId)) {\n      localErrors.push(localError(\n        'REST_POSE_DISABLED',\n        'animation',\n        `restPose animation \"${restPose.animationId}\" is unavailable in the loaded model; the GLB base pose is used.`,\n        restPose.animationId,\n      ));\n    }\n\n    for (const scenario of this.#config!.scenariosById.values()) {",
    "model-bound restPose validation",
)
helpers = """  #captureTransforms(target: Map<Object3D, TransformSnapshot>): void {
    target.clear();
    this.#root!.traverse((object) => {
      const morphTargetInfluences = object instanceof Mesh && object.morphTargetInfluences !== undefined
        ? Object.freeze([...object.morphTargetInfluences])
        : null;
      target.set(object, Object.freeze({
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
        morphTargetInfluences,
      }));
    });
  }

  #restoreTransforms(source: ReadonlyMap<Object3D, TransformSnapshot>): void {
    for (const [object, snapshot] of source) {
      object.position.copy(snapshot.position);
      object.quaternion.copy(snapshot.quaternion);
      object.scale.copy(snapshot.scale);
      if (object instanceof Mesh && object.morphTargetInfluences !== undefined && snapshot.morphTargetInfluences !== null) {
        object.morphTargetInfluences.splice(0, object.morphTargetInfluences.length, ...snapshot.morphTargetInfluences);
      }
    }
  }

  #captureOrdinaryPose(): void {
    this.#restoreBasePose();
    const restPose = this.#config!.restPose;
    if (restPose === null || !this.#enabledAnimations.has(restPose.animationId)) {
      for (const [object, snapshot] of this.#baseTransforms) this.#ordinaryTransforms.set(object, snapshot);
      return;
    }

    const animation = this.#config!.animationsById.get(restPose.animationId)!;
    const clip = this.#clipsByName.get(animation.source.clipName)!;
    const action = this.#mixer!.clipAction(clip);
    const endSeconds = animation.source.kind === 'range'
      ? Math.min(animation.source.endSeconds, clip.duration)
      : clip.duration;
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = true;
    action.setLoop(LoopOnce, 1);
    action.play();
    action.time = endSeconds;
    this.#mixer!.update(0);
    this.#captureTransforms(this.#ordinaryTransforms);
    action.stop();
    this.#mixer!.stopAllAction();
    this.#restoreBasePose();
  }

  #restoreOrdinaryTransforms(): void {
    this.#mixer?.stopAllAction();
    this.#restoreTransforms(this.#ordinaryTransforms.size > 0
      ? this.#ordinaryTransforms
      : this.#baseTransforms);
  }

"""
viewer = insert_before(viewer, "  #restoreBasePose(): void {", helpers, "rest pose helpers")
viewer = replace_once(
    viewer,
    """  #restoreBasePose(): void {
    this.#mixer?.stopAllAction();
    for (const [object, snapshot] of this.#baseTransforms) {
      object.position.copy(snapshot.position);
      object.quaternion.copy(snapshot.quaternion);
      object.scale.copy(snapshot.scale);
      if (object instanceof Mesh && object.morphTargetInfluences !== undefined && snapshot.morphTargetInfluences !== null) {
        object.morphTargetInfluences.splice(0, object.morphTargetInfluences.length, ...snapshot.morphTargetInfluences);
      }
    }
  }
""",
    """  #restoreBasePose(): void {
    this.#mixer?.stopAllAction();
    this.#restoreTransforms(this.#baseTransforms);
  }
""",
    "restoreBasePose",
)
viewer = replace_once(
    viewer,
    "    this.#restoreBasePose();\n    this.#applySelectionDirect();\n    if (camera !== null) this.#restoreCamera(camera);",
    "    this.#restoreOrdinaryTransforms();\n    this.#applySelectionDirect();\n    if (camera !== null) this.#restoreCamera(camera);",
    "ordinary reset",
)
viewer = replace_once(
    viewer,
    "    this.#baseTransforms.clear();\n    this.#baseVisibility.clear();\n    this.#baseMaterialColors.clear();",
    "    this.#baseTransforms.clear();\n    this.#ordinaryTransforms.clear();\n    this.#baseVisibility.clear();\n    this.#baseMaterialColors.clear();",
    "release ordinary transforms",
)
write("src/three-viewer.ts", viewer)

unit_test = """import { describe, expect, it } from 'vitest';
import { normalizeProductConfiguration } from '../src/configuration.js';

const configuration = {
  productId: 'rest-pose-validation',
  glbUrl: '/tests/fixtures/product.gltf',
  variants: [{
    id: 'base',
    label: 'Base',
    isDefault: true,
    isBase: true,
    visibleNodeNames: [],
    hiddenNodeNames: [],
  }],
  animations: [{
    id: 'assemble',
    label: 'Assemble',
    source: { kind: 'clip', clipName: 'Pulse' },
    compatibleVariantIds: ['base'],
  }],
};

describe('restPose normalization', () => {
  it('accepts an animation endpoint reference', () => {
    const result = normalizeProductConfiguration({
      ...configuration,
      restPose: { kind: 'animation-end', animationId: 'assemble' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.configuration.restPose).toEqual({
      kind: 'animation-end',
      animationId: 'assemble',
    });
  });

  it('falls back locally without disabling a valid animation', () => {
    const result = normalizeProductConfiguration({
      ...configuration,
      restPose: { kind: 'animation-end', animationId: 'missing' },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.configuration.restPose).toBeNull();
    expect([...result.configuration.animationsById.keys()]).toEqual(['assemble']);
    expect(result.configuration.localErrors).toContainEqual(expect.objectContaining({
      code: 'REST_POSE_DISABLED',
      scope: 'animation',
      entityId: 'missing',
    }));
  });
});
"""
write("tests/rest-pose.test.ts", unit_test)

positions = struct.pack("<9f", -0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0)
indices = struct.pack("<3H", 0, 1, 2)
times = struct.pack("<2f", 0.0, 1.0)
scales = struct.pack("<6f", 1.0, 1.0, 1.0, 2.0, 1.0, 1.0)
buffer = positions + indices + b"\x00\x00" + times + scales
fixture = {
    "asset": {"version": "2.0", "generator": "product-3d-widget rest pose tests"},
    "scene": 0,
    "scenes": [{"nodes": [0]}],
    "nodes": [{"name": "Product", "mesh": 0}],
    "meshes": [{"name": "ProductMesh", "primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
    "materials": [{"name": "Body", "pbrMetallicRoughness": {"baseColorFactor": [0.2, 0.4, 0.8, 1], "metallicFactor": 0, "roughnessFactor": 0.8}}],
    "animations": [{"name": "Assemble", "samplers": [{"input": 2, "output": 3, "interpolation": "LINEAR"}], "channels": [{"sampler": 0, "target": {"node": 0, "path": "scale"}}]}],
    "buffers": [{"byteLength": len(buffer), "uri": "data:application/octet-stream;base64," + base64.b64encode(buffer).decode()}],
    "bufferViews": [
        {"buffer": 0, "byteOffset": 0, "byteLength": 36, "target": 34962},
        {"buffer": 0, "byteOffset": 36, "byteLength": 6, "target": 34963},
        {"buffer": 0, "byteOffset": 44, "byteLength": 8},
        {"buffer": 0, "byteOffset": 52, "byteLength": 24},
    ],
    "accessors": [
        {"bufferView": 0, "componentType": 5126, "count": 3, "type": "VEC3", "min": [-0.5, -0.5, 0], "max": [0.5, 0.5, 0]},
        {"bufferView": 1, "componentType": 5123, "count": 3, "type": "SCALAR"},
        {"bufferView": 2, "componentType": 5126, "count": 2, "type": "SCALAR", "min": [0], "max": [1]},
        {"bufferView": 3, "componentType": 5126, "count": 2, "type": "VEC3", "min": [1, 1, 1], "max": [2, 1, 1]},
    ],
}
write("tests/fixtures/rest-pose.gltf", json.dumps(fixture, separators=(",", ":")))

browser_test = """import { expect, test } from 'playwright/test';

const configuration = {
  productId: 'configured-rest-pose',
  glbUrl: '/tests/fixtures/rest-pose.gltf',
  restPose: { kind: 'animation-end', animationId: 'assemble' },
  variants: [{
    id: 'base', label: 'Base', isDefault: true, isBase: true,
    visibleNodeNames: [], hiddenNodeNames: [],
  }],
  animations: [{
    id: 'assemble', label: 'Assemble',
    source: { kind: 'clip', clipName: 'Assemble' },
    compatibleVariantIds: ['base'],
  }],
};

const visiblePixelCount = async (page: any): Promise<number> => page.locator('#widget canvas').evaluate(
  (canvas: HTMLCanvasElement) => {
    const gl = canvas.getContext('webgl2');
    if (gl === null) throw new Error('WebGL 2 context is unavailable.');
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0;
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 16) count += 1;
    return count;
  },
);

test('shows an animation-end rest pose initially and restores it after playback', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Deterministic framebuffer assertion runs in Chromium.');
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);

  const outcome = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as HTMLElement & {
      configure(value: object): Promise<{ outcome: string }>;
    };
    widget.id = 'widget';
    widget.style.width = '400px';
    widget.style.height = '300px';
    document.body.append(widget);
    return (await widget.configure(config)).outcome;
  }, configuration);
  expect(outcome).toBe('ready');

  const initialPixels = await visiblePixelCount(page);
  expect(initialPixels).toBeGreaterThan(100);
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().error)).toBeNull();

  const startResult = await page.locator('#widget').evaluate(async (widget: any) => widget.playAnimation('assemble'));
  expect(startResult).toMatchObject({ accepted: true, outcome: 'completed' });
  await page.waitForTimeout(120);
  const earlyPixels = await visiblePixelCount(page);
  expect(earlyPixels).toBeLessThan(initialPixels * 0.8);

  await expect.poll(() => page.locator('#widget').evaluate((widget: any) => widget.getState().lifecycle)).toBe('STATE-READY');
  const restoredPixels = await visiblePixelCount(page);
  expect(Math.abs(restoredPixels - initialPixels) / initialPixels).toBeLessThan(0.03);
});
"""
write("tests/rest-pose.spec.ts", browser_test)
