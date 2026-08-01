import { describe, expect, it } from 'vitest';
import { normalizeProductConfiguration } from '../src/configuration.js';
import type { ProductConfiguration } from '../src/product-3d-widget.js';

const validConfiguration = (): ProductConfiguration => ({
  productId: 'product-1',
  glbUrl: '/tests/fixtures/product.gltf',
  cameraViews: [
    { id: 'front', positionNodeName: 'CAM_Front', targetNodeName: 'FOCUS_Product', durationMs: 500 },
  ],
  colors: [
    { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [] },
    { id: 'red', label: 'Red', swatch: 'red', isDefault: false, isBase: false, materialNames: ['Body'] },
  ],
  variants: [
    { id: 'base', label: 'Base', isDefault: true, isBase: true, visibleNodeNames: [], hiddenNodeNames: [] },
    { id: 'alt', label: 'Alternative', isDefault: false, isBase: false, visibleNodeNames: ['AltNode'], hiddenNodeNames: ['BaseNode'] },
  ],
  animations: [
    { id: 'pulse-all', label: 'Pulse', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['base', 'alt'] },
    { id: 'pulse-base', label: 'Base pulse', source: { kind: 'range', clipName: 'Pulse', startSeconds: 0.1, endSeconds: 0.8 }, compatibleVariantIds: ['base'] },
  ],
  scenarios: [
    {
      id: 'tour',
      label: 'Tour',
      steps: [
        { id: 'first', description: 'First step', animationId: 'pulse-all', cameraViewId: 'front' },
        { id: 'second', description: 'Second step', animationId: 'pulse-base' },
      ],
    },
  ],
  ar: { enabled: true },
});

describe('normalizeProductConfiguration', () => {
  it('rejects a non-object without a partial configuration', () => {
    const result = normalizeProductConfiguration(null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.map((error) => error.code)).toEqual(['CONFIGURATION_INVALID']);
  });

  it('rejects missing mandatory productId and glbUrl together', () => {
    const result = normalizeProductConfiguration({});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors).toHaveLength(2);
  });

  it('rejects unsupported asset URL protocols', () => {
    const result = normalizeProductConfiguration({ productId: 'p', glbUrl: 'javascript:alert(1)' });
    expect(result.ok).toBe(false);
  });

  it('does not mutate the input and is deterministic', () => {
    const input = validConfiguration();
    const before = structuredClone(input);
    const first = normalizeProductConfiguration(input);
    const second = normalizeProductConfiguration(input);
    expect(input).toEqual(before);
    expect(first).toEqual(second);
  });

  it('ignores unknown fields', () => {
    const result = normalizeProductConfiguration({ ...validConfiguration(), unknown: { nested: true } });
    expect(result.ok).toBe(true);
    if (result.ok) expect('unknown' in result.configuration).toBe(false);
  });

  it('normalizes camera views without mutating the input', () => {
    const result = normalizeProductConfiguration(validConfiguration());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.cameraViewsById.get('front')).toEqual({
      id: 'front', positionNodeName: 'CAM_Front', targetNodeName: 'FOCUS_Product', durationMs: 500,
    });
  });

  it('disables only an invalid camera view', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      cameraViews: [...input.cameraViews!, { id: 'bad', positionNodeName: '', targetNodeName: 'FOCUS_Product' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.configuration.cameraViewsById.keys()]).toEqual(['front']);
      expect(result.configuration.localErrors.some((item) => item.code === 'CAMERA_VIEW_DISABLED' && item.entityId === 'bad')).toBe(true);
    }
  });

  it('disables only an invalid non-default color', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: [...input.colors!, { id: 'bad', label: 'Bad', swatch: 'linear-gradient(red, blue)', isDefault: false, isBase: false, materialNames: ['Body'] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect([...result.configuration.colorsById.keys()]).toEqual(['original', 'red']);
      expect(result.configuration.localErrors.some((error) => error.entityId === 'bad')).toBe(true);
    }
  });

  it('normalizes an optional PBR surface on a color variant', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: input.colors!.map((color) => color.id === 'red' ? {
        ...color,
        surface: {
          baseColorTextureUrl: '/textures/fabric-color.webp',
          normalTextureUrl: '/textures/fabric-normal.webp',
          metallicRoughnessTextureUrl: '/textures/fabric-mr.webp',
          repeat: [3, 4] as const,
          offset: [0.1, 0.2] as const,
          rotation: 0.25,
          normalScale: [0.8, 0.9] as const,
        },
      } : color),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.colorsById.get('red')!.surface).toEqual({
      baseColorTextureUrl: '/textures/fabric-color.webp',
      normalTextureUrl: '/textures/fabric-normal.webp',
      metallicRoughnessTextureUrl: '/textures/fabric-mr.webp',
      occlusionTextureUrl: null,
      repeat: [3, 4],
      offset: [0.1, 0.2],
      rotation: 0.25,
      normalScale: [0.8, 0.9],
    });
  });

  it('disables only a color variant with an invalid PBR surface', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: [...input.colors!, {
        id: 'bad-surface', label: 'Bad surface', swatch: '#fff', isDefault: false, isBase: false,
        materialNames: ['Body'], surface: { normalTextureUrl: 'javascript:bad' },
      }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.colorsById.has('bad-surface')).toBe(false);
      expect(result.configuration.localErrors.some((error) => error.entityId === 'bad-surface')).toBe(true);
    }
  });

  it('disables the color group when its declared default is invalid', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: input.colors!.map((color) => color.id === 'original' ? { ...color, swatch: '' } : color),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.colorsById.size).toBe(0);
  });

  it('disables a structural variant with overlapping visibility lists', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      variants: [...input.variants!, { id: 'overlap', label: 'Overlap', isDefault: false, isBase: false, visibleNodeNames: ['BaseNode'], hiddenNodeNames: ['BaseNode'] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.variantsById.has('overlap')).toBe(false);
  });

  it('disables the structural group when the default variant is invalid', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      variants: input.variants!.map((variant) => variant.id === 'base'
        ? { ...variant, visibleNodeNames: ['BaseNode'], hiddenNodeNames: ['BaseNode'] }
        : variant),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.variantsById.size).toBe(0);
      expect(result.configuration.animationsById.size).toBe(0);
    }
  });

  it('disables animations with an invalid range', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      animations: [{ id: 'bad-range', label: 'Bad', source: { kind: 'range', clipName: 'Pulse', startSeconds: 1, endSeconds: 1 }, compatibleVariantIds: ['base'] }],
      scenarios: undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.animationsById.size).toBe(0);
  });

  it('disables animations with an empty or unknown structural whitelist', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      animations: [
        { id: 'empty', label: 'Empty', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: [] },
        { id: 'unknown', label: 'Unknown', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['missing'] },
      ],
      scenarios: undefined,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.animationsById.size).toBe(0);
  });

  it('disables a scenario that references an unavailable animation', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      scenarios: [{ id: 'bad', label: 'Bad', steps: [{ id: 'one', description: 'One', animationId: 'missing' }] }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.scenariosById.size).toBe(0);
  });

  it('computes the exact scenario compatibility intersection', () => {
    const result = normalizeProductConfiguration(validConfiguration());
    expect(result.ok).toBe(true);
    if (result.ok) expect([...result.configuration.scenariosById.get('tour')!.compatibleVariantIds]).toEqual(['base']);
  });

  it('disables a scenario with an empty compatibility intersection', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      animations: [
        { id: 'base-only', label: 'Base', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['base'] },
        { id: 'alt-only', label: 'Alt', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['alt'] },
      ],
      scenarios: [{
        id: 'empty-intersection',
        label: 'Empty',
        steps: [
          { id: 'one', description: 'One', animationId: 'base-only' },
          { id: 'two', description: 'Two', animationId: 'alt-only' },
        ],
      }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.scenariosById.size).toBe(0);
  });


  it('normalizes optional scenario camera views', () => {
    const result = normalizeProductConfiguration(validConfiguration());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.scenariosById.get('tour')!.steps).toEqual([
        { id: 'first', description: 'First step', animationId: 'pulse-all', cameraViewId: 'front' },
        { id: 'second', description: 'Second step', animationId: 'pulse-base' },
      ]);
    }
  });

  it('disables only a scenario that references an unknown camera view', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      scenarios: [{
        id: 'bad-camera',
        label: 'Bad camera',
        steps: [{ id: 'one', description: 'One', animationId: 'pulse-all', cameraViewId: 'missing' }],
      }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.scenariosById.size).toBe(0);
      expect([...result.configuration.cameraViewsById.keys()]).toEqual(['front']);
      expect(result.configuration.animationsById.has('pulse-all')).toBe(true);
      expect(result.configuration.localErrors.some((item) => item.code === 'SCENARIO_DISABLED' && item.entityId === 'bad-camera')).toBe(true);
    }
  });

  it('keeps GLB-to-USDZ fallback when the optional USDZ URL is unusable', () => {
    const result = normalizeProductConfiguration({ ...validConfiguration(), usdzUrl: 'javascript:bad' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.usdzUrl).toBeNull();
      expect(result.configuration.localErrors.some((error) => error.code === 'USDZ_UNUSABLE')).toBe(true);
    }
  });
});
