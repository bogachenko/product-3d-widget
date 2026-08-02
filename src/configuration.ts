import type {
  AnimationConfig,
  CameraViewConfig,
  ClipSource,
  ColorVariantConfig,
  ConfirmedSelection,
  MaterialSurfaceConfig,
  ProductConfiguration,
  RangeSource,
  RestPoseConfig,
  ScenarioStepConfig,
  StructuralVariantConfig,
  WidgetError,
} from './product-3d-widget.js';

export interface NormalizedCameraView extends Required<CameraViewConfig> {}

export interface NormalizedMaterialSurface {
  readonly baseColorTextureUrl: string | null;
  readonly normalTextureUrl: string | null;
  readonly metallicRoughnessTextureUrl: string | null;
  readonly occlusionTextureUrl: string | null;
  readonly uvChannel: 0 | 1 | 2 | 3;
  readonly repeat: readonly [number, number];
  readonly offset: readonly [number, number];
  readonly rotation: number;
  readonly normalScale: readonly [number, number];
}

export interface NormalizedColorVariant {
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly materialNames: readonly string[];
  readonly visibleNodeNames: readonly string[];
  readonly hiddenNodeNames: readonly string[];
  readonly surface: NormalizedMaterialSurface | null;
}

export interface NormalizedStructuralVariant {
  readonly id: string;
  readonly label: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly visibleNodeNames: readonly string[];
  readonly hiddenNodeNames: readonly string[];
}

export interface NormalizedAnimation {
  readonly id: string;
  readonly label: string;
  readonly source: ClipSource | RangeSource;
  readonly compatibleVariantIds: ReadonlySet<string>;
}

export interface NormalizedRestPose extends RestPoseConfig {}

export interface NormalizedArSelectionAsset {
  readonly colorId: string | null;
  readonly variantId: string | null;
  readonly glbUrl: string;
  readonly usdzUrl: string | null;
}

export interface NormalizedScenario {
  readonly id: string;
  readonly label: string;
  readonly steps: readonly ScenarioStepConfig[];
  readonly compatibleVariantIds: ReadonlySet<string>;
}

export interface NormalizedProductConfiguration {
  readonly productId: string;
  readonly glbUrl: string;
  readonly usdzUrl: string | null;
  readonly restPose: NormalizedRestPose | null;
  readonly cameraViewsById: ReadonlyMap<string, NormalizedCameraView>;
  readonly colorsById: ReadonlyMap<string, NormalizedColorVariant>;
  readonly variantsById: ReadonlyMap<string, NormalizedStructuralVariant>;
  readonly animationsById: ReadonlyMap<string, NormalizedAnimation>;
  readonly scenariosById: ReadonlyMap<string, NormalizedScenario>;
  readonly initialSelection: ConfirmedSelection;
  readonly localErrors: readonly WidgetError[];
  readonly arEnabled: boolean;
  readonly arSelectionAssetsByKey: ReadonlyMap<string, NormalizedArSelectionAsset> | null;
}

export type ConfigurationValidationResult =
  | Readonly<{ ok: true; configuration: NormalizedProductConfiguration }>
  | Readonly<{ ok: false; errors: readonly WidgetError[] }>;

const CSS_NAMED_COLORS = new Set([
  'aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'azure', 'beige', 'bisque', 'black',
  'blanchedalmond', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue', 'chartreuse',
  'chocolate', 'coral', 'cornflowerblue', 'cornsilk', 'crimson', 'cyan', 'darkblue', 'darkcyan',
  'darkgoldenrod', 'darkgray', 'darkgreen', 'darkgrey', 'darkkhaki', 'darkmagenta',
  'darkolivegreen', 'darkorange', 'darkorchid', 'darkred', 'darksalmon', 'darkseagreen',
  'darkslateblue', 'darkslategray', 'darkslategrey', 'darkturquoise', 'darkviolet', 'deeppink',
  'deepskyblue', 'dimgray', 'dimgrey', 'dodgerblue', 'firebrick', 'floralwhite', 'forestgreen',
  'fuchsia', 'gainsboro', 'ghostwhite', 'gold', 'goldenrod', 'gray', 'green', 'greenyellow',
  'grey', 'honeydew', 'hotpink', 'indianred', 'indigo', 'ivory', 'khaki', 'lavender',
  'lavenderblush', 'lawngreen', 'lemonchiffon', 'lightblue', 'lightcoral', 'lightcyan',
  'lightgoldenrodyellow', 'lightgray', 'lightgreen', 'lightgrey', 'lightpink', 'lightsalmon',
  'lightseagreen', 'lightskyblue', 'lightslategray', 'lightslategrey', 'lightsteelblue',
  'lightyellow', 'lime', 'limegreen', 'linen', 'magenta', 'maroon', 'mediumaquamarine',
  'mediumblue', 'mediumorchid', 'mediumpurple', 'mediumseagreen', 'mediumslateblue',
  'mediumspringgreen', 'mediumturquoise', 'mediumvioletred', 'midnightblue', 'mintcream',
  'mistyrose', 'moccasin', 'navajowhite', 'navy', 'oldlace', 'olive', 'olivedrab', 'orange',
  'orangered', 'orchid', 'palegoldenrod', 'palegreen', 'paleturquoise', 'palevioletred',
  'papayawhip', 'peachpuff', 'peru', 'pink', 'plum', 'powderblue', 'purple', 'rebeccapurple',
  'red', 'rosybrown', 'royalblue', 'saddlebrown', 'salmon', 'sandybrown', 'seagreen',
  'seashell', 'sienna', 'silver', 'skyblue', 'slateblue', 'slategray', 'slategrey', 'snow',
  'springgreen', 'steelblue', 'tan', 'teal', 'thistle', 'tomato', 'transparent', 'turquoise',
  'violet', 'wheat', 'white', 'whitesmoke', 'yellow', 'yellowgreen',
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const nonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const usableAssetUrl = (value: unknown): value is string => {
  if (!nonEmptyString(value)) return false;
  try {
    const url = new URL(value, 'https://product-3d-widget.invalid/');
    return ['http:', 'https:', 'blob:', 'data:'].includes(url.protocol);
  } catch {
    return false;
  }
};

const usableExternalArAssetUrl = (value: unknown): value is string => {
  if (!nonEmptyString(value)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(value, 'https://product-3d-widget.invalid/').protocol);
  } catch {
    return false;
  }
};

const arSelectionKey = (colorId: string | null, variantId: string | null): string =>
  JSON.stringify([colorId, variantId]);

const finitePair = (value: unknown, positive: boolean): readonly [number, number] | null => {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [x, y] = value;
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (positive && (x <= 0 || y <= 0)) return null;
  return Object.freeze([x, y] as const);
};

const normalizeMaterialSurface = (value: unknown): NormalizedMaterialSurface | null | false => {
  if (value === undefined) return null;
  if (!isObject(value)) return false;
  const keys = ['baseColorTextureUrl', 'normalTextureUrl', 'metallicRoughnessTextureUrl', 'occlusionTextureUrl'] as const;
  const urls = Object.fromEntries(keys.map((key) => [key, value[key] === undefined ? null : usableAssetUrl(value[key]) ? (value[key] as string).trim() : false]));
  if (Object.values(urls).some((item) => item === false) || !Object.values(urls).some((item) => typeof item === 'string')) return false;
  const uvChannel = value.uvChannel === undefined ? 0 : value.uvChannel;
  const repeat = value.repeat === undefined ? Object.freeze([1, 1] as const) : finitePair(value.repeat, true);
  const offset = value.offset === undefined ? Object.freeze([0, 0] as const) : finitePair(value.offset, false);
  const normalScale = value.normalScale === undefined ? Object.freeze([1, 1] as const) : finitePair(value.normalScale, false);
  const rotation = value.rotation === undefined ? 0 : value.rotation;
  if (repeat === null
    || offset === null
    || normalScale === null
    || typeof rotation !== 'number'
    || !Number.isFinite(rotation)
    || typeof uvChannel !== 'number'
    || !Number.isInteger(uvChannel)
    || uvChannel < 0
    || uvChannel > 3) return false;
  return Object.freeze({
    baseColorTextureUrl: urls.baseColorTextureUrl as string | null,
    normalTextureUrl: urls.normalTextureUrl as string | null,
    metallicRoughnessTextureUrl: urls.metallicRoughnessTextureUrl as string | null,
    occlusionTextureUrl: urls.occlusionTextureUrl as string | null,
    uvChannel: uvChannel as 0 | 1 | 2 | 3,
    repeat,
    offset,
    rotation,
    normalScale,
  });
};

const uniqueStrings = (value: unknown): readonly string[] | null => {
  if (!Array.isArray(value) || value.some((item) => !nonEmptyString(item))) return null;
  return Object.freeze([...new Set(value.map((item) => (item as string).trim()))]);
};

const error = (
  code: WidgetError['code'],
  scope: WidgetError['scope'],
  message: string,
  entityId?: string,
): WidgetError => Object.freeze(entityId === undefined ? { code, scope, message } : { code, scope, message, entityId });

const isSolidCssColor = (value: string): boolean => {
  const candidate = value.trim();
  if (candidate.length === 0 || /(?:gradient|url|image-set|cross-fade)\s*\(/i.test(candidate)) return false;
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', candidate);
  }
  // PONYTAIL: the Node-only fallback accepts the stable CSS color families used by deterministic tests;
  // browser runtime uses CSS.supports. If server-side validation becomes an approved runtime, replace this with a CSS parser.
  return /^#[\da-f]{3,4}(?:[\da-f]{3,4})?$/i.test(candidate)
    || CSS_NAMED_COLORS.has(candidate.toLowerCase())
    || /^(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\([^()]+\)$/i.test(candidate);
};

const normalizeCameraViews = (
  value: unknown,
  localErrors: WidgetError[],
): ReadonlyMap<string, NormalizedCameraView> => {
  if (value === undefined) return new Map();
  if (!Array.isArray(value)) {
    localErrors.push(error('CAMERA_VIEW_DISABLED', 'camera', 'cameraViews must be an array when provided.'));
    return new Map();
  }
  const result = new Map<string, NormalizedCameraView>();
  const seen = new Set<string>();
  for (const item of value) {
    const entityId = isObject(item) && nonEmptyString(item.id) ? item.id.trim() : undefined;
    const durationMs = isObject(item) && item.durationMs === undefined ? 700 : isObject(item) ? item.durationMs : undefined;
    if (!isObject(item)
      || !nonEmptyString(item.id)
      || !nonEmptyString(item.positionNodeName)
      || !nonEmptyString(item.targetNodeName)
      || typeof durationMs !== 'number'
      || !Number.isFinite(durationMs)
      || durationMs < 0
      || durationMs > 60_000
      || seen.has(item.id.trim())) {
      localErrors.push(error('CAMERA_VIEW_DISABLED', 'camera', 'A camera view is invalid.', entityId));
      if (entityId !== undefined) seen.add(entityId);
      continue;
    }
    const id = item.id.trim();
    seen.add(id);
    result.set(id, Object.freeze({
      id,
      positionNodeName: item.positionNodeName.trim(),
      targetNodeName: item.targetNodeName.trim(),
      durationMs,
    }));
  }
  return result;
};

const normalizeColorGroup = (
  value: unknown,
  localErrors: WidgetError[],
): ReadonlyMap<string, NormalizedColorVariant> => {
  if (value === undefined) return new Map();
  if (!Array.isArray(value) || value.length === 0) {
    localErrors.push(error('COLOR_DISABLED', 'color', 'The color group must be a non-empty array when provided.'));
    return new Map();
  }

  const declaredDefaults = value.filter((item) => isObject(item) && item.isDefault === true);
  const declaredBases = value.filter((item) => isObject(item) && item.isBase === true);
  const seen = new Set<string>();
  const valid = new Map<string, NormalizedColorVariant>();
  const declaredDefaultId = declaredDefaults.length === 1 && nonEmptyString(declaredDefaults[0]?.id)
    ? (declaredDefaults[0]!.id as string).trim()
    : null;
  const declaredBaseId = declaredBases.length === 1 && nonEmptyString(declaredBases[0]?.id)
    ? (declaredBases[0]!.id as string).trim()
    : null;

  for (const item of value) {
    const entityId = isObject(item) && nonEmptyString(item.id) ? item.id.trim() : undefined;
    if (!isObject(item)
      || !nonEmptyString(item.id)
      || !nonEmptyString(item.label)
      || typeof item.isDefault !== 'boolean'
      || typeof item.isBase !== 'boolean'
      || !nonEmptyString(item.swatch)) {
      localErrors.push(error('COLOR_DISABLED', 'color', 'A color variant has an invalid required field.', entityId));
      continue;
    }
    const id = item.id.trim();
    const materialNames = uniqueStrings(item.materialNames);
    const visibleNodeNames = item.visibleNodeNames === undefined
      ? Object.freeze([] as string[])
      : uniqueStrings(item.visibleNodeNames);
    const hiddenNodeNames = item.hiddenNodeNames === undefined
      ? Object.freeze([] as string[])
      : uniqueStrings(item.hiddenNodeNames);
    const overlap = visibleNodeNames !== null && hiddenNodeNames !== null
      && visibleNodeNames.some((name) => hiddenNodeNames.includes(name));
    const surface = normalizeMaterialSurface(item.surface as MaterialSurfaceConfig | undefined);
    if (seen.has(id)
      || materialNames === null
      || visibleNodeNames === null
      || hiddenNodeNames === null
      || overlap
      || (!item.isBase && materialNames.length === 0)
      || !isSolidCssColor(item.swatch)
      || surface === false) {
      localErrors.push(error('COLOR_DISABLED', 'color', `Color variant "${id}" is invalid.`, id));
      seen.add(id);
      continue;
    }
    seen.add(id);
    valid.set(id, Object.freeze({
      id,
      label: item.label.trim(),
      swatch: item.swatch.trim(),
      isDefault: item.isDefault,
      isBase: item.isBase,
      materialNames,
      visibleNodeNames,
      hiddenNodeNames,
      surface,
    }));
  }

  if (declaredDefaults.length !== 1 || declaredBases.length !== 1 || declaredDefaultId === null || declaredBaseId === null || !valid.has(declaredDefaultId) || !valid.has(declaredBaseId)) {
    localErrors.push(error(
      'COLOR_DISABLED',
      'color',
      'The color group is disabled because it must contain exactly one valid default and one base variant.',
    ));
    return new Map();
  }
  return valid;
};

const normalizeVariantGroup = (
  value: unknown,
  localErrors: WidgetError[],
): ReadonlyMap<string, NormalizedStructuralVariant> => {
  if (value === undefined) return new Map();
  if (!Array.isArray(value) || value.length === 0) {
    localErrors.push(error('VARIANT_DISABLED', 'variant', 'The structural variant group must be a non-empty array when provided.'));
    return new Map();
  }

  const declaredDefaults = value.filter((item) => isObject(item) && item.isDefault === true);
  const declaredBases = value.filter((item) => isObject(item) && item.isBase === true);
  const seen = new Set<string>();
  const valid = new Map<string, NormalizedStructuralVariant>();
  const declaredDefaultId = declaredDefaults.length === 1 && nonEmptyString(declaredDefaults[0]?.id)
    ? (declaredDefaults[0]!.id as string).trim()
    : null;
  const declaredBaseId = declaredBases.length === 1 && nonEmptyString(declaredBases[0]?.id)
    ? (declaredBases[0]!.id as string).trim()
    : null;

  for (const item of value) {
    const entityId = isObject(item) && nonEmptyString(item.id) ? item.id.trim() : undefined;
    if (!isObject(item)
      || !nonEmptyString(item.id)
      || !nonEmptyString(item.label)
      || typeof item.isDefault !== 'boolean'
      || typeof item.isBase !== 'boolean') {
      localErrors.push(error('VARIANT_DISABLED', 'variant', 'A structural variant has an invalid required field.', entityId));
      continue;
    }
    const id = item.id.trim();
    const visibleNodeNames = uniqueStrings(item.visibleNodeNames);
    const hiddenNodeNames = uniqueStrings(item.hiddenNodeNames);
    const overlap = visibleNodeNames !== null && hiddenNodeNames !== null
      && visibleNodeNames.some((name) => hiddenNodeNames.includes(name));
    if (seen.has(id) || visibleNodeNames === null || hiddenNodeNames === null || overlap) {
      localErrors.push(error('VARIANT_DISABLED', 'variant', `Structural variant "${id}" is invalid.`, id));
      seen.add(id);
      continue;
    }
    seen.add(id);
    valid.set(id, Object.freeze({
      id,
      label: item.label.trim(),
      isDefault: item.isDefault,
      isBase: item.isBase,
      visibleNodeNames,
      hiddenNodeNames,
    }));
  }

  if (declaredDefaults.length !== 1 || declaredBases.length !== 1 || declaredDefaultId === null || declaredBaseId === null || !valid.has(declaredDefaultId) || !valid.has(declaredBaseId)) {
    localErrors.push(error(
      'VARIANT_DISABLED',
      'variant',
      'The structural variant group is disabled because it must contain exactly one valid default and one base variant.',
    ));
    return new Map();
  }
  return valid;
};

const normalizeAnimationSource = (value: unknown): ClipSource | RangeSource | null => {
  if (!isObject(value) || !nonEmptyString(value.clipName)) return null;
  if (value.kind === 'clip') {
    return Object.freeze({ kind: 'clip', clipName: value.clipName.trim() });
  }
  if (value.kind === 'range'
    && typeof value.startSeconds === 'number'
    && typeof value.endSeconds === 'number'
    && Number.isFinite(value.startSeconds)
    && Number.isFinite(value.endSeconds)
    && value.startSeconds >= 0
    && value.startSeconds < value.endSeconds) {
    return Object.freeze({
      kind: 'range',
      clipName: value.clipName.trim(),
      startSeconds: value.startSeconds,
      endSeconds: value.endSeconds,
    });
  }
  return null;
};

const normalizeAnimations = (
  value: unknown,
  variantsById: ReadonlyMap<string, NormalizedStructuralVariant>,
  localErrors: WidgetError[],
): ReadonlyMap<string, NormalizedAnimation> => {
  if (value === undefined) return new Map();
  if (!Array.isArray(value)) {
    localErrors.push(error('ANIMATION_DISABLED', 'animation', 'Animations must be an array when provided.'));
    return new Map();
  }
  const seen = new Set<string>();
  const result = new Map<string, NormalizedAnimation>();
  for (const item of value) {
    const entityId = isObject(item) && nonEmptyString(item.id) ? item.id.trim() : undefined;
    if (!isObject(item) || !nonEmptyString(item.id) || !nonEmptyString(item.label)) {
      localErrors.push(error('ANIMATION_DISABLED', 'animation', 'An animation has invalid required fields.', entityId));
      continue;
    }
    const id = item.id.trim();
    const source = normalizeAnimationSource(item.source);
    const compatibleIds = uniqueStrings(item.compatibleVariantIds);
    const unknownCompatibility = compatibleIds?.some((variantId) => !variantsById.has(variantId)) ?? true;
    if (seen.has(id) || source === null || compatibleIds === null || compatibleIds.length === 0 || unknownCompatibility) {
      localErrors.push(error('ANIMATION_DISABLED', 'animation', `Animation "${id}" is invalid.`, id));
      seen.add(id);
      continue;
    }
    seen.add(id);
    result.set(id, Object.freeze({
      id,
      label: item.label.trim(),
      source,
      compatibleVariantIds: new Set(compatibleIds),
    }));
  }
  return result;
};

const normalizeRestPose = (
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

const normalizeScenarios = (
  value: unknown,
  animationsById: ReadonlyMap<string, NormalizedAnimation>,
  cameraViewsById: ReadonlyMap<string, NormalizedCameraView>,
  localErrors: WidgetError[],
): ReadonlyMap<string, NormalizedScenario> => {
  if (value === undefined) return new Map();
  if (!Array.isArray(value)) {
    localErrors.push(error('SCENARIO_DISABLED', 'scenario', 'Scenarios must be an array when provided.'));
    return new Map();
  }
  const seenScenarioIds = new Set<string>();
  const result = new Map<string, NormalizedScenario>();
  for (const item of value) {
    const entityId = isObject(item) && nonEmptyString(item.id) ? item.id.trim() : undefined;
    if (!isObject(item) || !nonEmptyString(item.id) || !nonEmptyString(item.label) || !Array.isArray(item.steps) || item.steps.length === 0) {
      localErrors.push(error('SCENARIO_DISABLED', 'scenario', 'A scenario has invalid required fields.', entityId));
      continue;
    }
    const id = item.id.trim();
    const stepIds = new Set<string>();
    const steps: ScenarioStepConfig[] = [];
    let valid = !seenScenarioIds.has(id);
    let intersection: Set<string> | null = null;
    for (const rawStep of item.steps) {
      if (!isObject(rawStep)
        || !nonEmptyString(rawStep.id)
        || !nonEmptyString(rawStep.description)
        || !nonEmptyString(rawStep.animationId)
        || (rawStep.cameraViewId !== undefined && !nonEmptyString(rawStep.cameraViewId))
        || stepIds.has(rawStep.id.trim())) {
        valid = false;
        continue;
      }
      const animation = animationsById.get(rawStep.animationId.trim());
      if (animation === undefined) {
        valid = false;
        continue;
      }
      const cameraViewId = rawStep.cameraViewId === undefined ? undefined : rawStep.cameraViewId.trim();
      if (cameraViewId !== undefined && !cameraViewsById.has(cameraViewId)) {
        valid = false;
        continue;
      }
      const step: ScenarioStepConfig = Object.freeze(cameraViewId === undefined ? {
        id: rawStep.id.trim(),
        description: rawStep.description.trim(),
        animationId: rawStep.animationId.trim(),
      } : {
        id: rawStep.id.trim(),
        description: rawStep.description.trim(),
        animationId: rawStep.animationId.trim(),
        cameraViewId,
      });
      stepIds.add(step.id);
      steps.push(step);
      if (intersection === null) {
        intersection = new Set(animation.compatibleVariantIds);
      } else {
        const compatible = animation.compatibleVariantIds;
        intersection = new Set<string>(Array.from(intersection as Set<string>).filter((variantId) => compatible.has(variantId)));
      }
    }
    seenScenarioIds.add(id);
    if (!valid || steps.length !== item.steps.length || intersection === null) {
      localErrors.push(error('SCENARIO_DISABLED', 'scenario', `Scenario "${id}" is invalid.`, id));
      continue;
    }
    if (intersection.size === 0) {
      localErrors.push(error('SCENARIO_DISABLED', 'scenario', `Scenario "${id}" has no compatible structural variant.`, id));
      continue;
    }
    result.set(id, Object.freeze({
      id,
      label: item.label.trim(),
      steps: Object.freeze(steps),
      compatibleVariantIds: intersection,
    }));
  }
  return result;
};

const normalizeArSelectionAssets = (
  value: unknown,
  colorsById: ReadonlyMap<string, NormalizedColorVariant>,
  variantsById: ReadonlyMap<string, NormalizedStructuralVariant>,
  localErrors: WidgetError[],
): ReadonlyMap<string, NormalizedArSelectionAsset> | null => {
  if (value === undefined) return null;
  if (!Array.isArray(value)) {
    localErrors.push(error('AR_INITIALIZATION_FAILED', 'ar', 'ar.selectionAssets must be an array when provided.'));
    return new Map();
  }

  const result = new Map<string, NormalizedArSelectionAsset>();
  const duplicateKeys = new Set<string>();
  for (const item of value) {
    const colorId = isObject(item) && (item.colorId === null || nonEmptyString(item.colorId))
      ? (item.colorId === null ? null : item.colorId.trim())
      : undefined;
    const variantId = isObject(item) && (item.variantId === null || nonEmptyString(item.variantId))
      ? (item.variantId === null ? null : item.variantId.trim())
      : undefined;
    const entityId = colorId !== undefined && variantId !== undefined
      ? arSelectionKey(colorId, variantId)
      : undefined;
    const colorValid = colorId !== undefined
      && (colorsById.size === 0 ? colorId === null : colorId !== null && colorsById.has(colorId));
    const variantValid = variantId !== undefined
      && (variantsById.size === 0 ? variantId === null : variantId !== null && variantsById.has(variantId));
    const glbUrl = isObject(item) && usableExternalArAssetUrl(item.glbUrl) ? item.glbUrl.trim() : null;
    const usdzUrl = isObject(item) && item.usdzUrl === undefined
      ? null
      : isObject(item) && usableExternalArAssetUrl(item.usdzUrl)
        ? item.usdzUrl.trim()
        : undefined;

    if (!colorValid || !variantValid || glbUrl === null || usdzUrl === undefined) {
      localErrors.push(error(
        'AR_INITIALIZATION_FAILED',
        'ar',
        'An AR selection asset has invalid selection references or a non-public GLB/USDZ URL.',
        entityId,
      ));
      continue;
    }

    const key = arSelectionKey(colorId, variantId);
    if (duplicateKeys.has(key)) continue;
    if (result.has(key)) {
      result.delete(key);
      duplicateKeys.add(key);
      localErrors.push(error('AR_INITIALIZATION_FAILED', 'ar', 'An AR selection pair is duplicated and was disabled.', key));
      continue;
    }
    result.set(key, Object.freeze({ colorId, variantId, glbUrl, usdzUrl }));
  }
  return result;
};

// <SEMANTIC_BLOCK id="CFC-FN-NORMALIZE-CONFIG">
// <INTENT>Validate one untrusted product configuration without runtime side effects.</INTENT>
// <LINKS><MODULE ref="MOD-CONFIGURATION"/><MODULE_CONTRACT ref="CONTRACT-MOD-CONFIGURATION"/><FUNCTION_CONTRACT ref="CFC-FN-NORMALIZE-CONFIG"/></LINKS>
export function normalizeProductConfiguration(input: unknown): ConfigurationValidationResult {
  const blockingErrors: WidgetError[] = [];
  if (!isObject(input)) {
    blockingErrors.push(error('CONFIGURATION_INVALID', 'blocking', 'Product configuration must be an object.'));
    return Object.freeze({ ok: false, errors: Object.freeze(blockingErrors) });
  }
  if (!nonEmptyString(input.productId)) {
    blockingErrors.push(error('CONFIGURATION_INVALID', 'blocking', 'productId must be a non-empty string.'));
  }
  if (!usableAssetUrl(input.glbUrl)) {
    blockingErrors.push(error('CONFIGURATION_INVALID', 'blocking', 'glbUrl must be a non-empty supported asset URL.'));
  }
  if (blockingErrors.length > 0) {
    return Object.freeze({ ok: false, errors: Object.freeze(blockingErrors) });
  }

  const localErrors: WidgetError[] = [];
  const colorsById = normalizeColorGroup(input.colors, localErrors);
  const variantsById = normalizeVariantGroup(input.variants, localErrors);
  const animationsById = normalizeAnimations(input.animations, variantsById, localErrors);
  const restPose = normalizeRestPose(input.restPose, animationsById, localErrors);
  const cameraViewsById = normalizeCameraViews(input.cameraViews, localErrors);
  const scenariosById = normalizeScenarios(input.scenarios, animationsById, cameraViewsById, localErrors);

  let usdzUrl: string | null = null;
  if (input.usdzUrl !== undefined) {
    if (usableAssetUrl(input.usdzUrl)) usdzUrl = input.usdzUrl.trim();
    else localErrors.push(error('USDZ_UNUSABLE', 'ar', 'The optional USDZ URL is invalid and will not be used.'));
  }

  let arEnabled = false;
  let arSelectionAssetsByKey: ReadonlyMap<string, NormalizedArSelectionAsset> | null = null;
  if (input.ar !== undefined) {
    if (isObject(input.ar) && typeof input.ar.enabled === 'boolean') {
      arEnabled = input.ar.enabled;
      arSelectionAssetsByKey = normalizeArSelectionAssets(input.ar.selectionAssets, colorsById, variantsById, localErrors);
    } else {
      localErrors.push(error('AR_INITIALIZATION_FAILED', 'ar', 'The optional AR configuration is invalid and AR is disabled.'));
    }
  }

  const defaultColor = [...colorsById.values()].find((item) => item.isDefault)?.id ?? null;
  const defaultVariant = [...variantsById.values()].find((item) => item.isDefault)?.id ?? null;
  const configuration: NormalizedProductConfiguration = Object.freeze({
    productId: (input.productId as string).trim(),
    glbUrl: (input.glbUrl as string).trim(),
    usdzUrl,
    restPose,
    cameraViewsById,
    colorsById,
    variantsById,
    animationsById,
    scenariosById,
    initialSelection: Object.freeze({ colorId: defaultColor, variantId: defaultVariant }),
    localErrors: Object.freeze(localErrors),
    arEnabled,
    arSelectionAssetsByKey,
  });
  return Object.freeze({ ok: true, configuration });
}
// </SEMANTIC_BLOCK>
