import { describe, expect, it } from 'vitest';
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
