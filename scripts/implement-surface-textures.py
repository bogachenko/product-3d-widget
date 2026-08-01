from __future__ import annotations

import base64
import json
import re
import struct
import zlib
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one occurrence, found {count}")
    return text.replace(old, new, 1)


def sub_once(text: str, pattern: str, replacement: str, label: str, flags: int = 0) -> str:
    result, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return result


def add_requirement_after_color_selection(text: str) -> str:
    if 'FR-COLOR-SURFACE-TEXTURES' in text:
        return text
    replacements = (
        ('<REQUIREMENT ref="FR-COLOR-SELECTION"/>', '<REQUIREMENT ref="FR-COLOR-SELECTION"/><REQUIREMENT ref="FR-COLOR-SURFACE-TEXTURES"/>'),
        ('<REQUIREMENT ref="FR-COLOR-SELECTION" />', '<REQUIREMENT ref="FR-COLOR-SELECTION" />\n                        <REQUIREMENT ref="FR-COLOR-SURFACE-TEXTURES" />'),
    )
    for old, new in replacements:
        text = text.replace(old, new)
    return text


# ---------------------------------------------------------------------------
# GRACE artifacts
# ---------------------------------------------------------------------------
requirements = read("RequirementsAnalysis.xml")
if 'id="FR-COLOR-SURFACE-TEXTURES"' not in requirements:
    requirements = replace_once(
        requirements,
        '<EXCLUSION id="EXCL-MATERIAL-VARIANT-CATEGORY">В первой версии материал не является отдельной категорией вариантов наряду с цветовым и структурным вариантом.</EXCLUSION>',
        '<EXCLUSION id="EXCL-MATERIAL-VARIANT-CATEGORY">Материал не является отдельной категорией вариантов наряду с цветовым и структурным вариантом; необязательные PBR-карты поверхности задаются внутри существующего цветового варианта.</EXCLUSION>',
        "requirements exclusion",
    )
    requirements = replace_once(
        requirements,
        '<ENTITY id="ENTITY-COLOR-VARIANT"><NAME>Цветовой вариант товара</NAME><DESCRIPTION>Доступный для выбора цвет, применяемый к заранее определённым элементам основной 3D-модели.</DESCRIPTION></ENTITY>',
        '<ENTITY id="ENTITY-COLOR-VARIANT"><NAME>Цветовой вариант товара</NAME><DESCRIPTION>Доступная для выбора отделка заранее определённых материалов основной 3D-модели: обязательный образец цвета для интерфейса и необязательный PBR-набор поверхности с картами base color, normal, metallic-roughness и occlusion.</DESCRIPTION></ENTITY>',
        "requirements color entity",
    )
    old = '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SELECTION"><DESCRIPTION>При принятии запроса выбора настроенного цветового варианта компонент должен применить соответствующий цвет к средству 3D-просмотра и сохранить текущий выбор.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-CURRENT-SELECTION"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>'
    new = '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SELECTION"><DESCRIPTION>При принятии запроса выбора настроенного цветового варианта компонент должен применить соответствующий сплошной цвет либо настроенную PBR-поверхность к средству 3D-просмотра и сохранить текущий выбор.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-CURRENT-SELECTION"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>\n        <FUNCTIONAL_REQUIREMENT id="FR-COLOR-SURFACE-TEXTURES"><DESCRIPTION>Цветовой вариант может содержать необязательный PBR-набор поверхности с URL карт base color, normal, metallic-roughness и occlusion, общим повторением UV и множителем base color. Набор должен загружаться средствами утверждённого 3D-адаптера, применяться атомарно вместе со swatch-совместимым выбором и полностью восстанавливать исходные значения GLB при выборе базового варианта. Некорректный набор либо ошибка загрузки его обязательной карты отключает только соответствующий цветовой вариант; если отключён единственный вариант по умолчанию, отключается вся цветовая группа.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-GLB-MODEL"/><ENTITY ref="ENTITY-CURRENT-SELECTION"/><BUSINESS_PROCESS ref="BP-PRODUCT-EXPLORATION"/><BUSINESS_PROCESS ref="BP-CONFIGURATION-VALIDATION"/></LINKS></FUNCTIONAL_REQUIREMENT>'
    requirements = replace_once(requirements, old, new, "requirements surface requirement")
    requirements = replace_once(
        requirements,
        '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SWATCH-REQUIRED"><DESCRIPTION>Для каждого настроенного цветового варианта должен быть задан корректный образец сплошного цвета для отображения во внешнем интерфейсе. При отсутствии или некорректном значении соответствующий цветовой вариант должен отключаться.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-PRODUCT-CONFIGURATION"/></LINKS></FUNCTIONAL_REQUIREMENT>',
        '<FUNCTIONAL_REQUIREMENT id="FR-COLOR-SWATCH-REQUIRED"><DESCRIPTION>Для каждого настроенного цветового варианта должен быть задан корректный образец сплошного цвета для отображения во внешнем интерфейсе независимо от наличия PBR-текстур. При отсутствии или некорректном значении соответствующий цветовой вариант должен отключаться.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-COLOR-VARIANT"/><ENTITY ref="ENTITY-PRODUCT-CONFIGURATION"/></LINKS></FUNCTIONAL_REQUIREMENT>',
        "requirements swatch",
    )
    # Propagate the new requirement through existing color-selection graph edges.
    requirements = requirements.replace(
        '<REQUIREMENT ref="FR-COLOR-SELECTION"/>',
        '<REQUIREMENT ref="FR-COLOR-SELECTION"/><REQUIREMENT ref="FR-COLOR-SURFACE-TEXTURES"/>',
    ).replace(
        '<REQUIREMENT ref="FR-COLOR-SELECTION" />',
        '<REQUIREMENT ref="FR-COLOR-SELECTION" />\n                        <REQUIREMENT ref="FR-COLOR-SURFACE-TEXTURES" />',
    )
write("RequirementsAnalysis.xml", requirements)

technology = read("Technology.xml")
if 'FR-COLOR-SURFACE-TEXTURES' not in technology:
    technology = technology.replace(
        '<RESPONSIBILITY>Основной встроенный 3D-просмотр: загрузка GLB, WebGLRenderer, сцена, камера, OrbitControls, программные переходы к именованным ракурсам и узлам, материалы и цвета, видимость узлов структурных вариантов, AnimationMixer, именованные клипы, временные диапазоны, восстановление состояния и обработка потери WebGL-контекста.</RESPONSIBILITY>',
        '<RESPONSIBILITY>Основной встроенный 3D-просмотр: загрузка GLB, WebGLRenderer, сцена, камера, OrbitControls, программные переходы к именованным ракурсам и узлам, материалы, цвета и PBR-карты поверхности, видимость узлов структурных вариантов, AnimationMixer, именованные клипы, временные диапазоны, восстановление состояния и обработка потери WebGL-контекста.</RESPONSIBILITY>',
        1,
    )
    technology = technology.replace(
        '<CONSTRAINT>Three.js является единственным средством основного 3D-рендеринга. WebGPU renderer и альтернативный renderer в первой версии не используются.</CONSTRAINT>',
        '<CONSTRAINT>Three.js является единственным средством основного 3D-рендеринга. WebGPU renderer и альтернативный renderer в первой версии не используются.</CONSTRAINT>\n            <CONSTRAINT>Необязательные карты поверхности загружаются через TextureLoader, кешируются в пределах экземпляра, используют flipY=false для glTF UV, sRGB только для base color и линейное пространство для non-color карт.</CONSTRAINT>\n            <CONSTRAINT>Один metallic-roughness asset трактуется по glTF: зелёный канал задаёт roughness, синий — metalness; повторение UV применяется через RepeatWrapping.</CONSTRAINT>',
        1,
    )
    technology = technology.replace(
        '<CONSTRAINT>Перенос цветов и структурных вариантов в AR выполняется только в пределах публично поддерживаемых возможностей самостоятельно выбранного AR-канала.</CONSTRAINT>',
        '<CONSTRAINT>Перенос цветов, публично заменяемых PBR-карт и структурных вариантов в AR выполняется только в пределах публично поддерживаемых возможностей самостоятельно выбранного AR-канала; отсутствующий публичный TextureInfo не создаётся через внутренние API.</CONSTRAINT>',
        1,
    )
    technology = add_requirement_after_color_selection(technology)
write("Technology.xml", technology)

for artifact in ("DevelopmentPlan.xml", "ModuleContracts.xml"):
    content = read(artifact)
    if 'FR-COLOR-SURFACE-TEXTURES' not in content:
        content = add_requirement_after_color_selection(content)
        content = content.replace(
            'материалы и цвета',
            'материалы, цвета и необязательные PBR-карты поверхности',
        )
        content = content.replace(
            'цветов и структурных вариантов',
            'цветов, PBR-поверхностей и структурных вариантов',
        )
    write(artifact, content)

contracts = read("ClassFunctionContracts.xml")
if 'CFC-TYPE-SURFACE-TEXTURE-CONFIG' not in contracts:
    surface_contract = '''        <DATA_CONTRACT id="CFC-TYPE-SURFACE-TEXTURE-CONFIG" visibility="PUBLIC" kind="readonly interface">
            <NAME>SurfaceTextureConfig</NAME>
            <FIELDS>
                <FIELD name="baseColorTextureUrl" type="string" required="NO">Optional supported URL for the sRGB base-color map.</FIELD>
                <FIELD name="normalTextureUrl" type="string" required="NO">Optional supported URL for the linear normal map.</FIELD>
                <FIELD name="metallicRoughnessTextureUrl" type="string" required="NO">Optional supported URL for the glTF-packed linear map: roughness in G and metalness in B.</FIELD>
                <FIELD name="occlusionTextureUrl" type="string" required="NO">Optional supported URL for the linear ambient-occlusion map.</FIELD>
                <FIELD name="repeat" type="readonly [number, number]" required="NO">Positive finite U/V repeat, each not greater than 1000; defaults to [1, 1].</FIELD>
                <FIELD name="baseColorFactor" type="string" required="NO">Solid CSS multiplier for the textured surface; defaults to #ffffff.</FIELD>
            </FIELDS>
            <RULES>
                <RULE>At least one texture URL is required when surface is present.</RULE>
                <RULE>The base color variant may not declare surface and restores original GLB material values.</RULE>
                <RULE>swatch remains required and host-facing even when surface is present.</RULE>
            </RULES>
        </DATA_CONTRACT>
'''
    marker = '        <DATA_CONTRACT id="CFC-TYPE-COLOR-VARIANT-CONFIG" visibility="PUBLIC" kind="readonly interface">'
    contracts = replace_once(contracts, marker, surface_contract + marker, "surface data contract")
    contracts = replace_once(
        contracts,
        '<FIELD name="swatch" type="string" required="YES">Valid solid CSS color used by the host and, for non-base variants, as the material color.</FIELD>',
        '<FIELD name="swatch" type="string" required="YES">Valid solid CSS color used by the host and, when surface is absent, as the material color.</FIELD>',
        "swatch contract",
    )
    contracts = replace_once(
        contracts,
        '<FIELD name="materialNames" type="readonly string[]" required="YES">Explicit material names affected by a non-base color; base may use an empty list and restores captured originals.</FIELD>',
        '<FIELD name="materialNames" type="readonly string[]" required="YES">Explicit material names affected by a non-base color or surface; base may use an empty list and restores captured originals.</FIELD>\n                <FIELD name="surface" type="SurfaceTextureConfig" required="NO">Optional PBR maps applied as part of this existing color choice; this does not create a separate material-variant category.</FIELD>',
        "surface color field",
    )
    contracts = contracts.replace(
        '<RULE>A missing or invalid swatch disables only that color unless it was the sole declared default, in which case the group is disabled.</RULE>',
        '<RULE>A missing or invalid swatch or surface disables only that color unless it was the sole declared default, in which case the group is disabled.</RULE>\n                <RULE>A surface asset load failure follows the same isolated/default-group failure rule.</RULE>',
        1,
    )
    contracts = contracts.replace(
        '<INTENT>Apply one validated color or restore captured base material values without changing playback/camera/variant.</INTENT>',
        '<INTENT>Apply one validated solid color or preloaded PBR surface, or restore all captured base material values, without changing playback/camera/variant.</INTENT>',
        1,
    )
    contracts = contracts.replace(
        '<CONDITION>Success changes only intended materials.</CONDITION>',
        '<CONDITION>Success changes only intended materials and atomically restores/replaces color, base-color map, normal map, metallic/roughness maps and occlusion map.</CONDITION>',
        1,
    )
    contracts = contracts.replace(
        '<RULE>Operation failure leaves or restores the prior rendered color as far as internally observable.</RULE>',
        '<RULE>Operation failure leaves or restores the prior rendered color and texture set as far as internally observable.</RULE>',
        1,
    )
    contracts = contracts.replace(
        '<MINIMUM_RUNNABLE_CHECK>Applying color during playback does not recreate mixer/action or reset time.</MINIMUM_RUNNABLE_CHECK>',
        '<MINIMUM_RUNNABLE_CHECK>Applying textured color changes rendered base-color pixels, restoring base restores GLB maps, and playback time is not reset.</MINIMUM_RUNNABLE_CHECK>',
        1,
    )
    contracts = add_requirement_after_color_selection(contracts)
    # Add explicit initialization and AR synchronization semantics inside their existing blocks.
    contracts = contracts.replace(
        '<RULE>Optional model reference errors disable only affected capabilities.</RULE>',
        '<RULE>Optional model reference errors and surface texture load failures disable only affected capabilities.</RULE>',
        1,
    )
    ar_block_pattern = r'(<FUNCTION_CONTRACT id="CFC-FN-AR-SYNC-SELECTION"[\s\S]*?</FUNCTION_CONTRACT>)'
    match = re.search(ar_block_pattern, contracts)
    if match:
        block = match.group(1)
        block = block.replace(
            'Synchronize the confirmed color selection into the hidden model-viewer model before launch.',
            'Synchronize the confirmed solid color or publicly replaceable PBR surface into the hidden model-viewer model before launch.',
        )
        block = block.replace(
            '<REQUIREMENT ref="FR-COLOR-SELECTION" />',
            '<REQUIREMENT ref="FR-COLOR-SELECTION" />\n                        <REQUIREMENT ref="FR-COLOR-SURFACE-TEXTURES" />',
        )
        contracts = contracts[:match.start()] + block + contracts[match.end():]
write("ClassFunctionContracts.xml", contracts)

# ---------------------------------------------------------------------------
# Public API and configuration normalization
# ---------------------------------------------------------------------------
widget = read("src/product-3d-widget.ts")
if 'export interface SurfaceTextureConfig' not in widget:
    marker = 'export interface ColorVariantConfig {'
    surface_interface = '''export interface SurfaceTextureConfig {
  readonly baseColorTextureUrl?: string;
  readonly normalTextureUrl?: string;
  readonly metallicRoughnessTextureUrl?: string;
  readonly occlusionTextureUrl?: string;
  readonly repeat?: readonly [number, number];
  readonly baseColorFactor?: string;
}

'''
    widget = replace_once(widget, marker, surface_interface + marker, "public surface interface")
    widget = replace_once(
        widget,
        '  readonly materialNames: readonly string[];\n}\n\nexport interface StructuralVariantConfig',
        '  readonly materialNames: readonly string[];\n  readonly surface?: SurfaceTextureConfig;\n}\n\nexport interface StructuralVariantConfig',
        "public color surface field",
    )
write("src/product-3d-widget.ts", widget)

configuration = read("src/configuration.ts")
if 'NormalizedSurfaceTexture' not in configuration:
    configuration = configuration.replace(
        '  ScenarioStepConfig,\n  StructuralVariantConfig,',
        '  ScenarioStepConfig,\n  StructuralVariantConfig,\n  SurfaceTextureConfig,',
        1,
    )
    normalized = '''export interface NormalizedSurfaceTexture {
  readonly baseColorTextureUrl: string | null;
  readonly normalTextureUrl: string | null;
  readonly metallicRoughnessTextureUrl: string | null;
  readonly occlusionTextureUrl: string | null;
  readonly repeat: readonly [number, number];
  readonly baseColorFactor: string;
}

'''
    configuration = replace_once(
        configuration,
        'export interface NormalizedColorVariant {',
        normalized + 'export interface NormalizedColorVariant {',
        "normalized surface interface",
    )
    configuration = replace_once(
        configuration,
        '  readonly materialNames: readonly string[];\n}\n\nexport interface NormalizedStructuralVariant',
        '  readonly materialNames: readonly string[];\n  readonly surface: NormalizedSurfaceTexture | null;\n}\n\nexport interface NormalizedStructuralVariant',
        "normalized color surface field",
    )
    normalize_surface = '''
const normalizeSurface = (value: unknown): NormalizedSurfaceTexture | null | false => {
  if (value === undefined) return null;
  if (!isObject(value)) return false;
  const textureFields = [
    'baseColorTextureUrl',
    'normalTextureUrl',
    'metallicRoughnessTextureUrl',
    'occlusionTextureUrl',
  ] as const satisfies readonly (keyof SurfaceTextureConfig)[];
  const urls: Record<(typeof textureFields)[number], string | null> = {
    baseColorTextureUrl: null,
    normalTextureUrl: null,
    metallicRoughnessTextureUrl: null,
    occlusionTextureUrl: null,
  };
  for (const field of textureFields) {
    const candidate = value[field];
    if (candidate === undefined) continue;
    if (!usableAssetUrl(candidate)) return false;
    urls[field] = candidate.trim();
  }
  if (textureFields.every((field) => urls[field] === null)) return false;

  let repeat: readonly [number, number] = Object.freeze([1, 1]);
  if (value.repeat !== undefined) {
    if (!Array.isArray(value.repeat)
      || value.repeat.length !== 2
      || value.repeat.some((item) => typeof item !== 'number' || !Number.isFinite(item) || item <= 0 || item > 1000)) return false;
    repeat = Object.freeze([value.repeat[0] as number, value.repeat[1] as number]);
  }
  const baseColorFactor = value.baseColorFactor === undefined ? '#ffffff' : value.baseColorFactor;
  if (!nonEmptyString(baseColorFactor) || !isSolidCssColor(baseColorFactor)) return false;
  return Object.freeze({
    ...urls,
    repeat,
    baseColorFactor: baseColorFactor.trim(),
  });
};
'''
    configuration = replace_once(
        configuration,
        '\nconst normalizeCameraViews = (',
        normalize_surface + '\nconst normalizeCameraViews = (',
        "surface normalizer",
    )
    configuration = replace_once(
        configuration,
        '    const materialNames = uniqueStrings(item.materialNames);\n    if (seen.has(id) || materialNames === null || (!item.isBase && materialNames.length === 0) || !isSolidCssColor(item.swatch)) {',
        '    const materialNames = uniqueStrings(item.materialNames);\n    const surface = normalizeSurface(item.surface);\n    if (seen.has(id) || materialNames === null || (!item.isBase && materialNames.length === 0) || !isSolidCssColor(item.swatch) || surface === false || (item.isBase && surface !== null)) {',
        "surface validation",
    )
    configuration = replace_once(
        configuration,
        '      materialNames,\n    }));',
        '      materialNames,\n      surface,\n    }));',
        "normalized surface assignment",
    )
write("src/configuration.ts", configuration)

# ---------------------------------------------------------------------------
# Three.js viewer
# ---------------------------------------------------------------------------
viewer = read("src/three-viewer.ts")
if '#surfaceTexturesByColorId' not in viewer:
    viewer = viewer.replace('  MeshStandardMaterial,\n  Object3D,', '  MeshStandardMaterial,\n  NoColorSpace,\n  Object3D,', 1)
    viewer = viewer.replace('  Quaternion,\n  Scene,', '  Quaternion,\n  RepeatWrapping,\n  Scene,', 1)
    viewer = viewer.replace('  Texture,\n  Vector3,', '  Texture,\n  TextureLoader,\n  Vector3,', 1)
    viewer = viewer.replace(
        '  NormalizedProductConfiguration,\n  NormalizedScenario,',
        '  NormalizedProductConfiguration,\n  NormalizedScenario,\n  NormalizedColorVariant,',
        1,
    )
    material_types = '''
type MaterialSnapshot = Readonly<{
  color: Color;
  map: Texture | null;
  normalMap: Texture | null;
  roughnessMap: Texture | null;
  metalnessMap: Texture | null;
  aoMap: Texture | null;
}>;

type SurfaceTextureSet = Readonly<{
  baseColor: Texture | null;
  normal: Texture | null;
  metallicRoughness: Texture | null;
  occlusion: Texture | null;
}>;
'''
    viewer = replace_once(
        viewer,
        '\ntype CameraTransition = {',
        material_types + '\ntype CameraTransition = {',
        "viewer material types",
    )
    viewer = replace_once(
        viewer,
        '  readonly #baseMaterialColors = new Map<MeshStandardMaterial, Color>();',
        '  readonly #baseMaterialSnapshots = new Map<MeshStandardMaterial, MaterialSnapshot>();\n  readonly #surfaceTexturesByColorId = new Map<string, SurfaceTextureSet>();\n  readonly #surfaceTextureCache = new Map<string, Promise<Texture>>();\n  readonly #ownedSurfaceTextures = new Set<Texture>();',
        "viewer texture fields",
    )
    viewer = viewer.replace('      const result = this.#validateModelBoundCapabilities();', '      const result = await this.#validateModelBoundCapabilities();', 1)
    viewer = viewer.replace('    this.#baseMaterialColors.clear();', '    this.#baseMaterialSnapshots.clear();\n    this.#surfaceTexturesByColorId.clear();\n    this.#surfaceTextureCache.clear();\n    this.#ownedSurfaceTextures.clear();', 1)
    viewer = replace_once(
        viewer,
        '          if (!this.#baseMaterialColors.has(material)) this.#baseMaterialColors.set(material, material.color.clone());',
        '''          if (!this.#baseMaterialSnapshots.has(material)) {
            this.#baseMaterialSnapshots.set(material, Object.freeze({
              color: material.color.clone(),
              map: material.map,
              normalMap: material.normalMap,
              roughnessMap: material.roughnessMap,
              metalnessMap: material.metalnessMap,
              aoMap: material.aoMap,
            }));
          }''',
        "capture material snapshot",
    )
    preload_methods = '''
  async #loadSurfaceTexture(
    url: string,
    role: 'base-color' | 'normal' | 'metallic-roughness' | 'occlusion',
    repeat: readonly [number, number],
  ): Promise<Texture> {
    const key = `${role}\u0000${url}\u0000${repeat[0]}\u0000${repeat[1]}`;
    let pending = this.#surfaceTextureCache.get(key);
    if (pending === undefined) {
      pending = new TextureLoader().loadAsync(url).then((texture) => {
        if (this.#disposed) {
          texture.dispose();
          throw new Error('Viewer disposed during surface texture loading.');
        }
        texture.flipY = false;
        texture.wrapS = RepeatWrapping;
        texture.wrapT = RepeatWrapping;
        texture.repeat.set(repeat[0], repeat[1]);
        texture.colorSpace = role === 'base-color' ? SRGBColorSpace : NoColorSpace;
        texture.needsUpdate = true;
        this.#ownedSurfaceTextures.add(texture);
        return texture;
      }).catch((cause) => {
        this.#surfaceTextureCache.delete(key);
        throw cause;
      });
      this.#surfaceTextureCache.set(key, pending);
    }
    return pending;
  }

  async #preloadSurfaceTextures(color: NormalizedColorVariant): Promise<SurfaceTextureSet> {
    const surface = color.surface;
    if (surface === null) {
      return Object.freeze({ baseColor: null, normal: null, metallicRoughness: null, occlusion: null });
    }
    const load = (url: string | null, role: 'base-color' | 'normal' | 'metallic-roughness' | 'occlusion'): Promise<Texture | null> =>
      url === null ? Promise.resolve(null) : this.#loadSurfaceTexture(url, role, surface.repeat);
    const [baseColor, normal, metallicRoughness, occlusion] = await Promise.all([
      load(surface.baseColorTextureUrl, 'base-color'),
      load(surface.normalTextureUrl, 'normal'),
      load(surface.metallicRoughnessTextureUrl, 'metallic-roughness'),
      load(surface.occlusionTextureUrl, 'occlusion'),
    ]);
    return Object.freeze({ baseColor, normal, metallicRoughness, occlusion });
  }

'''
    viewer = replace_once(
        viewer,
        '  #validateModelBoundCapabilities(): Extract<ViewerInitializationResult, { ok: true }> {',
        preload_methods + '  async #validateModelBoundCapabilities(): Promise<Extract<ViewerInitializationResult, { ok: true }>> {',
        "async capability validation",
    )
    old_loop = '''    for (const color of this.#config!.colorsById.values()) {
      if (color.isBase || color.materialNames.every((name) => this.#materialsByName.has(name))) {
        this.#enabledColors.add(color.id);
      } else {
        localErrors.push(localError('COLOR_DISABLED', 'color', `Color "${color.id}" references a missing material.`, color.id));
      }
    }'''
    new_loop = '''    for (const color of this.#config!.colorsById.values()) {
      if (!color.isBase && !color.materialNames.every((name) => this.#materialsByName.has(name))) {
        localErrors.push(localError('COLOR_DISABLED', 'color', `Color "${color.id}" references a missing material.`, color.id));
        continue;
      }
      try {
        if (color.surface !== null) this.#surfaceTexturesByColorId.set(color.id, await this.#preloadSurfaceTextures(color));
        this.#enabledColors.add(color.id);
      } catch (cause) {
        localErrors.push(localError(
          'COLOR_DISABLED',
          'color',
          `Color "${color.id}" surface texture could not be loaded: ${cause instanceof Error ? cause.message : String(cause)}.`,
          color.id,
        ));
      }
    }'''
    viewer = replace_once(viewer, old_loop, new_loop, "surface capability loop")
    apply_pattern = r'  #applySelectionDirect\(\): void \{[\s\S]*?\n  \}\n\n  #cameraRejected'
    apply_replacement = '''  #applySelectionDirect(): void {
    for (const [object, visible] of this.#baseVisibility) object.visible = visible;
    const variant = this.#currentSelection.variantId === null
      ? undefined
      : this.#config!.variantsById.get(this.#currentSelection.variantId);
    if (variant !== undefined && !variant.isBase) {
      for (const name of variant.visibleNodeNames) this.#nodesByName.get(name)!.visible = true;
      for (const name of variant.hiddenNodeNames) this.#nodesByName.get(name)!.visible = false;
    }

    for (const [material, snapshot] of this.#baseMaterialSnapshots) {
      material.color.copy(snapshot.color);
      material.map = snapshot.map;
      material.normalMap = snapshot.normalMap;
      material.roughnessMap = snapshot.roughnessMap;
      material.metalnessMap = snapshot.metalnessMap;
      material.aoMap = snapshot.aoMap;
      material.needsUpdate = true;
    }
    const color = this.#currentSelection.colorId === null
      ? undefined
      : this.#config!.colorsById.get(this.#currentSelection.colorId);
    if (color !== undefined && !color.isBase) {
      const textures = this.#surfaceTexturesByColorId.get(color.id);
      for (const name of color.materialNames) {
        for (const material of this.#materialsByName.get(name) ?? []) {
          material.color.setStyle(color.surface?.baseColorFactor ?? color.swatch);
          if (textures?.baseColor !== null && textures?.baseColor !== undefined) material.map = textures.baseColor;
          if (textures?.normal !== null && textures?.normal !== undefined) material.normalMap = textures.normal;
          if (textures?.metallicRoughness !== null && textures?.metallicRoughness !== undefined) {
            material.roughnessMap = textures.metallicRoughness;
            material.metalnessMap = textures.metallicRoughness;
          }
          if (textures?.occlusion !== null && textures?.occlusion !== undefined) material.aoMap = textures.occlusion;
          material.needsUpdate = true;
        }
      }
    }
  }

  #cameraRejected'''
    viewer = sub_once(viewer, apply_pattern, apply_replacement, "surface selection application")
    viewer = replace_once(
        viewer,
        '    const disposedTextures = new Set<Texture>();',
        '''    const disposedTextures = new Set<Texture>();
    for (const texture of this.#ownedSurfaceTextures) {
      if (disposedTextures.has(texture)) continue;
      disposedTextures.add(texture);
      try { texture.dispose(); } catch { /* cleanup continues */ }
    }''',
        "dispose surface textures",
    )
    viewer = viewer.replace('    this.#baseMaterialColors.clear();', '    this.#baseMaterialSnapshots.clear();')
    release_marker = '    this.#baseMaterialSnapshots.clear();\n    this.#clipsByName.clear();'
    if release_marker in viewer:
        viewer = viewer.replace(
            release_marker,
            '    this.#baseMaterialSnapshots.clear();\n    this.#surfaceTexturesByColorId.clear();\n    this.#surfaceTextureCache.clear();\n    this.#ownedSurfaceTextures.clear();\n    this.#clipsByName.clear();',
            1,
        )
write("src/three-viewer.ts", viewer)

# ---------------------------------------------------------------------------
# AR adapter using only model-viewer's public scene-graph API
# ---------------------------------------------------------------------------
ar = read("src/ar-adapter.ts")
if '#arTextureCache' not in ar:
    ar_types = '''
type ArModel = NonNullable<ModelViewerElement['model']>;
type ArMaterial = NonNullable<ReturnType<ArModel['getMaterialByName']>>;
type ArTexture = NonNullable<Awaited<ReturnType<ModelViewerElement['createTexture']>>>;
type ArMaterialSnapshot = Readonly<{
  material: ArMaterial;
  baseColorFactor: readonly number[];
  baseColorTexture: ArTexture | null;
  metallicRoughnessTexture: ArTexture | null;
  normalTexture: ArTexture | null;
  occlusionTexture: ArTexture | null;
}>;

const REPEAT_WRAP = 10497;

const textureMimeType = (url: string): string => {
  const dataMatch = /^data:([^;,]+)/i.exec(url);
  if (dataMatch?.[1]) return dataMatch[1];
  const pathname = (() => {
    try { return new URL(url, document.baseURI).pathname.toLowerCase(); } catch { return url.toLowerCase(); }
  })();
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.ktx2')) return 'image/ktx2';
  return 'image/png';
};
'''
    ar = replace_once(ar, '\ntype ArStatusEvent = CustomEvent<Readonly<{ status: string }>>;\n', '\ntype ArStatusEvent = CustomEvent<Readonly<{ status: string }>>;\n' + ar_types, "AR texture types")
    ar = replace_once(
        ar,
        '  readonly #baseColors = new Map<string, readonly number[]>();',
        '  readonly #baseMaterialSnapshots = new Map<string, ArMaterialSnapshot>();\n  readonly #arTextureCache = new Map<string, Promise<ArTexture>>();\n  #surfacePreload: Promise<void> | null = null;',
        "AR texture fields",
    )
    preload_assignment = '''      this.#element = element;
      this.#hiddenHost.append(element);
      this.#surfacePreload = this.#loaded.then(async () => {
        const pending: Promise<ArTexture>[] = [];
        for (const color of config.colorsById.values()) {
          const surface = color.surface;
          if (surface === null) continue;
          const entries = [
            ['base-color', surface.baseColorTextureUrl],
            ['normal', surface.normalTextureUrl],
            ['metallic-roughness', surface.metallicRoughnessTextureUrl],
            ['occlusion', surface.occlusionTextureUrl],
          ] as const;
          for (const [role, url] of entries) {
            if (url !== null) pending.push(this.#loadArTexture(url, role, surface.repeat));
          }
        }
        await Promise.allSettled(pending);
      });
      void this.#surfacePreload.catch(() => undefined);'''
    ar = replace_once(
        ar,
        '      this.#element = element;\n      this.#hiddenHost.append(element);',
        preload_assignment,
        "AR preload assignment",
    )
    ar_helpers = '''
  async #loadArTexture(
    url: string,
    role: 'base-color' | 'normal' | 'metallic-roughness' | 'occlusion',
    repeat: readonly [number, number],
  ): Promise<ArTexture> {
    if (this.#element === null) throw new Error('AR element is unavailable.');
    const key = `${role}\u0000${url}\u0000${repeat[0]}\u0000${repeat[1]}`;
    let pending = this.#arTextureCache.get(key);
    if (pending === undefined) {
      pending = this.#element.createTexture(url, textureMimeType(url)).then((texture) => {
        if (texture === null) throw new Error(`AR texture "${url}" could not be created.`);
        texture.sampler.setWrapS(REPEAT_WRAP);
        texture.sampler.setWrapT(REPEAT_WRAP);
        texture.sampler.setScale({ u: repeat[0], v: repeat[1] });
        return texture;
      }).catch((cause) => {
        this.#arTextureCache.delete(key);
        throw cause;
      });
      this.#arTextureCache.set(key, pending);
    }
    return pending;
  }

  async #captureAndRestoreBaseMaterials(model: ArModel): Promise<void> {
    for (const color of this.#config!.colorsById.values()) {
      for (const materialName of color.materialNames) {
        if (this.#baseMaterialSnapshots.has(materialName)) continue;
        const material = model.getMaterialByName(materialName);
        if (material === null) continue;
        await material.ensureLoaded();
        const pbr = material.pbrMetallicRoughness;
        this.#baseMaterialSnapshots.set(materialName, Object.freeze({
          material,
          baseColorFactor: Object.freeze([...pbr.baseColorFactor]),
          baseColorTexture: pbr.baseColorTexture?.texture ?? null,
          metallicRoughnessTexture: pbr.metallicRoughnessTexture?.texture ?? null,
          normalTexture: material.normalTexture?.texture ?? null,
          occlusionTexture: material.occlusionTexture?.texture ?? null,
        }));
      }
    }
    for (const snapshot of this.#baseMaterialSnapshots.values()) {
      const material = snapshot.material;
      const pbr = material.pbrMetallicRoughness;
      pbr.setBaseColorFactor([...snapshot.baseColorFactor] as [number, number, number, number]);
      pbr.baseColorTexture?.setTexture(snapshot.baseColorTexture);
      pbr.metallicRoughnessTexture?.setTexture(snapshot.metallicRoughnessTexture);
      material.normalTexture?.setTexture(snapshot.normalTexture);
      material.occlusionTexture?.setTexture(snapshot.occlusionTexture);
    }
  }

'''
    ar = replace_once(ar, '  // <SEMANTIC_BLOCK id="CFC-FN-AR-SYNC-SELECTION">', ar_helpers + '  // <SEMANTIC_BLOCK id="CFC-FN-AR-SYNC-SELECTION">', "AR helper insertion")
    sync_pattern = r'  // <SEMANTIC_BLOCK id="CFC-FN-AR-SYNC-SELECTION">[\s\S]*?  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id="CFC-FN-AR-LAUNCH">'
    sync_replacement = '''  // <SEMANTIC_BLOCK id="CFC-FN-AR-SYNC-SELECTION">
  async syncSelection(selection: ConfirmedSelection): Promise<ArSyncResult> {
    if (this.#disposed || this.#element === null || this.#config === null || this.#loaded === null) {
      return Object.freeze({ ok: false, error: arError('AR_SYNC_FAILED', 'AR selection cannot be synchronized before initialization.') });
    }
    try {
      await this.#loaded;
      await this.#surfacePreload;
      this.#selection = Object.freeze({ ...selection });
      const model = this.#element.model;
      if (model !== undefined) {
        await this.#captureAndRestoreBaseMaterials(model);
        const color = selection.colorId === null ? undefined : this.#config.colorsById.get(selection.colorId);
        if (color !== undefined && !color.isBase) {
          for (const materialName of color.materialNames) {
            const material = model.getMaterialByName(materialName);
            if (material === null) continue;
            await material.ensureLoaded();
            const pbr = material.pbrMetallicRoughness;
            pbr.setBaseColorFactor(color.surface?.baseColorFactor ?? color.swatch);
            const surface = color.surface;
            if (surface === null) continue;
            if (surface.baseColorTextureUrl !== null && pbr.baseColorTexture !== null) {
              pbr.baseColorTexture.setTexture(await this.#loadArTexture(surface.baseColorTextureUrl, 'base-color', surface.repeat));
            }
            if (surface.metallicRoughnessTextureUrl !== null && pbr.metallicRoughnessTexture !== null) {
              pbr.metallicRoughnessTexture.setTexture(await this.#loadArTexture(surface.metallicRoughnessTextureUrl, 'metallic-roughness', surface.repeat));
            }
            if (surface.normalTextureUrl !== null && material.normalTexture !== null) {
              material.normalTexture.setTexture(await this.#loadArTexture(surface.normalTextureUrl, 'normal', surface.repeat));
            }
            if (surface.occlusionTextureUrl !== null && material.occlusionTexture !== null) {
              material.occlusionTexture.setTexture(await this.#loadArTexture(surface.occlusionTextureUrl, 'occlusion', surface.repeat));
            }
          }
        }
      }
      return Object.freeze({ ok: true });
    } catch (cause) {
      try {
        const model = this.#element.model;
        if (model !== undefined) await this.#captureAndRestoreBaseMaterials(model);
      } catch { /* best-effort rollback */ }
      return Object.freeze({
        ok: false,
        error: arError('AR_SYNC_FAILED', `AR selection synchronization failed: ${cause instanceof Error ? cause.message : String(cause)}`),
      });
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-AR-LAUNCH">'''
    ar = sub_once(ar, sync_pattern, sync_replacement, "AR surface sync")
    ar = ar.replace('    this.#baseColors.clear();', '    this.#baseMaterialSnapshots.clear();\n    this.#arTextureCache.clear();\n    this.#surfacePreload = null;', 1)
write("src/ar-adapter.ts", ar)

# ---------------------------------------------------------------------------
# Unit tests
# ---------------------------------------------------------------------------
config_tests = read("tests/configuration.test.ts")
if "normalizes an optional PBR surface" not in config_tests:
    insertion = '''
  it('normalizes an optional PBR surface and keeps swatch-only compatibility', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: input.colors!.map((color) => color.id === 'red' ? {
        ...color,
        surface: {
          baseColorTextureUrl: '/tests/fixtures/surface-red.png',
          normalTextureUrl: '/tests/fixtures/surface-normal.png',
          metallicRoughnessTextureUrl: '/tests/fixtures/surface-mr.png',
          occlusionTextureUrl: '/tests/fixtures/surface-ao.png',
          repeat: [3, 5] as const,
          baseColorFactor: '#eeeeee',
        },
      } : color),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.colorsById.get('red')!.surface).toEqual({
        baseColorTextureUrl: '/tests/fixtures/surface-red.png',
        normalTextureUrl: '/tests/fixtures/surface-normal.png',
        metallicRoughnessTextureUrl: '/tests/fixtures/surface-mr.png',
        occlusionTextureUrl: '/tests/fixtures/surface-ao.png',
        repeat: [3, 5],
        baseColorFactor: '#eeeeee',
      });
      expect(result.configuration.colorsById.get('original')!.surface).toBeNull();
    }
  });

  it('disables only a non-default color with an invalid PBR surface', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: [...input.colors!, {
        id: 'bad-surface',
        label: 'Bad surface',
        swatch: '#123456',
        isDefault: false,
        isBase: false,
        materialNames: ['Body'],
        surface: { baseColorTextureUrl: 'javascript:bad', repeat: [1, 1] },
      }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.configuration.colorsById.has('bad-surface')).toBe(false);
      expect(result.configuration.colorsById.has('red')).toBe(true);
    }
  });

  it('disables the color group when its default PBR surface is invalid', () => {
    const input = validConfiguration();
    const result = normalizeProductConfiguration({
      ...input,
      colors: input.colors!.map((color) => color.id === 'original'
        ? { ...color, isDefault: false }
        : { ...color, isDefault: true, surface: { repeat: [0, 1] } }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.configuration.colorsById.size).toBe(0);
  });
'''
    config_tests = replace_once(config_tests, "\n  it('disables only an invalid non-default color'", insertion + "\n  it('disables only an invalid non-default color'", "surface unit tests")
write("tests/configuration.test.ts", config_tests)

# ---------------------------------------------------------------------------
# Browser fixture and E2E
# ---------------------------------------------------------------------------
def png_rgba(path: Path, rgba: tuple[int, int, int, int], width: int = 2, height: int = 2) -> None:
    raw = b''.join(b'\x00' + bytes(rgba) * width for _ in range(height))
    def chunk(kind: bytes, payload: bytes) -> bytes:
        return struct.pack('>I', len(payload)) + kind + payload + struct.pack('>I', zlib.crc32(kind + payload) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    path.write_bytes(data)

fixtures = ROOT / "tests" / "fixtures"
png_rgba(fixtures / "surface-red.png", (235, 30, 30, 255))
png_rgba(fixtures / "surface-blue.png", (25, 50, 235, 255))
png_rgba(fixtures / "surface-normal.png", (128, 128, 255, 255))
png_rgba(fixtures / "surface-mr.png", (0, 220, 0, 255))
png_rgba(fixtures / "surface-ao.png", (255, 255, 255, 255))

positions = [
    -1.0, -1.0, 0.0,
     1.0, -1.0, 0.0,
     1.0,  1.0, 0.0,
    -1.0,  1.0, 0.0,
]
uvs = [0.0, 0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0]
indices = [0, 1, 2, 0, 2, 3]
buffer = struct.pack('<12f8f6H', *(positions + uvs + indices))
gltf = {
    "asset": {"version": "2.0", "generator": "product-3d-widget surface tests"},
    "scene": 0,
    "scenes": [{"nodes": [0]}],
    "nodes": [{"name": "SurfaceRoot", "mesh": 0}],
    "meshes": [{"name": "SurfaceMesh", "primitives": [{"attributes": {"POSITION": 0, "TEXCOORD_0": 1}, "indices": 2, "material": 0}]}],
    "materials": [{"name": "Body", "doubleSided": True, "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 1}}],
    "buffers": [{"byteLength": len(buffer), "uri": "data:application/octet-stream;base64," + base64.b64encode(buffer).decode()}],
    "bufferViews": [
        {"buffer": 0, "byteOffset": 0, "byteLength": 48, "target": 34962},
        {"buffer": 0, "byteOffset": 48, "byteLength": 32, "target": 34962},
        {"buffer": 0, "byteOffset": 80, "byteLength": 12, "target": 34963},
    ],
    "accessors": [
        {"bufferView": 0, "componentType": 5126, "count": 4, "type": "VEC3", "min": [-1, -1, 0], "max": [1, 1, 0]},
        {"bufferView": 1, "componentType": 5126, "count": 4, "type": "VEC2", "min": [0, 0], "max": [1, 1]},
        {"bufferView": 2, "componentType": 5123, "count": 6, "type": "SCALAR"},
    ],
}
(fixtures / "surface.gltf").write_text(json.dumps(gltf, separators=(",", ":")) + "\n", encoding="utf-8")

e2e = read("tests/product-3d-widget.spec.ts")
if "PBR surface textures switch rendered material maps" not in e2e:
    test_block = r'''
test('PBR surface textures switch rendered material maps and isolate load failures', async ({ page }) => {
  await openFixture(page);
  const requested = new Set<string>();
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname.includes('/tests/fixtures/surface-')) requested.add(pathname);
  });
  const surfaceConfiguration = {
    productId: 'surface-product',
    glbUrl: '/tests/fixtures/surface.gltf',
    colors: [
      { id: 'original', label: 'Original', swatch: '#ffffff', isDefault: true, isBase: true, materialNames: [] },
      {
        id: 'red-surface', label: 'Red', swatch: '#eb1e1e', isDefault: false, isBase: false, materialNames: ['Body'],
        surface: {
          baseColorTextureUrl: '/tests/fixtures/surface-red.png',
          normalTextureUrl: '/tests/fixtures/surface-normal.png',
          metallicRoughnessTextureUrl: '/tests/fixtures/surface-mr.png',
          occlusionTextureUrl: '/tests/fixtures/surface-ao.png',
          repeat: [2, 2],
        },
      },
      {
        id: 'blue-surface', label: 'Blue', swatch: '#1932eb', isDefault: false, isBase: false, materialNames: ['Body'],
        surface: { baseColorTextureUrl: '/tests/fixtures/surface-blue.png' },
      },
      {
        id: 'missing-surface', label: 'Missing', swatch: '#555555', isDefault: false, isBase: false, materialNames: ['Body'],
        surface: { baseColorTextureUrl: '/tests/fixtures/surface-missing.png' },
      },
    ],
  };
  const initialized = await configureWidget(page, surfaceConfiguration);
  expect(initialized.outcome).toBe('ready');

  const result = await page.locator('#widget').evaluate(async (widget: any) => {
    const sample = (): { red: number; green: number; blue: number } => {
      const canvas = widget.shadowRoot.querySelector('canvas') as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2')!;
      const pixels = new Uint8Array(canvas.width * canvas.height * 4);
      gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
      let red = 0; let green = 0; let blue = 0; let count = 0;
      for (let index = 0; index < pixels.length; index += 4) {
        if (pixels[index + 3]! < 16) continue;
        red += pixels[index]!;
        green += pixels[index + 1]!;
        blue += pixels[index + 2]!;
        count += 1;
      }
      return { red: red / Math.max(count, 1), green: green / Math.max(count, 1), blue: blue / Math.max(count, 1) };
    };
    await widget.selectColor('red-surface');
    const red = sample();
    await widget.selectColor('blue-surface');
    const blue = sample();
    await widget.selectColor('original');
    return { red, blue, state: widget.getState() };
  });

  expect(result.red.red).toBeGreaterThan(result.red.blue * 1.4);
  expect(result.blue.blue).toBeGreaterThan(result.blue.red * 1.4);
  expect(result.state.selection.colorId).toBe('original');
  expect(result.state.capabilities.colors.map((item: { id: string }) => item.id)).toEqual(['original', 'red-surface', 'blue-surface']);
  expect(result.state.capabilities.localErrors).toEqual(expect.arrayContaining([
    expect.objectContaining({ code: 'COLOR_DISABLED', entityId: 'missing-surface' }),
  ]));
  expect([...requested]).toEqual(expect.arrayContaining([
    '/tests/fixtures/surface-red.png',
    '/tests/fixtures/surface-blue.png',
    '/tests/fixtures/surface-normal.png',
    '/tests/fixtures/surface-mr.png',
    '/tests/fixtures/surface-ao.png',
  ]));
});
'''
    e2e = replace_once(e2e, "\ntest('natural completion and scenario final-frame holding are observable'", test_block + "\ntest('natural completion and scenario final-frame holding are observable'", "surface e2e")
write("tests/product-3d-widget.spec.ts", e2e)

# ---------------------------------------------------------------------------
# Documentation
# ---------------------------------------------------------------------------
readme = read("README.md")
if "## PBR-текстуры цветовых вариантов" not in readme:
    section = '''
## PBR-текстуры цветовых вариантов

Существующий цветовой вариант может дополнительно переключать PBR-карты поверхности. `swatch` остаётся обязательным цветом кнопки внешнего интерфейса; отдельная категория `materials` не создаётся.

```js
{
  id: 'samsala-dark-gray',
  label: 'Samsala, тёмно-серый',
  swatch: '#625f5a',
  isDefault: false,
  isBase: false,
  materialNames: ['Upholstery'],
  surface: {
    baseColorTextureUrl: '/textures/samsala/base-color.webp',
    normalTextureUrl: '/textures/samsala/normal.webp',
    metallicRoughnessTextureUrl: '/textures/samsala/metallic-roughness.webp',
    occlusionTextureUrl: '/textures/samsala/occlusion.webp',
    repeat: [4, 4],
    baseColorFactor: '#ffffff',
  },
}
```

`metallicRoughnessTextureUrl` использует упаковку glTF: roughness хранится в зелёном канале, metalness — в синем. `baseColorFactor` умножается на base-color map и по умолчанию равен `#ffffff`. Модель должна иметь UV-развёртку; отдельный GLB для каждой ткани не нужен. Конфигурации без `surface` полностью совместимы и продолжают менять только сплошной цвет.

В основном Three.js-просмотрщике карты могут добавляться к любому `MeshStandardMaterial`. При AR-синхронизации model-viewer заменяет только те texture slots, которые доступны через его публичный scene-graph API; для гарантированного переноса конкретной карты в AR соответствующий slot должен существовать в исходном GLB. Внешние Scene Viewer и Quick Look могут дополнительно ограничивать перенос runtime-изменений.

'''
    readme = replace_once(readme, '\n## Публичные методы\n', '\n' + section + '## Публичные методы\n', "README surface section")
write("README.md", readme)

ar_docs = read("docs/ar-device-verification.md")
if "PBR-карт" not in ar_docs:
    ar_docs = ar_docs.replace(
        '4. Выводить в отдельный журнал результаты `launchAR()`, все восемь публичных событий и полные снимки `getState()`.',
        '4. Выводить в отдельный журнал результаты `launchAR()`, все восемь публичных событий и полные снимки `getState()`. Для цветового варианта с PBR-картами отдельно проверить перенос base color, normal и metallic-roughness; публичный model-viewer API может заменить только существующий в исходном GLB texture slot.',
        1,
    )
write("docs/ar-device-verification.md", ar_docs)

# validation-report is written only after the workflow completes every verification command.
print('Surface texture implementation prepared.')
