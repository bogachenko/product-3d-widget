import fs from 'node:fs';

const replaceOnce = (text, search, replacement, label) => {
  if (!text.includes(search)) throw new Error(`Missing target: ${label}`);
  return text.replace(search, replacement);
};

const insertBeforeClosing = (path, closing, payload) => {
  let text = fs.readFileSync(path, 'utf8');
  if (!text.includes(closing)) throw new Error(`${path}: missing ${closing}`);
  if (!text.includes(payload.trim())) text = text.replace(closing, `${payload}${closing}`);
  fs.writeFileSync(path, text);
};

// Public configuration types.
{
  const path = 'src/product-3d-widget.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(text,
`  readonly occlusionTextureUrl?: string;
  readonly repeat?: readonly [number, number];`,
`  readonly occlusionTextureUrl?: string;
  readonly uvChannel?: 0 | 1 | 2 | 3;
  readonly repeat?: readonly [number, number];`,
  'MaterialSurfaceConfig uvChannel');
  text = replaceOnce(text,
`  readonly materialNames: readonly string[];
  readonly surface?: MaterialSurfaceConfig;`,
`  readonly materialNames: readonly string[];
  readonly visibleNodeNames?: readonly string[];
  readonly hiddenNodeNames?: readonly string[];
  readonly surface?: MaterialSurfaceConfig;`,
  'ColorVariantConfig node visibility');
  fs.writeFileSync(path, text);
}

// Static configuration normalization.
{
  const path = 'src/configuration.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(text,
`  readonly occlusionTextureUrl: string | null;
  readonly repeat: readonly [number, number];`,
`  readonly occlusionTextureUrl: string | null;
  readonly uvChannel: 0 | 1 | 2 | 3;
  readonly repeat: readonly [number, number];`,
  'NormalizedMaterialSurface uvChannel');
  text = replaceOnce(text,
`  readonly materialNames: readonly string[];
  readonly surface: NormalizedMaterialSurface | null;`,
`  readonly materialNames: readonly string[];
  readonly visibleNodeNames: readonly string[];
  readonly hiddenNodeNames: readonly string[];
  readonly surface: NormalizedMaterialSurface | null;`,
  'NormalizedColorVariant visibility');
  text = replaceOnce(text,
`  const repeat = value.repeat === undefined ? Object.freeze([1, 1] as const) : finitePair(value.repeat, true);
  const offset = value.offset === undefined ? Object.freeze([0, 0] as const) : finitePair(value.offset, false);
  const normalScale = value.normalScale === undefined ? Object.freeze([1, 1] as const) : finitePair(value.normalScale, false);
  const rotation = value.rotation === undefined ? 0 : value.rotation;
  if (repeat === null || offset === null || normalScale === null || typeof rotation !== 'number' || !Number.isFinite(rotation)) return false;
  return Object.freeze({`,
`  const uvChannel = value.uvChannel === undefined ? 0 : value.uvChannel;
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
  return Object.freeze({`,
  'surface validation');
  text = replaceOnce(text,
`    occlusionTextureUrl: urls.occlusionTextureUrl as string | null,
    repeat,`,
`    occlusionTextureUrl: urls.occlusionTextureUrl as string | null,
    uvChannel: uvChannel as 0 | 1 | 2 | 3,
    repeat,`,
  'normalized surface uvChannel output');
  text = replaceOnce(text,
`    const materialNames = uniqueStrings(item.materialNames);
    const surface = normalizeMaterialSurface(item.surface as MaterialSurfaceConfig | undefined);
    if (seen.has(id) || materialNames === null || (!item.isBase && materialNames.length === 0) || !isSolidCssColor(item.swatch) || surface === false) {
      localErrors.push(error('COLOR_DISABLED', 'color', \`Color variant "\${id}" is invalid.\`, id));
      seen.add(id);
      continue;
    }`,
`    const materialNames = uniqueStrings(item.materialNames);
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
      localErrors.push(error('COLOR_DISABLED', 'color', \`Color variant "\${id}" is invalid.\`, id));
      seen.add(id);
      continue;
    }`,
  'color visibility normalization');
  text = replaceOnce(text,
`      isBase: item.isBase,
      materialNames,
      surface,`,
`      isBase: item.isBase,
      materialNames,
      visibleNodeNames,
      hiddenNodeNames,
      surface,`,
  'normalized color visibility output');
  fs.writeFileSync(path, text);
}

// Three.js model validation, UV selection and composed visibility.
{
  const path = 'src/three-viewer.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(text,
`const animationTimeTolerance = (duration: number): number =>
  Math.max(1e-6, Math.abs(duration) * 1e-7);
`,
`const animationTimeTolerance = (duration: number): number =>
  Math.max(1e-6, Math.abs(duration) * 1e-7);

const uvAttributeName = (channel: number): string => channel === 0 ? 'uv' : \`uv\${channel}\`;
`,
  'UV attribute helper');
  text = replaceOnce(text,
`  readonly #nodesByName = new Map<string, Object3D>();
  readonly #materialsByName = new Map<string, MeshStandardMaterial[]>();`,
`  readonly #nodesByName = new Map<string, Object3D>();
  readonly #materialsByName = new Map<string, MeshStandardMaterial[]>();
  readonly #meshesByMaterialName = new Map<string, Mesh[]>();`,
  'mesh index field');
  text = replaceOnce(text,
`    this.#nodesByName.clear();
    this.#materialsByName.clear();
    this.#baseTransforms.clear();`,
`    this.#nodesByName.clear();
    this.#materialsByName.clear();
    this.#meshesByMaterialName.clear();
    this.#baseTransforms.clear();`,
  'mesh index reset');
  text = replaceOnce(text,
`          if (!this.#materialsByName.has(name)) this.#materialsByName.set(name, []);
          this.#materialsByName.get(name)!.push(material);
          if (!this.#baseMaterialStates.has(material))`,
`          if (!this.#materialsByName.has(name)) this.#materialsByName.set(name, []);
          this.#materialsByName.get(name)!.push(material);
          if (!this.#meshesByMaterialName.has(name)) this.#meshesByMaterialName.set(name, []);
          this.#meshesByMaterialName.get(name)!.push(object);
          if (!this.#baseMaterialStates.has(material))`,
  'mesh index population');
  text = replaceOnce(text,
`    for (const color of this.#config!.colorsById.values()) {
      if (color.isBase || color.materialNames.every((name) => this.#materialsByName.has(name))) {
        this.#enabledColors.add(color.id);
      } else {
        localErrors.push(localError('COLOR_DISABLED', 'color', \`Color "\${color.id}" references a missing material.\`, color.id));
      }
    }`,
`    for (const color of this.#config!.colorsById.values()) {
      const nodeNames = [...color.visibleNodeNames, ...color.hiddenNodeNames];
      const materialsAvailable = color.isBase || color.materialNames.every((name) => this.#materialsByName.has(name));
      const nodesAvailable = nodeNames.every((name) => this.#nodesByName.has(name));
      const requiredUvAttribute = color.isBase || color.surface === null
        ? null
        : uvAttributeName(color.surface.uvChannel);
      const uvChannelAvailable = requiredUvAttribute === null || color.materialNames.every((name) =>
        (this.#meshesByMaterialName.get(name) ?? []).every((mesh) =>
          mesh.geometry.getAttribute(requiredUvAttribute) !== undefined));
      if (materialsAvailable && nodesAvailable && uvChannelAvailable) {
        this.#enabledColors.add(color.id);
      } else {
        localErrors.push(localError(
          'COLOR_DISABLED',
          'color',
          \`Color "\${color.id}" references a missing material, node or UV channel.\`,
          color.id,
        ));
      }
    }`,
  'model-bound color validation');
  text = replaceOnce(text,
`    const load = async (url: string | null, srgb: boolean, surface: { readonly repeat: readonly [number, number]; readonly offset: readonly [number, number]; readonly rotation: number } | null): Promise<Texture | null> => {`,
`    const load = async (url: string | null, srgb: boolean, surface: { readonly uvChannel: number; readonly repeat: readonly [number, number]; readonly offset: readonly [number, number]; readonly rotation: number } | null): Promise<Texture | null> => {`,
  'texture loader surface type');
  text = replaceOnce(text,
`      texture.flipY = false;
      texture.wrapS = RepeatWrapping;`,
`      texture.flipY = false;
      texture.channel = surface.uvChannel;
      texture.wrapS = RepeatWrapping;`,
  'Texture.channel assignment');
  const oldApply = `  #applySelectionDirect(): void {
    for (const [object, visible] of this.#baseVisibility) object.visible = visible;
    const variant = this.#currentSelection.variantId === null
      ? undefined
      : this.#config!.variantsById.get(this.#currentSelection.variantId);
    if (variant !== undefined && !variant.isBase) {
      for (const name of variant.visibleNodeNames) this.#nodesByName.get(name)!.visible = true;
      for (const name of variant.hiddenNodeNames) this.#nodesByName.get(name)!.visible = false;
    }

    for (const [material, state] of this.#baseMaterialStates) {
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
          }
          material.needsUpdate = true;
        }
      }
    }
  }
`;
  const newApply = `  #applySelectionDirect(): void {
    for (const [object, visible] of this.#baseVisibility) object.visible = visible;
    const variant = this.#currentSelection.variantId === null
      ? undefined
      : this.#config!.variantsById.get(this.#currentSelection.variantId);
    if (variant !== undefined && !variant.isBase) {
      for (const name of variant.visibleNodeNames) this.#nodesByName.get(name)!.visible = true;
      for (const name of variant.hiddenNodeNames) this.#nodesByName.get(name)!.visible = false;
    }

    const color = this.#currentSelection.colorId === null
      ? undefined
      : this.#config!.colorsById.get(this.#currentSelection.colorId);
    if (color !== undefined) {
      for (const name of color.visibleNodeNames) this.#nodesByName.get(name)!.visible = true;
      for (const name of color.hiddenNodeNames) this.#nodesByName.get(name)!.visible = false;
    }

    for (const [material, state] of this.#baseMaterialStates) {
      material.color.copy(state.color);
      material.map = state.map;
      material.normalMap = state.normalMap;
      material.roughnessMap = state.roughnessMap;
      material.metalnessMap = state.metalnessMap;
      material.aoMap = state.aoMap;
      material.normalScale.copy(state.normalScale);
      material.needsUpdate = true;
    }
    if (color !== undefined && !color.isBase) {
      const loaded = this.#loadedSurfaces.get(color.id);
      for (const name of color.materialNames) {
        for (const material of this.#materialsByName.get(name) ?? []) {
          material.color.setStyle(loaded?.baseColorTexture === null || loaded === undefined ? color.swatch : '#ffffff');
          if (loaded !== undefined) {
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
          }
          material.needsUpdate = true;
        }
      }
    }
  }
`;
  text = replaceOnce(text, oldApply, newApply, 'composed selection application');
  text = replaceOnce(text,
`    this.#nodesByName.clear();
    this.#materialsByName.clear();
    this.#baseTransforms.clear();`,
`    this.#nodesByName.clear();
    this.#materialsByName.clear();
    this.#meshesByMaterialName.clear();
    this.#baseTransforms.clear();`,
  'mesh index cleanup');
  fs.writeFileSync(path, text);
}

// Unit tests for static normalization.
{
  const path = 'tests/configuration.test.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(text,
`          metallicRoughnessTextureUrl: '/textures/fabric-mr.webp',
          repeat: [3, 4] as const,`,
`          metallicRoughnessTextureUrl: '/textures/fabric-mr.webp',
          uvChannel: 1,
          repeat: [3, 4] as const,`,
  'PBR test uv input');
  text = replaceOnce(text,
`      occlusionTextureUrl: null,
      repeat: [3, 4],`,
`      occlusionTextureUrl: null,
      uvChannel: 1,
      repeat: [3, 4],`,
  'PBR test uv expected');
  const marker = `  it('disables only a color variant with an invalid PBR surface', () => {`;
  const tests = `  it('defaults color geometry lists and the UV channel', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: input.colors!.map((color) => color.id === 'red' ? {
        ...color,
        surface: { baseColorTextureUrl: '/textures/plain.webp' },
      } : color),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const red = result.configuration.colorsById.get('red')!;
      expect(red.visibleNodeNames).toEqual([]);
      expect(red.hiddenNodeNames).toEqual([]);
      expect(red.surface?.uvChannel).toBe(0);
    }
  });

  it('normalizes color-controlled node visibility', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: input.colors!.map((color) => color.id === 'red' ? {
        ...color,
        visibleNodeNames: ['RibsNode', 'RibsNode'],
        hiddenNodeNames: ['SmoothNode'],
      } : color),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.colorsById.get('red')).toMatchObject({
      visibleNodeNames: ['RibsNode'],
      hiddenNodeNames: ['SmoothNode'],
    });
  });

  it('disables only a color with overlapping node visibility lists', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: [...input.colors!, {
        id: 'bad-nodes', label: 'Bad nodes', swatch: '#fff', isDefault: false, isBase: false,
        materialNames: ['Body'], visibleNodeNames: ['RibsNode'], hiddenNodeNames: ['RibsNode'],
      }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.colorsById.has('bad-nodes')).toBe(false);
  });

  it('disables only a color with an invalid UV channel', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: [...input.colors!, {
        id: 'bad-uv', label: 'Bad UV', swatch: '#fff', isDefault: false, isBase: false,
        materialNames: ['Body'], surface: { baseColorTextureUrl: '/textures/plain.webp', uvChannel: 4 },
      }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.colorsById.has('bad-uv')).toBe(false);
  });

`;
  text = replaceOnce(text, marker, tests + marker, 'configuration tests insertion');
  fs.writeFileSync(path, text);
}

// Browser fixture with an independent ribs node and two UV sets.
fs.writeFileSync('tests/fixtures/product.gltf', '{"asset":{"version":"2.0","generator":"product-3d-widget tests"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[{"name":"Root","children":[1,2,3]},{"name":"BaseNode","mesh":0,"translation":[-0.55,0,0]},{"name":"AltNode","mesh":0,"translation":[0.55,0,0]},{"name":"RibsNode","mesh":0,"translation":[0,1.5,0],"scale":[0.3,0.3,0.3]}],"meshes":[{"name":"ProductMesh","primitives":[{"attributes":{"POSITION":0,"TEXCOORD_0":4,"TEXCOORD_1":5},"indices":1,"material":0}]}],"materials":[{"name":"Body","pbrMetallicRoughness":{"baseColorFactor":[0.2,0.4,0.8,1],"metallicFactor":0,"roughnessFactor":0.8}}],"animations":[{"name":"Pulse","samplers":[{"input":2,"output":3,"interpolation":"LINEAR"}],"channels":[{"sampler":0,"target":{"node":1,"path":"scale"}}]}],"buffers":[{"byteLength":140,"uri":"data:application/octet-stream;base64,AAAAvwAAAL8AAAAAAAAAPwAAAL8AAAAAAAAAAAAAAD8AAAAAAAABAAIAAAAAAAAAAAAAPwAAgD8AAIA/AACAPwAAgD9mZqY/ZmamP2Zmpj8AAIA/AACAPwAAgD8AAAAAAAAAAAAAgD8AAAAAAAAAPwAAgD/NzMw9zczMPWZmZj/NzMw9AAAAP2ZmZj8="}],"bufferViews":[{"buffer":0,"byteOffset":0,"byteLength":36,"target":34962},{"buffer":0,"byteOffset":36,"byteLength":6,"target":34963},{"buffer":0,"byteOffset":44,"byteLength":12},{"buffer":0,"byteOffset":56,"byteLength":36},{"buffer":0,"byteOffset":92,"byteLength":24,"target":34962},{"buffer":0,"byteOffset":116,"byteLength":24,"target":34962}],"accessors":[{"bufferView":0,"componentType":5126,"count":3,"type":"VEC3","min":[-0.5,-0.5,0],"max":[0.5,0.5,0]},{"bufferView":1,"componentType":5123,"count":3,"type":"SCALAR"},{"bufferView":2,"componentType":5126,"count":3,"type":"SCALAR","min":[0],"max":[1]},{"bufferView":3,"componentType":5126,"count":3,"type":"VEC3","min":[1,1,1],"max":[1.3,1.3,1.3]},{"bufferView":4,"componentType":5126,"count":3,"type":"VEC2","min":[0,0],"max":[1,1]},{"bufferView":5,"componentType":5126,"count":3,"type":"VEC2","min":[0.1,0.1],"max":[0.9,0.9]}]}\n');

// Browser checks for composed visibility and model-bound UV validation.
{
  const path = 'tests/product-3d-widget.spec.ts';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(text,
`    { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [] },
    { id: 'red', label: 'Red', swatch: '#ff0000', isDefault: false, isBase: false, materialNames: ['Body'] },`,
`    { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [], hiddenNodeNames: ['RibsNode'] },
    { id: 'red', label: 'Red', swatch: '#ff0000', isDefault: false, isBase: false, materialNames: ['Body'], hiddenNodeNames: ['RibsNode'] },
    { id: 'ribbed', label: 'Ribbed', swatch: '#3366cc', isDefault: false, isBase: false, materialNames: ['Body'], visibleNodeNames: ['RibsNode'] },`,
  'browser color configuration');
  const marker = `test('mandatory rejection is correctable once and accepted assignment is immutable', async ({ page }) => {`;
  const tests = `test('color geometry is composed independently with structural variants', async ({ page }) => {
  await openFixture(page);
  await configureWidget(page);

  const topScreenshot = async (): Promise<Buffer> => {
    const box = await page.locator('#widget').boundingBox();
    if (box === null) throw new Error('widget bounds are unavailable');
    return page.screenshot({
      clip: { x: box.x, y: box.y, width: box.width, height: box.height * 0.38 },
    });
  };

  const original = await topScreenshot();
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectVariant('alt'));
  const originalAfterVariant = await topScreenshot();
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectColor('ribbed'));
  const ribbed = await topScreenshot();
  const stateAfterRibbed = await page.locator('#widget').evaluate((widget: any) => widget.getState());
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectVariant('base'));
  const ribbedAfterVariant = await topScreenshot();
  await page.locator('#widget').evaluate(async (widget: any) => widget.selectColor('original'));
  const restored = await topScreenshot();

  expect(originalAfterVariant.equals(original)).toBe(true);
  expect(ribbed.equals(original)).toBe(false);
  expect(ribbedAfterVariant.equals(ribbed)).toBe(true);
  expect(restored.equals(original)).toBe(true);
  expect(stateAfterRibbed.selection).toEqual({ colorId: 'ribbed', variantId: 'alt' });
});

test('configured UV channel is validated against target meshes', async ({ page }) => {
  await openFixture(page);
  const texture = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z6pQAAAAASUVORK5CYII=';
  const result = await configureWidget(page, {
    productId: 'uv-product',
    glbUrl: '/tests/fixtures/product.gltf',
    colors: [
      { id: 'original', label: 'Original', swatch: '#3366cc', isDefault: true, isBase: true, materialNames: [] },
      { id: 'uv1', label: 'UV 1', swatch: '#ffffff', isDefault: false, isBase: false, materialNames: ['Body'], surface: { baseColorTextureUrl: texture, uvChannel: 1 } },
      { id: 'uv2-missing', label: 'UV 2', swatch: '#ffffff', isDefault: false, isBase: false, materialNames: ['Body'], surface: { baseColorTextureUrl: texture, uvChannel: 2 } },
    ],
  });
  expect(result.outcome).toBe('ready');
  const state = await page.locator('#widget').evaluate((widget: any) => widget.getState());
  expect(state.capabilities.colors.map((color: any) => color.id)).toEqual(['original', 'uv1']);
  expect(state.localErrors).toContainEqual(expect.objectContaining({ code: 'COLOR_DISABLED', entityId: 'uv2-missing' }));
  const selected = await page.locator('#widget').evaluate(async (widget: any) => widget.selectColor('uv1'));
  expect(selected).toMatchObject({ accepted: true, outcome: 'completed' });
});

`;
  text = replaceOnce(text, marker, tests + marker, 'browser tests insertion');
  fs.writeFileSync(path, text);
}

// Documentation.
{
  const path = 'README.md';
  let text = fs.readFileSync(path, 'utf8');
  text += `\n\n### Геометрия ткани и UV-канал\n\nЦветовой вариант может дополнительно задавать \`visibleNodeNames\` и \`hiddenNodeNames\`. Эта видимость применяется после структурного варианта, поэтому ткань и конструкция сохраняются как независимые выборы. В \`surface.uvChannel\` можно выбрать UV-набор от \`0\` до \`3\`; значение \`0\` используется по умолчанию. Для канала \`1\` целевые меши должны содержать атрибут \`uv1\`, для каналов \`2\` и \`3\` — соответственно \`uv2\` и \`uv3\`. Отсутствующий узел или UV-атрибут отключает только соответствующий цветовой вариант.\n`;
  fs.writeFileSync(path, text);
}

// GRACE propagation.
{
  const path = 'RequirementsAnalysis.xml';
  let text = fs.readFileSync(path, 'utf8');
  text = replaceOnce(text,
`<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SELECTION"><DESCRIPTION>При принятии запроса выбора настроенного цветового варианта компонент должен применить соответствующий сплошной цвет либо настроенный PBR-набор текстур к средству 3D-просмотра и сохранить текущий выбор.</DESCRIPTION>`,
`<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SELECTION"><DESCRIPTION>При принятии запроса выбора настроенного цветового варианта компонент должен применить соответствующий сплошной цвет либо настроенный PBR-набор текстур, а также связанную видимость узлов к средству 3D-просмотра и сохранить текущий выбор.</DESCRIPTION>`,
  'FR-COLOR-SELECTION');
  text = replaceOnce(text,
`<FUNCTIONAL_REQUIREMENT id="FR-COLOR-PBR-SURFACE"><DESCRIPTION>Цветовой вариант может дополнительно задавать base-color, normal, metallic-roughness и occlusion текстуры, а также repeat, offset, rotation и normal scale. Некорректный набор отключает только соответствующий цветовой вариант. Отсутствие набора сохраняет прежнее переключение сплошного цвета.</DESCRIPTION>`,
`<FUNCTIONAL_REQUIREMENT id="FR-COLOR-PBR-SURFACE"><DESCRIPTION>Цветовой вариант может дополнительно задавать base-color, normal, metallic-roughness и occlusion текстуры, UV-канал, repeat, offset, rotation и normal scale. Некорректный набор отключает только соответствующий цветовой вариант. Отсутствие набора сохраняет прежнее переключение сплошного цвета.</DESCRIPTION>`,
  'FR-COLOR-PBR-SURFACE');
  const requirements = `        <FUNCTIONAL_REQUIREMENT id="FR-COLOR-GEOMETRY-VISIBILITY"><DESCRIPTION>Цветовой вариант может дополнительно задавать узлы основной GLB-модели, которые показываются или скрываются при его выборе. Эта видимость применяется одновременно и независимо от структурного варианта; изменение одного выбора не сбрасывает другой. Отсутствующая ссылка отключает только соответствующий цветовой вариант.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-GLB-MODEL"/><ENTITY ref="ENTITY-CURRENT-SELECTION"/></LINKS></FUNCTIONAL_REQUIREMENT>\n        <FUNCTIONAL_REQUIREMENT id="FR-COLOR-UV-CHANNEL"><DESCRIPTION>Для внешнего PBR-набора цветовой вариант может выбрать UV-канал от 0 до 3. Значение по умолчанию — 0. Если целевой меш не содержит соответствующий UV-атрибут, отключается только этот цветовой вариант.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-GLB-MODEL"/></LINKS></FUNCTIONAL_REQUIREMENT>\n`;
  text = replaceOnce(text, '</FUNCTIONAL_REQUIREMENTS>', requirements + '    </FUNCTIONAL_REQUIREMENTS>', 'new functional requirements');
  text = replaceOnce(text, '</REQUIREMENTS_ANALYSIS>', `    <GRAPH_EXTENSION id="GRAPH-COLOR-GEOMETRY-UV"><BUSINESS_PROCESS ref="BP-PRODUCT-EXPLORATION"/><REQUIREMENT ref="FR-COLOR-SELECTION"/><REQUIREMENT ref="FR-COLOR-GEOMETRY-VISIBILITY"/><REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/><REQUIREMENT ref="FR-COLOR-UV-CHANNEL"/><INVARIANT ref="INV-SELECTION-INDEPENDENCE"/></GRAPH_EXTENSION>\n</REQUIREMENTS_ANALYSIS>`, 'requirements graph extension');
  fs.writeFileSync(path, text);
}

{
  const path = 'Technology.xml';
  let text = fs.readFileSync(path, 'utf8');
  text = text.replace('материалы, цвета и PBR-текстуры, видимость узлов структурных вариантов', 'материалы, цвета и PBR-текстуры, выбор UV-канала, видимость узлов цветовых и структурных вариантов');
  text = replaceOnce(text,
`                <REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/>`,
`                <REQUIREMENT ref="FR-COLOR-PBR-SURFACE"/>
                <REQUIREMENT ref="FR-COLOR-GEOMETRY-VISIBILITY"/>
                <REQUIREMENT ref="FR-COLOR-UV-CHANNEL"/>`,
  'technology requirement links');
  fs.writeFileSync(path, text);
}

insertBeforeClosing('DevelopmentPlan.xml', '</DEVELOPMENT_PLAN>', `    <APPROVED_EXTENSION id="EXT-COLOR-GEOMETRY-UV"><REQUIREMENT ref="FR-COLOR-GEOMETRY-VISIBILITY"/><REQUIREMENT ref="FR-COLOR-UV-CHANNEL"/><MODULE ref="MOD-CONFIGURATION"/><MODULE ref="MOD-THREE-VIEWER"/><DESCRIPTION>Расширить существующий цветовой вариант необязательной видимостью узлов и выбором UV-канала без новой категории вариантов и без изменения публичных команд.</DESCRIPTION></APPROVED_EXTENSION>\n`);
insertBeforeClosing('ModuleContracts.xml', '</MODULE_CONTRACTS>', `    <CONTRACT_EXTENSION id="CONTRACT-EXT-COLOR-GEOMETRY-UV"><REQUIREMENT ref="FR-COLOR-GEOMETRY-VISIBILITY"/><REQUIREMENT ref="FR-COLOR-UV-CHANNEL"/><MODULE ref="MOD-CONFIGURATION"/><MODULE ref="MOD-THREE-VIEWER"/><INVARIANT>Viewer сначала восстанавливает базовую видимость, затем применяет структурный вариант, после него видимость цветового варианта и только затем материал; выборы остаются независимыми.</INVARIANT><ERROR_BEHAVIOR>Отсутствующий материал, узел или UV-атрибут отключает только соответствующий цветовой вариант, кроме недоступного default, который отключает группу по существующему правилу.</ERROR_BEHAVIOR></CONTRACT_EXTENSION>\n`);
insertBeforeClosing('ClassFunctionContracts.xml', '</CLASS_FUNCTION_CONTRACTS>', `    <CONTRACT_EXTENSION id="CFC-EXT-COLOR-GEOMETRY-UV"><DATA_CONTRACT ref="CFC-TYPE-COLOR-VARIANT-CONFIG"><FIELD name="visibleNodeNames" type="readonly string[]" required="NO">Узлы, показываемые после применения структурного варианта.</FIELD><FIELD name="hiddenNodeNames" type="readonly string[]" required="NO">Узлы, скрываемые после применения структурного варианта.</FIELD></DATA_CONTRACT><DATA_CONTRACT name="MaterialSurfaceConfig"><FIELD name="uvChannel" type="0 | 1 | 2 | 3" required="NO">UV-канал внешних PBR-текстур; default 0.</FIELD></DATA_CONTRACT><FUNCTION_CONTRACT ref="CFC-FN-VIEWER-INITIALIZE"><POSTCONDITION>Цвета с отсутствующим целевым узлом либо UV-атрибутом локально отключены.</POSTCONDITION></FUNCTION_CONTRACT><FUNCTION_CONTRACT ref="CFC-FN-VIEWER-APPLY-SELECTION"><POSTCONDITION>Цветовая видимость применена после структурной, а все загруженные карты используют нормализованный UV-канал.</POSTCONDITION></FUNCTION_CONTRACT></CONTRACT_EXTENSION>\n`);
insertBeforeClosing('MentalScenarios.xml', '</MENTAL_SCENARIOS>', `    <MENTAL_SCENARIO id="MS-COLOR-GEOMETRY-INDEPENDENCE"><GIVEN>Загружена модель с независимыми узлами конструкции и геометрии ткани.</GIVEN><WHEN>Хост меняет ткань, затем конструкцию и снова ткань.</WHEN><THEN>Оба выбора сохраняются, структурная видимость применяется первой, а видимость ткани — второй.</THEN></MENTAL_SCENARIO>\n    <MENTAL_SCENARIO id="MS-COLOR-UV-CHANNEL"><GIVEN>Внешняя PBR-текстура настроена на UV-канал 1, а целевые меши содержат uv1.</GIVEN><WHEN>Хост выбирает цветовой вариант.</WHEN><THEN>Все карты набора используют channel 1; вариант с отсутствующим требуемым UV-атрибутом локально отключается.</THEN></MENTAL_SCENARIO>\n`);
insertBeforeClosing('VerificationCriteria.xml', '</VERIFICATION_CRITERIA>', `    <CRITERION id="VC-COLOR-GEOMETRY-VISIBILITY"><REQUIREMENT ref="FR-COLOR-GEOMETRY-VISIBILITY"/><VERIFY>Списки узлов нормализуются, пересечение отклоняется, отсутствующий узел локально отключает цвет, а браузерный тест подтверждает сохранение видимости ткани при смене конструкции.</VERIFY></CRITERION>\n    <CRITERION id="VC-COLOR-UV-CHANNEL"><REQUIREMENT ref="FR-COLOR-UV-CHANNEL"/><VERIFY>Допустимы только целые 0..3, default равен 0, Texture.channel получает выбранное значение, uv1 проходит модельную проверку, отсутствующий uv2 локально отключает вариант.</VERIFY></CRITERION>\n`);

fs.writeFileSync('validation-report.json', JSON.stringify({
  status: 'PENDING',
  scope: 'color-geometry-uv-channel',
  generated_at: null,
  checks: [
    { id: 'requirements-propagation', status: 'PENDING' },
    { id: 'xml-well-formed', status: 'PENDING' },
    { id: 'typecheck', status: 'PENDING' },
    { id: 'production-build', status: 'PENDING' },
    { id: 'declarations', status: 'PENDING' },
    { id: 'public-api', status: 'PENDING' },
    { id: 'unit-tests', status: 'PENDING' },
    { id: 'color-geometry-e2e', status: 'PENDING' },
    { id: 'uv-channel-e2e', status: 'PENDING' },
    { id: 'full-playwright-matrix', status: 'PENDING' },
    { id: 'single-three', status: 'PENDING' },
  ],
}, null, 2) + '\n');

console.log('Applied color geometry and UV channel extension.');
