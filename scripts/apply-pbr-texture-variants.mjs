import fs from 'node:fs';

const replaceOnce = (path, from, to) => {
  const input = fs.readFileSync(path, 'utf8');
  if (!input.includes(from)) throw new Error(`${path}: expected fragment not found`);
  fs.writeFileSync(path, input.replace(from, to));
};

replaceOnce('src/product-3d-widget.ts',
`export interface ColorVariantConfig {
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly materialNames: readonly string[];
}`,
`export interface MaterialSurfaceConfig {
  readonly baseColorTextureUrl?: string;
  readonly normalTextureUrl?: string;
  readonly metallicRoughnessTextureUrl?: string;
  readonly occlusionTextureUrl?: string;
  readonly repeat?: readonly [number, number];
  readonly offset?: readonly [number, number];
  readonly rotation?: number;
  readonly normalScale?: readonly [number, number];
}

export interface ColorVariantConfig {
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly materialNames: readonly string[];
  readonly surface?: MaterialSurfaceConfig;
}`);

replaceOnce('src/configuration.ts',
`  ColorVariantConfig,
  ConfirmedSelection,`,
`  ColorVariantConfig,
  ConfirmedSelection,
  MaterialSurfaceConfig,`);

replaceOnce('src/configuration.ts',
`export interface NormalizedColorVariant {
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly materialNames: readonly string[];
}`,
`export interface NormalizedMaterialSurface {
  readonly baseColorTextureUrl: string | null;
  readonly normalTextureUrl: string | null;
  readonly metallicRoughnessTextureUrl: string | null;
  readonly occlusionTextureUrl: string | null;
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
  readonly surface: NormalizedMaterialSurface | null;
}`);

replaceOnce('src/configuration.ts',
`const uniqueStrings = (value: unknown): readonly string[] | null => {`,
`const finitePair = (value: unknown, positive: boolean): readonly [number, number] | null => {
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
  const repeat = value.repeat === undefined ? Object.freeze([1, 1] as const) : finitePair(value.repeat, true);
  const offset = value.offset === undefined ? Object.freeze([0, 0] as const) : finitePair(value.offset, false);
  const normalScale = value.normalScale === undefined ? Object.freeze([1, 1] as const) : finitePair(value.normalScale, false);
  const rotation = value.rotation === undefined ? 0 : value.rotation;
  if (repeat === null || offset === null || normalScale === null || typeof rotation !== 'number' || !Number.isFinite(rotation)) return false;
  return Object.freeze({
    baseColorTextureUrl: urls.baseColorTextureUrl as string | null,
    normalTextureUrl: urls.normalTextureUrl as string | null,
    metallicRoughnessTextureUrl: urls.metallicRoughnessTextureUrl as string | null,
    occlusionTextureUrl: urls.occlusionTextureUrl as string | null,
    repeat,
    offset,
    rotation,
    normalScale,
  });
};

const uniqueStrings = (value: unknown): readonly string[] | null => {`);

replaceOnce('src/configuration.ts',
`    const id = item.id.trim();
    const materialNames = uniqueStrings(item.materialNames);
    if (seen.has(id) || materialNames === null || (!item.isBase && materialNames.length === 0) || !isSolidCssColor(item.swatch)) {
      localErrors.push(error('COLOR_DISABLED', 'color', \`Color variant "\${id}" is invalid.\`, id));
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
    }));`,
`    const id = item.id.trim();
    const materialNames = uniqueStrings(item.materialNames);
    const surface = normalizeMaterialSurface(item.surface as MaterialSurfaceConfig | undefined);
    if (seen.has(id) || materialNames === null || (!item.isBase && materialNames.length === 0) || !isSolidCssColor(item.swatch) || surface === false) {
      localErrors.push(error('COLOR_DISABLED', 'color', \`Color variant "\${id}" is invalid.\`, id));
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
      surface,
    }));`);

replaceOnce('src/three-viewer.ts',
`  Quaternion,
  Scene,
  Sphere,
  SRGBColorSpace,
  Texture,
  Vector3,`,
`  Quaternion,
  RepeatWrapping,
  Scene,
  Sphere,
  SRGBColorSpace,
  Texture,
  TextureLoader,
  Vector2,
  Vector3,`);

replaceOnce('src/three-viewer.ts',
`type CameraSnapshot = Readonly<{`,
`type MaterialSnapshot = Readonly<{
  color: Color;
  map: Texture | null;
  normalMap: Texture | null;
  roughnessMap: Texture | null;
  metalnessMap: Texture | null;
  aoMap: Texture | null;
  normalScale: Vector2;
}>;

type LoadedSurface = Readonly<{
  baseColorTexture: Texture | null;
  normalTexture: Texture | null;
  metallicRoughnessTexture: Texture | null;
  occlusionTexture: Texture | null;
}>;

type CameraSnapshot = Readonly<{`);

replaceOnce('src/three-viewer.ts',
`  readonly #baseMaterialColors = new Map<MeshStandardMaterial, Color>();`,
`  readonly #baseMaterialStates = new Map<MeshStandardMaterial, MaterialSnapshot>();
  readonly #loadedSurfaces = new Map<string, LoadedSurface>();`);

replaceOnce('src/three-viewer.ts',
`    this.#baseMaterialColors.clear();`,
`    this.#baseMaterialStates.clear();
    this.#loadedSurfaces.clear();`);

replaceOnce('src/three-viewer.ts',
`          if (!this.#baseMaterialColors.has(material)) this.#baseMaterialColors.set(material, material.color.clone());`,
`          if (!this.#baseMaterialStates.has(material)) this.#baseMaterialStates.set(material, Object.freeze({
            color: material.color.clone(),
            map: material.map,
            normalMap: material.normalMap,
            roughnessMap: material.roughnessMap,
            metalnessMap: material.metalnessMap,
            aoMap: material.aoMap,
            normalScale: material.normalScale.clone(),
          }));`);

replaceOnce('src/three-viewer.ts',
`      const result = this.#validateModelBoundCapabilities();
      this.#captureOrdinaryPose();`,
`      const result = this.#validateModelBoundCapabilities();
      await this.#loadConfiguredSurfaces();
      this.#captureOrdinaryPose();`);

replaceOnce('src/three-viewer.ts',
`  #applySelectionDirect(): void {
    for (const [object, visible] of this.#baseVisibility) object.visible = visible;`,
`  async #loadConfiguredSurfaces(): Promise<void> {
    const loader = new TextureLoader();
    const load = async (url: string | null, srgb: boolean, surface: NonNullable<ReturnType<typeof this.#config.colorsById.get>>['surface']): Promise<Texture | null> => {
      if (url === null || surface === null) return null;
      const texture = await loader.loadAsync(url);
      texture.flipY = false;
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      texture.repeat.set(surface.repeat[0], surface.repeat[1]);
      texture.offset.set(surface.offset[0], surface.offset[1]);
      texture.rotation = surface.rotation;
      texture.center.set(0.5, 0.5);
      if (srgb) texture.colorSpace = SRGBColorSpace;
      texture.needsUpdate = true;
      return texture;
    };
    this.#loadedSurfaces.clear();
    for (const color of this.#config!.colorsById.values()) {
      if (!this.#enabledColors.has(color.id) || color.surface === null) continue;
      const surface = color.surface;
      this.#loadedSurfaces.set(color.id, Object.freeze({
        baseColorTexture: await load(surface.baseColorTextureUrl, true, surface),
        normalTexture: await load(surface.normalTextureUrl, false, surface),
        metallicRoughnessTexture: await load(surface.metallicRoughnessTextureUrl, false, surface),
        occlusionTexture: await load(surface.occlusionTextureUrl, false, surface),
      }));
    }
  }

  #applySelectionDirect(): void {
    for (const [object, visible] of this.#baseVisibility) object.visible = visible;`);

replaceOnce('src/three-viewer.ts',
`    for (const [material, color] of this.#baseMaterialColors) material.color.copy(color);
    const color = this.#currentSelection.colorId === null
      ? undefined
      : this.#config!.colorsById.get(this.#currentSelection.colorId);
    if (color !== undefined && !color.isBase) {
      for (const name of color.materialNames) {
        for (const material of this.#materialsByName.get(name) ?? []) material.color.setStyle(color.swatch);
      }
    }`,
`    for (const [material, state] of this.#baseMaterialStates) {
      material.color.copy(state.color);
      material.map = state.map;
      material.normalMap = state.normalMap;
      material.roughnessMap = state.roughnessMap;
      material.metalnessMap = state.metalnessMap;
      material.aoMap = state.aoMap;
      material.normalScale.copy(state.normalScale);
      material.needsUpdate = true;
    }
    const color = this.#currentSelection.colorId === null
      ? undefined
      : this.#config!.colorsById.get(this.#currentSelection.colorId);
    if (color !== undefined && !color.isBase) {
      const loaded = this.#loadedSurfaces.get(color.id);
      for (const name of color.materialNames) {
        for (const material of this.#materialsByName.get(name) ?? []) {
          material.color.setStyle(loaded?.baseColorTexture === null || loaded === undefined ? color.swatch : '#ffffff');
          if (loaded !== undefined) {
            material.map = loaded.baseColorTexture;
            material.normalMap = loaded.normalTexture;
            material.roughnessMap = loaded.metallicRoughnessTexture;
            material.metalnessMap = loaded.metallicRoughnessTexture;
            material.aoMap = loaded.occlusionTexture;
            if (color.surface !== null) material.normalScale.set(color.surface.normalScale[0], color.surface.normalScale[1]);
          }
          material.needsUpdate = true;
        }
      }
    }`);

replaceOnce('src/three-viewer.ts',
`    this.#baseMaterialColors.clear();`,
`    this.#baseMaterialStates.clear();
    this.#loadedSurfaces.clear();`);

const testPath = 'tests/configuration.test.ts';
const test = fs.readFileSync(testPath, 'utf8');
const marker = `  it('disables the color group when its declared default is invalid', () => {`;
if (!test.includes(marker)) throw new Error('configuration test marker missing');
const tests = `  it('normalizes an optional PBR surface on a color variant', () => {
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

`;
fs.writeFileSync(testPath, test.replace(marker, tests + marker));

const requirementPath = 'RequirementsAnalysis.xml';
let requirements = fs.readFileSync(requirementPath, 'utf8');
requirements = requirements.replace(
  '<EXCLUSION id="EXCL-MATERIAL-VARIANT-CATEGORY">В первой версии материал не является отдельной категорией вариантов наряду с цветовым и структурным вариантом.</EXCLUSION>',
  '<EXCLUSION id="EXCL-MATERIAL-VARIANT-CATEGORY">Материал не является отдельной категорией вариантов наряду с цветовым и структурным вариантом; необязательные PBR-текстуры задаются внутри существующего цветового варианта.</EXCLUSION>',
);
requirements = requirements.replace(
  '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SELECTION"><DESCRIPTION>При принятии запроса выбора настроенного цветового варианта компонент должен применить соответствующий цвет к средству 3D-просмотра и сохранить текущий выбор.</DESCRIPTION>',
  '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SELECTION"><DESCRIPTION>При принятии запроса выбора настроенного цветового варианта компонент должен применить соответствующий сплошной цвет либо настроенный PBR-набор текстур к средству 3D-просмотра и сохранить текущий выбор.</DESCRIPTION>',
);
requirements = requirements.replace(
  '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SWATCH-REQUIRED">',
  '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-PBR-SURFACE"><DESCRIPTION>Цветовой вариант может дополнительно задавать base-color, normal, metallic-roughness и occlusion текстуры, а также repeat, offset, rotation и normal scale. Некорректный набор отключает только соответствующий цветовой вариант. Отсутствие набора сохраняет прежнее переключение сплошного цвета.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-GLB-MODEL"/></LINKS></FUNCTIONAL_REQUIREMENT>\n        <FUNCTIONAL_REQUIREMENT id="FR-COLOR-SWATCH-REQUIRED">',
);
fs.writeFileSync(requirementPath, requirements);

const technologyPath = 'Technology.xml';
let technology = fs.readFileSync(technologyPath, 'utf8');
technology = technology.replace('материалы и цвета, видимость узлов', 'материалы, цвета и PBR-текстуры, видимость узлов');
technology = technology.replace('<REQUIREMENT ref="FR-COLOR-SELECTION"/>', '<REQUIREMENT ref="FR-COLOR-SELECTION"/>\n                <REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/>');
fs.writeFileSync(technologyPath, technology);

for (const [path, closing, payload] of [
  ['DevelopmentPlan.xml', '</DEVELOPMENT_PLAN>', '    <APPROVED_EXTENSION id="EXT-PBR-COLOR-SURFACE"><REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/><MODULE ref="MOD-CONFIGURATION"/><MODULE ref="MOD-THREE-VIEWER"/><DESCRIPTION>Добавить необязательный PBR-набор текстур в существующий цветовой вариант с кешированием, восстановлением базового материала и освобождением ресурсов.</DESCRIPTION></APPROVED_EXTENSION>\n'],
  ['ModuleContracts.xml', '</MODULE_CONTRACTS>', '    <CONTRACT_EXTENSION id="CONTRACT-EXT-PBR-COLOR-SURFACE"><REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/><MODULE ref="MOD-CONFIGURATION"/><MODULE ref="MOD-THREE-VIEWER"/><INVARIANT>Смена цветового варианта атомарно восстанавливает базовые карты материала перед применением выбранного PBR-набора.</INVARIANT></CONTRACT_EXTENSION>\n'],
  ['ClassFunctionContracts.xml', '</CLASS_FUNCTION_CONTRACTS>', '    <FUNCTION_CONTRACT id="CFC-FN-VIEWER-LOAD-PBR-SURFACES"><MODULE ref="MOD-THREE-VIEWER"/><PRECONDITION>Основная GLB-модель и конфигурация проверены.</PRECONDITION><POSTCONDITION>Текстуры доступных цветовых вариантов загружены, настроены для glTF UV и готовы к атомарному применению.</POSTCONDITION><ERROR_BEHAVIOR>Ошибка загрузки переводит инициализацию viewer в наблюдаемую ошибку.</ERROR_BEHAVIOR></FUNCTION_CONTRACT>\n'],
  ['MentalScenarios.xml', '</MENTAL_SCENARIOS>', '    <MENTAL_SCENARIO id="MS-COLOR-PBR-SWITCH"><GIVEN>Загружена модель с UV и два цветовых варианта с разными PBR-наборами.</GIVEN><WHEN>Хост последовательно выбирает варианты.</WHEN><THEN>Viewer восстанавливает базовый материал, применяет соответствующие карты и не сохраняет карты предыдущего варианта.</THEN></MENTAL_SCENARIO>\n'],
  ['VerificationCriteria.xml', '</VERIFICATION_CRITERIA>', '    <CRITERION id="VC-COLOR-PBR-SURFACE"><REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/><VERIFY>Валидный набор нормализуется; недопустимый URL отключает только вариант; сборка и типы проходят; texture maps восстанавливаются и освобождаются.</VERIFY></CRITERION>\n'],
]) {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(closing)) throw new Error(`${path}: closing tag missing`);
  text = text.replace(closing, payload + closing);
  fs.writeFileSync(path, text);
}

const readmePath = 'README.md';
let readme = fs.readFileSync(readmePath, 'utf8');
readme = readme.replace('переключения цветов и конструктивных вариантов', 'переключения цветов, необязательных PBR-текстур и конструктивных вариантов');
readme += `\n\n### PBR-текстуры цветового варианта\n\nЦветовой вариант может содержать необязательный объект \`surface\` с URL карт \`baseColorTextureUrl\`, \`normalTextureUrl\`, \`metallicRoughnessTextureUrl\`, \`occlusionTextureUrl\` и параметрами UV \`repeat\`, \`offset\`, \`rotation\`, \`normalScale\`. Старые конфигурации только со \`swatch\` сохраняют прежнее поведение.\n`;
fs.writeFileSync(readmePath, readme);
