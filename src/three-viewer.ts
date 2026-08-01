import {
  ACESFilmicToneMapping,
  AnimationAction,
  AnimationClip,
  AnimationMixer,
  Box3,
  Color,
  DirectionalLight,
  HemisphereLight,
  LoopOnce,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Quaternion,
  Scene,
  Sphere,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type {
  CameraFocusOptions,
  CameraTransitionOptions,
  ConfirmedSelection,
  WidgetError,
} from './product-3d-widget.js';
import type {
  NormalizedAnimation,
  NormalizedProductConfiguration,
  NormalizedScenario,
} from './configuration.js';

export type ViewerInitializationResult =
  | Readonly<{
      ok: true;
      selection: ConfirmedSelection;
      enabledColorIds: readonly string[];
      enabledVariantIds: readonly string[];
      enabledAnimationIds: readonly string[];
      enabledScenarioIds: readonly string[];
      enabledCameraViewIds: readonly string[];
      localErrors: readonly WidgetError[];
    }>
  | Readonly<{ ok: false; terminal: boolean; error: WidgetError }>;

export type ViewerOperationResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: WidgetError }>;
export type ViewerPlaybackResult =
  | Readonly<{ ok: true; animationId: string; status: 'started' }>
  | Readonly<{ ok: false; error: WidgetError }>;
export type ViewerScenarioResult =
  | Readonly<{
      ok: true;
      scenarioId: string;
      stepIndex: number;
      status: 'playing';
      canGoBack: boolean;
      canGoNext: boolean;
    }>
  | Readonly<{ ok: false; error: WidgetError }>;
export type ViewerCameraResult =
  | Readonly<{ ok: true; outcome: 'completed' | 'cancelled' }>
  | Readonly<{ ok: false; rejected: true; reason: 'unknown-camera-view' | 'unknown-node' | 'invalid-camera-target' | 'no-camera-view-to-restore' | 'camera-transition-active' }>
  | Readonly<{ ok: false; rejected: false; error: WidgetError }>;
export type ViewerRecoveryResult = Readonly<{ ok: true }> | Readonly<{ ok: false; error: WidgetError }>;

type ViewerCallbacks = Readonly<{
  onAnimationCompleted(animationId: string): void;
  onScenarioStepCompleted(scenarioId: string, stepIndex: number): void;
  onRecoveryResult(result: ViewerRecoveryResult): void;
}>;

type TransformSnapshot = Readonly<{
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
  morphTargetInfluences: readonly number[] | null;
}>;

type CameraSnapshot = Readonly<{
  position: Vector3;
  quaternion: Quaternion;
  target: Vector3;
}>;

type CameraTransition = {
  fromPosition: Vector3;
  fromTarget: Vector3;
  toPosition: Vector3;
  toTarget: Vector3;
  startTime: number;
  durationMs: number;
  resolve(result: Extract<ViewerCameraResult, { ok: true }>): void;
};

type Playback = {
  kind: 'animation' | 'scenario';
  animationId: string;
  scenarioId: string | null;
  stepIndex: number | null;
  action: AnimationAction;
  startSeconds: number;
  endSeconds: number;
};

const viewerError = (
  code: WidgetError['code'],
  message: string,
  entityId?: string,
): WidgetError => Object.freeze(entityId === undefined
  ? { code, scope: 'blocking' as const, message }
  : { code, scope: code === 'VIEWER_OPERATION_FAILED' ? 'animation' as const : 'blocking' as const, message, entityId });

const localError = (
  code: WidgetError['code'],
  scope: WidgetError['scope'],
  message: string,
  entityId: string,
): WidgetError => Object.freeze({ code, scope, message, entityId });

const animationTimeTolerance = (duration: number): number =>
  Math.max(1e-6, Math.abs(duration) * 1e-7);

const cameraDuration = (value: unknown, fallback = 700): number | null => {
  const duration = value === undefined ? fallback : value;
  return typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 60_000
    ? duration
    : null;
};

const cameraPadding = (value: unknown): number | null => {
  const padding = value === undefined ? 1.25 : value;
  return typeof padding === 'number' && Number.isFinite(padding) && padding >= 1 && padding <= 10
    ? padding
    : null;
};

// <SEMANTIC_BLOCK id="CFC-CLASS-THREE-VIEWER">
// <INTENT>Own exactly one Three.js viewer and all of its resources.</INTENT>
// <LINKS><MODULE ref="MOD-THREE-VIEWER"/><MODULE_CONTRACT ref="CONTRACT-MOD-THREE-VIEWER"/><FUNCTION_CONTRACT ref="CFC-FN-VIEWER-INITIALIZE"/></LINKS>
export class ThreeViewer {
  readonly #container: HTMLElement;
  readonly #callbacks: ViewerCallbacks;

  #config: NormalizedProductConfiguration | null = null;
  #renderer: WebGLRenderer | null = null;
  #scene: Scene | null = null;
  #camera: PerspectiveCamera | null = null;
  #controls: OrbitControls | null = null;
  #gltf: GLTF | null = null;
  #root: Object3D | null = null;
  #keyLight: DirectionalLight | null = null;
  #fillLight: DirectionalLight | null = null;
  #mixer: AnimationMixer | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #rafId: number | null = null;
  #cameraRafId: number | null = null;
  #cameraTransition: CameraTransition | null = null;
  #savedCameraView: CameraSnapshot | null = null;
  #lastFrameTime = 0;
  #playback: Playback | null = null;
  #disposed = false;
  #contextRecoveryAttempted = false;
  #currentSelection: ConfirmedSelection = Object.freeze({ colorId: null, variantId: null });

  readonly #nodesByName = new Map<string, Object3D>();
  readonly #materialsByName = new Map<string, MeshStandardMaterial[]>();
  readonly #baseTransforms = new Map<Object3D, TransformSnapshot>();
  readonly #ordinaryTransforms = new Map<Object3D, TransformSnapshot>();
  readonly #baseVisibility = new Map<Object3D, boolean>();
  readonly #baseMaterialColors = new Map<MeshStandardMaterial, Color>();
  readonly #clipsByName = new Map<string, AnimationClip>();
  readonly #enabledColors = new Set<string>();
  readonly #enabledVariants = new Set<string>();
  readonly #enabledAnimations = new Set<string>();
  readonly #enabledScenarios = new Set<string>();
  readonly #enabledCameraViews = new Set<string>();

  readonly #handleControlsChange = (): void => {
    this.#render();
    if (this.#controls?.enableDamping === true) this.#scheduleFrame();
  };
  readonly #handleContextLost = (event: Event): void => {
    event.preventDefault();
    void this.#recoverContext();
  };

  constructor(container: HTMLElement, callbacks: ViewerCallbacks) {
    this.#container = container;
    this.#callbacks = callbacks;
  }

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-INITIALIZE">
  async initialize(
    config: NormalizedProductConfiguration,
    selection: ConfirmedSelection,
  ): Promise<ViewerInitializationResult> {
    if (this.#disposed || this.#renderer !== null) {
      return Object.freeze({
        ok: false,
        terminal: false,
        error: viewerError('VIEWER_INITIALIZATION_FAILED', 'The 3D viewer cannot be initialized in its current lifecycle.'),
      });
    }
    this.#config = config;
    this.#currentSelection = Object.freeze({ ...selection });
    return this.#initializeResources(null);
  }
  // </SEMANTIC_BLOCK>

  async #initializeResources(cameraSnapshot: CameraSnapshot | null): Promise<ViewerInitializationResult> {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', 'Interactive 3D product view');
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    const context = canvas.getContext('webgl2', {
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    if (context === null) {
      return Object.freeze({
        ok: false,
        terminal: false,
        error: viewerError('WEBGL2_UNAVAILABLE', 'WebGL 2 is unavailable. The 3D product view cannot be displayed.'),
      });
    }

    try {
      const renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = SRGBColorSpace;
      renderer.toneMapping = ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      this.#renderer = renderer;
      this.#container.append(canvas);
      canvas.addEventListener('webglcontextlost', this.#handleContextLost);

      this.#scene = new Scene();
      this.#camera = new PerspectiveCamera(42, 4 / 3, 0.01, 10_000);
      this.#camera.position.set(0, 0, 3);
      this.#controls = new OrbitControls(this.#camera, canvas);
      this.#controls.enableDamping = true;
      this.#controls.dampingFactor = 0.08;
      this.#controls.enablePan = true;
      this.#controls.screenSpacePanning = true;
      this.#controls.addEventListener('change', this.#handleControlsChange);

      this.#scene.add(new HemisphereLight(0xffffff, 0x555555, 2.2));
      this.#keyLight = new DirectionalLight(0xffffff, 3);
      this.#scene.add(this.#keyLight, this.#keyLight.target);

      this.#fillLight = new DirectionalLight(0xffffff, 1.5);
      this.#scene.add(this.#fillLight, this.#fillLight.target);
    } catch (cause) {
      this.#releaseResources();
      return Object.freeze({
        ok: false,
        terminal: false,
        error: viewerError(
          'VIEWER_INITIALIZATION_FAILED',
          `The 3D viewer could not initialize: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      });
    }

    try {
      const loader = new GLTFLoader();
      this.#gltf = await loader.loadAsync(this.#config!.glbUrl);
      if (this.#disposed) throw new Error('Viewer disposed during GLB loading.');
    } catch (cause) {
      this.#releaseResources();
      return Object.freeze({
        ok: false,
        terminal: true,
        error: viewerError(
          'PRIMARY_GLB_FAILED',
          `The primary GLB model could not be loaded: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      });
    }

    try {
      this.#root = this.#gltf.scene;
      this.#scene!.add(this.#root);
      this.#mixer = new AnimationMixer(this.#root);
      this.#indexModel();
      const result = this.#validateModelBoundCapabilities();
      this.#captureOrdinaryPose();
      this.#currentSelection = result.selection;
      this.#restoreOrdinaryTransforms();
      this.#applySelectionDirect();
      const modelBounds = this.#configureModelPresentation();

      this.#resizeObserver = new ResizeObserver(() => this.resize());
      this.#resizeObserver.observe(this.#container);
      this.resize();
      this.#frameModel(cameraSnapshot, modelBounds);
      this.#render();
      return result;
    } catch (cause) {
      this.#releaseResources();
      return Object.freeze({
        ok: false,
        terminal: false,
        error: viewerError(
          'VIEWER_INITIALIZATION_FAILED',
          `The loaded 3D model could not initialize: ${cause instanceof Error ? cause.message : String(cause)}`,
        ),
      });
    }
  }

  #indexModel(): void {
    this.#nodesByName.clear();
    this.#materialsByName.clear();
    this.#baseTransforms.clear();
    this.#ordinaryTransforms.clear();
    this.#baseVisibility.clear();
    this.#baseMaterialColors.clear();
    this.#clipsByName.clear();

    this.#root!.traverse((object) => {
      if (object.name) this.#nodesByName.set(object.name, object);
      const morphTargetInfluences = object instanceof Mesh && object.morphTargetInfluences !== undefined
        ? Object.freeze([...object.morphTargetInfluences])
        : null;
      this.#baseTransforms.set(object, Object.freeze({
        position: object.position.clone(),
        quaternion: object.quaternion.clone(),
        scale: object.scale.clone(),
        morphTargetInfluences,
      }));
      this.#baseVisibility.set(object, object.visible);
      if (object instanceof Mesh) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (!(material instanceof MeshStandardMaterial)) continue;
          const name = material.name;
          if (!this.#materialsByName.has(name)) this.#materialsByName.set(name, []);
          this.#materialsByName.get(name)!.push(material);
          if (!this.#baseMaterialColors.has(material)) this.#baseMaterialColors.set(material, material.color.clone());
        }
      }
    });
    for (const clip of this.#gltf!.animations) this.#clipsByName.set(clip.name, clip);
  }

  #configureModelPresentation(): Box3 {
    const box = new Box3().setFromObject(this.#root!);
    const center = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const extent = Math.max(size.x, size.y, size.z, 0.1);

    if (this.#keyLight !== null) {
      this.#keyLight.position.set(
        center.x + extent * 1.8,
        center.y + extent * 2.5,
        center.z + extent * 2,
      );
      this.#keyLight.target.position.copy(center);
    }

    if (this.#fillLight !== null) {
      this.#fillLight.position.set(
        center.x - extent * 1.7,
        center.y + extent * 1.1,
        center.z - extent * 1.3,
      );
      this.#fillLight.target.position.copy(center);
    }

    return box;
  }

  #validateModelBoundCapabilities(): Extract<ViewerInitializationResult, { ok: true }> {
    const localErrors: WidgetError[] = [];
    this.#enabledColors.clear();
    this.#enabledVariants.clear();
    this.#enabledAnimations.clear();
    this.#enabledScenarios.clear();
    this.#enabledCameraViews.clear();

    for (const color of this.#config!.colorsById.values()) {
      if (color.isBase || color.materialNames.every((name) => this.#materialsByName.has(name))) {
        this.#enabledColors.add(color.id);
      } else {
        localErrors.push(localError('COLOR_DISABLED', 'color', `Color "${color.id}" references a missing material.`, color.id));
      }
    }
    const defaultColor = [...this.#config!.colorsById.values()].find((color) => color.isDefault)?.id ?? null;
    if (defaultColor !== null && !this.#enabledColors.has(defaultColor)) {
      this.#enabledColors.clear();
      localErrors.push(localError('COLOR_DISABLED', 'color', 'The color group default is unavailable in the loaded model.', defaultColor));
    }

    for (const variant of this.#config!.variantsById.values()) {
      const names = [...variant.visibleNodeNames, ...variant.hiddenNodeNames];
      if (variant.isBase || names.every((name) => this.#nodesByName.has(name))) {
        this.#enabledVariants.add(variant.id);
      } else {
        localErrors.push(localError('VARIANT_DISABLED', 'variant', `Structural variant "${variant.id}" references a missing node.`, variant.id));
      }
    }
    const defaultVariant = [...this.#config!.variantsById.values()].find((variant) => variant.isDefault)?.id ?? null;
    if (defaultVariant !== null && !this.#enabledVariants.has(defaultVariant)) {
      this.#enabledVariants.clear();
      localErrors.push(localError('VARIANT_DISABLED', 'variant', 'The structural variant group default is unavailable in the loaded model.', defaultVariant));
    }

    for (const animation of this.#config!.animationsById.values()) {
      const clip = this.#clipsByName.get(animation.source.clipName);
      const rangeValid = animation.source.kind === 'clip'
        || (clip !== undefined
          && animation.source.endSeconds <= clip.duration + animationTimeTolerance(clip.duration));
      const hasCompatibleVariant = [...animation.compatibleVariantIds].some((id) => this.#enabledVariants.has(id));
      if (clip !== undefined && rangeValid && hasCompatibleVariant) {
        this.#enabledAnimations.add(animation.id);
      } else {
        localErrors.push(localError('ANIMATION_DISABLED', 'animation', `Animation "${animation.id}" is unavailable in the loaded model.`, animation.id));
      }
    }

    const restPose = this.#config!.restPose;
    if (restPose !== null && !this.#enabledAnimations.has(restPose.animationId)) {
      localErrors.push(localError(
        'REST_POSE_DISABLED',
        'animation',
        `restPose animation "${restPose.animationId}" is unavailable in the loaded model; the GLB base pose is used.`,
        restPose.animationId,
      ));
    }

    for (const view of this.#config!.cameraViewsById.values()) {
      if (this.#nodesByName.has(view.positionNodeName) && this.#nodesByName.has(view.targetNodeName)) {
        this.#enabledCameraViews.add(view.id);
      } else {
        localErrors.push(localError('CAMERA_VIEW_DISABLED', 'camera', `Camera view "${view.id}" references a missing node.`, view.id));
      }
    }

    for (const scenario of this.#config!.scenariosById.values()) {
      const allAnimationsEnabled = scenario.steps.every((step) => this.#enabledAnimations.has(step.animationId));
      const allCameraViewsEnabled = scenario.steps.every((step) =>
        step.cameraViewId === undefined || this.#enabledCameraViews.has(step.cameraViewId));
      const hasCompatibleVariant = [...scenario.compatibleVariantIds].some((id) => this.#enabledVariants.has(id));
      if (allAnimationsEnabled && allCameraViewsEnabled && hasCompatibleVariant) {
        this.#enabledScenarios.add(scenario.id);
      } else {
        localErrors.push(localError('SCENARIO_DISABLED', 'scenario', `Scenario "${scenario.id}" is unavailable in the loaded model.`, scenario.id));
      }
    }

    const selection = Object.freeze({
      colorId: this.#currentSelection.colorId !== null && this.#enabledColors.has(this.#currentSelection.colorId)
        ? this.#currentSelection.colorId
        : null,
      variantId: this.#currentSelection.variantId !== null && this.#enabledVariants.has(this.#currentSelection.variantId)
        ? this.#currentSelection.variantId
        : null,
    });
    return Object.freeze({
      ok: true,
      selection,
      enabledColorIds: Object.freeze([...this.#enabledColors]),
      enabledVariantIds: Object.freeze([...this.#enabledVariants]),
      enabledAnimationIds: Object.freeze([...this.#enabledAnimations]),
      enabledScenarioIds: Object.freeze([...this.#enabledScenarios]),
      enabledCameraViewIds: Object.freeze([...this.#enabledCameraViews]),
      localErrors: Object.freeze(localErrors),
    });
  }

  #frameModel(snapshot: CameraSnapshot | null, box: Box3): void {
    if (snapshot !== null) {
      this.#camera!.position.copy(snapshot.position);
      this.#camera!.quaternion.copy(snapshot.quaternion);
      this.#controls!.target.copy(snapshot.target);
      this.#controls!.update();
      return;
    }

    const center = box.getCenter(new Vector3());
    const sphere = box.getBoundingSphere(new Sphere());
    const radius = Math.max(sphere.radius, 0.1);
    const verticalFov = this.#camera!.fov * Math.PI / 180;
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.#camera!.aspect);
    const limitingFov = Math.max(Math.min(verticalFov, horizontalFov), 0.1);
    const distance = radius / Math.sin(limitingFov / 2) * 1.12;
    const direction = new Vector3(1.15, 0.72, 1.35).normalize();

    this.#camera!.near = Math.max(radius / 100, 0.001);
    this.#camera!.far = Math.max(distance + radius * 12, 100);
    this.#camera!.position.copy(center).addScaledVector(direction, distance);
    this.#controls!.target.copy(center);
    this.#controls!.minDistance = radius * 0.35;
    this.#controls!.maxDistance = radius * 12;
    this.#camera!.updateProjectionMatrix();
    this.#controls!.update();
  }

  #captureCamera(): CameraSnapshot {
    return Object.freeze({
      position: this.#camera!.position.clone(),
      quaternion: this.#camera!.quaternion.clone(),
      target: this.#controls!.target.clone(),
    });
  }

  #restoreCamera(snapshot: CameraSnapshot): void {
    this.#camera!.position.copy(snapshot.position);
    this.#camera!.quaternion.copy(snapshot.quaternion);
    this.#controls!.target.copy(snapshot.target);
    this.#controls!.update();
  }

  #captureTransforms(target: Map<Object3D, TransformSnapshot>): void {
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

  #restoreBasePose(): void {
    this.#mixer?.stopAllAction();
    this.#restoreTransforms(this.#baseTransforms);
  }

  #applySelectionDirect(): void {
    for (const [object, visible] of this.#baseVisibility) object.visible = visible;
    const variant = this.#currentSelection.variantId === null
      ? undefined
      : this.#config!.variantsById.get(this.#currentSelection.variantId);
    if (variant !== undefined && !variant.isBase) {
      for (const name of variant.visibleNodeNames) this.#nodesByName.get(name)!.visible = true;
      for (const name of variant.hiddenNodeNames) this.#nodesByName.get(name)!.visible = false;
    }

    for (const [material, color] of this.#baseMaterialColors) material.color.copy(color);
    const color = this.#currentSelection.colorId === null
      ? undefined
      : this.#config!.colorsById.get(this.#currentSelection.colorId);
    if (color !== undefined && !color.isBase) {
      for (const name of color.materialNames) {
        for (const material of this.#materialsByName.get(name) ?? []) material.color.setStyle(color.swatch);
      }
    }
  }

  #cameraRejected(reason: Extract<ViewerCameraResult, { ok: false; rejected: true }>['reason']): ViewerCameraResult {
    return Object.freeze({ ok: false, rejected: true, reason });
  }

  #cameraFailed(cause: unknown): ViewerCameraResult {
    return Object.freeze({
      ok: false,
      rejected: false,
      error: Object.freeze({
        code: 'VIEWER_OPERATION_FAILED',
        scope: 'camera',
        message: `The camera operation failed: ${cause instanceof Error ? cause.message : String(cause)}.`,
      }),
    });
  }

  #completeCameraTransition(outcome: 'completed' | 'cancelled'): void {
    const transition = this.#cameraTransition;
    if (transition === null) return;
    this.#cameraTransition = null;
    if (this.#cameraRafId !== null) cancelAnimationFrame(this.#cameraRafId);
    this.#cameraRafId = null;
    if (this.#controls !== null) this.#controls.enabled = true;
    transition.resolve(Object.freeze({ ok: true, outcome }));
  }

  readonly #tickCameraTransition = (now: number): void => {
    this.#cameraRafId = null;
    const transition = this.#cameraTransition;
    if (transition === null || this.#camera === null || this.#controls === null || this.#disposed) return;
    const linear = transition.durationMs === 0 ? 1 : Math.min(Math.max((now - transition.startTime) / transition.durationMs, 0), 1);
    const progress = 1 - Math.pow(1 - linear, 3);
    this.#camera.position.lerpVectors(transition.fromPosition, transition.toPosition, progress);
    this.#controls.target.lerpVectors(transition.fromTarget, transition.toTarget, progress);
    this.#camera.lookAt(this.#controls.target);
    this.#controls.update();
    this.#render();
    if (linear >= 1) {
      this.#completeCameraTransition('completed');
      return;
    }
    this.#cameraRafId = requestAnimationFrame(this.#tickCameraTransition);
  };

  #transitionCamera(position: Vector3, target: Vector3, durationMs: number, remember: boolean): Promise<ViewerCameraResult> {
    if (this.#cameraTransition !== null) return Promise.resolve(this.#cameraRejected('camera-transition-active'));
    if (this.#camera === null || this.#controls === null) return Promise.resolve(this.#cameraFailed(new Error('Camera is unavailable')));
    if (remember && this.#savedCameraView === null) this.#savedCameraView = this.#captureCamera();
    if (durationMs === 0) {
      this.#camera.position.copy(position);
      this.#controls.target.copy(target);
      this.#camera.lookAt(target);
      this.#controls.update();
      this.#render();
      return Promise.resolve(Object.freeze({ ok: true, outcome: 'completed' }));
    }
    this.#controls.enabled = false;
    return new Promise((resolve) => {
      this.#cameraTransition = {
        fromPosition: this.#camera!.position.clone(),
        fromTarget: this.#controls!.target.clone(),
        toPosition: position.clone(),
        toTarget: target.clone(),
        startTime: performance.now(),
        durationMs,
        resolve,
      };
      this.#cameraRafId = requestAnimationFrame(this.#tickCameraTransition);
    });
  }

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-SET-CAMERA-VIEW">
  async setCameraView(viewId: string): Promise<ViewerCameraResult> {
    if (this.#cameraTransition !== null) return this.#cameraRejected('camera-transition-active');
    const view = this.#config?.cameraViewsById.get(viewId);
    if (view === undefined || !this.#enabledCameraViews.has(viewId)) return this.#cameraRejected('unknown-camera-view');
    try {
      this.#root!.updateMatrixWorld(true);
      const position = this.#nodesByName.get(view.positionNodeName)!.getWorldPosition(new Vector3());
      const target = this.#nodesByName.get(view.targetNodeName)!.getWorldPosition(new Vector3());
      return await this.#transitionCamera(position, target, view.durationMs, true);
    } catch (cause) {
      return this.#cameraFailed(cause);
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-FOCUS-NODES">
  async focusOnNodes(nodeNames: readonly string[], options?: CameraFocusOptions): Promise<ViewerCameraResult> {
    if (this.#cameraTransition !== null) return this.#cameraRejected('camera-transition-active');
    const durationMs = cameraDuration(options?.durationMs);
    const padding = cameraPadding(options?.padding);
    const distance = options?.distance;
    const positionNodeName = options?.positionNodeName;
    if (!Array.isArray(nodeNames)
      || nodeNames.length === 0
      || nodeNames.some((name) => typeof name !== 'string' || name.trim().length === 0)
      || durationMs === null
      || padding === null
      || (distance !== undefined && (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0))
      || (positionNodeName !== undefined && (typeof positionNodeName !== 'string' || positionNodeName.trim().length === 0))) {
      return this.#cameraRejected('invalid-camera-target');
    }
    const names = [...new Set(nodeNames.map((name) => name.trim()))];
    if (names.some((name) => !this.#nodesByName.has(name))) return this.#cameraRejected('unknown-node');
    if (positionNodeName !== undefined && !this.#nodesByName.has(positionNodeName.trim())) return this.#cameraRejected('unknown-node');
    try {
      this.#root!.updateMatrixWorld(true);
      const bounds = new Box3().makeEmpty();
      for (const name of names) {
        const node = this.#nodesByName.get(name)!;
        const nodeBounds = new Box3().setFromObject(node);
        if (nodeBounds.isEmpty()) bounds.expandByPoint(node.getWorldPosition(new Vector3()));
        else bounds.union(nodeBounds);
      }
      if (bounds.isEmpty()) return this.#cameraRejected('invalid-camera-target');
      const target = bounds.getCenter(new Vector3());
      let position: Vector3;
      if (positionNodeName !== undefined) {
        position = this.#nodesByName.get(positionNodeName.trim())!.getWorldPosition(new Vector3());
      } else {
        const sphere = bounds.getBoundingSphere(new Sphere());
        const radius = Math.max(sphere.radius, 0.01);
        const verticalFov = this.#camera!.fov * Math.PI / 180;
        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.#camera!.aspect);
        const limitingFov = Math.max(Math.min(verticalFov, horizontalFov), 0.1);
        const currentDistance = Math.max(this.#camera!.position.distanceTo(this.#controls!.target), 0.1);
        const targetDistance = distance ?? Math.max(radius / Math.sin(limitingFov / 2) * padding, sphere.radius <= 0.01 ? currentDistance * 0.35 : 0.05);
        const direction = this.#camera!.position.clone().sub(this.#controls!.target);
        if (direction.lengthSq() < 1e-12) direction.set(1.15, 0.72, 1.35);
        position = target.clone().addScaledVector(direction.normalize(), targetDistance);
      }
      const targetDistance = Math.max(position.distanceTo(target), 0.01);
      this.#controls!.minDistance = Math.min(this.#controls!.minDistance, targetDistance * 0.1);
      this.#camera!.near = Math.max(Math.min(this.#camera!.near, targetDistance / 100), 0.001);
      this.#camera!.far = Math.max(this.#camera!.far, targetDistance * 100);
      this.#camera!.updateProjectionMatrix();
      return await this.#transitionCamera(position, target, durationMs, true);
    } catch (cause) {
      return this.#cameraFailed(cause);
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-RESTORE-CAMERA-VIEW">
  async restoreCameraView(options?: CameraTransitionOptions): Promise<ViewerCameraResult> {
    if (this.#cameraTransition !== null) return this.#cameraRejected('camera-transition-active');
    if (this.#savedCameraView === null) return this.#cameraRejected('no-camera-view-to-restore');
    const durationMs = cameraDuration(options?.durationMs);
    if (durationMs === null) return this.#cameraRejected('invalid-camera-target');
    const snapshot = this.#savedCameraView;
    const result = await this.#transitionCamera(snapshot.position, snapshot.target, durationMs, false);
    if (result.ok && result.outcome === 'completed') this.#savedCameraView = null;
    return result;
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-CANCEL-CAMERA-TRANSITION">
  cancelCameraTransition(): ViewerOperationResult {
    try {
      this.#completeCameraTransition('cancelled');
      return Object.freeze({ ok: true });
    } catch (cause) {
      return this.#operationFailure('camera', 'active-camera-transition', cause);
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-APPLY-COLOR">
  async applyColor(colorId: string): Promise<ViewerOperationResult> {
    if (!this.#enabledColors.has(colorId)) return this.#operationFailure('color', colorId);
    const previous = this.#currentSelection;
    try {
      this.#currentSelection = Object.freeze({ colorId, variantId: previous.variantId });
      this.#applySelectionDirect();
      this.#render();
      return Object.freeze({ ok: true });
    } catch (cause) {
      this.#currentSelection = previous;
      this.#applySelectionDirect();
      return this.#operationFailure('color', colorId, cause);
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-APPLY-VARIANT">
  async applyVariant(variantId: string): Promise<ViewerOperationResult> {
    if (!this.#enabledVariants.has(variantId)) return this.#operationFailure('variant', variantId);
    const previous = this.#currentSelection;
    try {
      this.#currentSelection = Object.freeze({ colorId: previous.colorId, variantId });
      this.#applySelectionDirect();
      this.#render();
      return Object.freeze({ ok: true });
    } catch (cause) {
      this.#currentSelection = previous;
      this.#applySelectionDirect();
      return this.#operationFailure('variant', variantId, cause);
    }
  }
  // </SEMANTIC_BLOCK>

  #operationFailure(scope: WidgetError['scope'], entityId: string, cause?: unknown): Extract<ViewerOperationResult, { ok: false }> {
    const suffix = cause instanceof Error ? `: ${cause.message}` : '';
    return Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'VIEWER_OPERATION_FAILED' as const,
        scope,
        message: `The viewer operation for "${entityId}" failed${suffix}.`,
        entityId,
      }),
    });
  }

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-PLAY-ANIMATION">
  async playAnimation(animationId: string): Promise<ViewerPlaybackResult> {
    const animation = this.#config?.animationsById.get(animationId);
    if (animation === undefined || !this.#enabledAnimations.has(animationId)) {
      return Object.freeze({ ok: false, error: this.#operationFailure('animation', animationId).error });
    }
    try {
      await this.stopAnimationAndReset('replacement');
      this.#startPlayback(animation, 'animation', null, null);
      return Object.freeze({ ok: true, animationId, status: 'started' });
    } catch (cause) {
      this.#restoreOrdinaryPose();
      return Object.freeze({ ok: false, error: this.#operationFailure('animation', animationId, cause).error });
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-STOP-ANIMATION">
  async stopAnimationAndReset(_reason: 'replacement' | 'scenario' | 'ar' | 'cleanup'): Promise<ViewerOperationResult> {
    if (this.#playback?.kind !== 'animation') return Object.freeze({ ok: true });
    try {
      this.#restoreOrdinaryPose();
      return Object.freeze({ ok: true });
    } catch (cause) {
      return this.#operationFailure('animation', this.#playback?.animationId ?? 'active-animation', cause);
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-START-SCENARIO">
  async startScenario(
    scenarioId: string,
    _mode: 'start' | 'replace' | 'restart',
  ): Promise<ViewerScenarioResult> {
    const scenario = this.#config?.scenariosById.get(scenarioId);
    if (scenario === undefined || !this.#enabledScenarios.has(scenarioId)) {
      return Object.freeze({ ok: false, error: this.#operationFailure('scenario', scenarioId).error });
    }
    try {
      this.#restoreOrdinaryPose();
      return await this.#startScenarioStep(scenario, 0);
    } catch (cause) {
      this.#restoreOrdinaryPose();
      return Object.freeze({ ok: false, error: this.#operationFailure('scenario', scenarioId, cause).error });
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-GO-SCENARIO-STEP">
  async goToScenarioStep(direction: 'back' | 'next'): Promise<ViewerScenarioResult> {
    const playback = this.#playback;
    if (playback?.kind !== 'scenario' || playback.scenarioId === null || playback.stepIndex === null) {
      return Object.freeze({ ok: false, error: this.#operationFailure('scenario', 'active-scenario').error });
    }
    const scenario = this.#config!.scenariosById.get(playback.scenarioId)!;
    const stepIndex = playback.stepIndex + (direction === 'back' ? -1 : 1);
    if (stepIndex < 0 || stepIndex >= scenario.steps.length) {
      return Object.freeze({ ok: false, error: this.#operationFailure('scenario', scenario.id).error });
    }
    try {
      this.#restoreOrdinaryPose();
      return await this.#startScenarioStep(scenario, stepIndex);
    } catch (cause) {
      this.#restoreOrdinaryPose();
      return Object.freeze({ ok: false, error: this.#operationFailure('scenario', scenario.id, cause).error });
    }
  }
  // </SEMANTIC_BLOCK>

  async #startScenarioStep(
    scenario: NormalizedScenario,
    stepIndex: number,
  ): Promise<Extract<ViewerScenarioResult, { ok: true }>> {
    const step = scenario.steps[stepIndex]!;
    if (step.cameraViewId !== undefined) {
      const cameraResult = await this.setCameraView(step.cameraViewId);
      if (!cameraResult.ok) throw new Error(`Camera view "${step.cameraViewId}" could not be applied.`);
    }
    const animation = this.#config!.animationsById.get(step.animationId)!;
    this.#startPlayback(animation, 'scenario', scenario.id, stepIndex);
    return Object.freeze({
      ok: true,
      scenarioId: scenario.id,
      stepIndex,
      status: 'playing',
      canGoBack: stepIndex > 0,
      canGoNext: stepIndex < scenario.steps.length - 1,
    });
  }

  #startPlayback(
    animation: NormalizedAnimation,
    kind: Playback['kind'],
    scenarioId: string | null,
    stepIndex: number | null,
  ): void {
    const clip = this.#clipsByName.get(animation.source.clipName);
    if (clip === undefined || this.#mixer === null) throw new Error('Animation clip is unavailable.');
    const action = this.#mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = kind === 'scenario';
    action.setLoop(LoopOnce, 1);
    const startSeconds = animation.source.kind === 'range' ? animation.source.startSeconds : 0;
    const configuredEndSeconds = animation.source.kind === 'range' ? animation.source.endSeconds : clip.duration;
    const endSeconds = Math.min(configuredEndSeconds, clip.duration);
    action.time = startSeconds;
    action.play();
    this.#playback = {
      kind,
      animationId: animation.id,
      scenarioId,
      stepIndex,
      action,
      startSeconds,
      endSeconds,
    };
    this.#lastFrameTime = performance.now();
    this.#scheduleFrame();
  }

  #scheduleFrame(): void {
    if (this.#rafId === null && !this.#disposed) this.#rafId = requestAnimationFrame(this.#tick);
  }

  readonly #tick = (now: number): void => {
    this.#rafId = null;
    if (this.#disposed) return;

    const controlsChanged = this.#controls?.enableDamping === true
      ? this.#controls.update()
      : false;
    const playback = this.#playback;

    if (playback?.kind === 'scenario' && playback.action.paused) {
      if (controlsChanged) {
        this.#render();
        this.#scheduleFrame();
      }
      return;
    }

    if (playback !== null && this.#mixer !== null) {
      const delta = Math.max(0, Math.min((now - this.#lastFrameTime) / 1000, 0.1));
      this.#lastFrameTime = now;
      this.#mixer.update(delta);
      if (playback.action.time >= playback.endSeconds) {
        playback.action.time = playback.endSeconds;
        this.#mixer.update(0);
        this.#render();
        if (playback.kind === 'scenario') {
          playback.action.paused = true;
          this.#callbacks.onScenarioStepCompleted(playback.scenarioId!, playback.stepIndex!);
        } else {
          const animationId = playback.animationId;
          this.#restoreOrdinaryPose();
          this.#callbacks.onAnimationCompleted(animationId);
        }
        return;
      }
      this.#render();
      this.#scheduleFrame();
      return;
    }

    if (controlsChanged) {
      this.#render();
      this.#scheduleFrame();
    }
  };

  #restoreOrdinaryPose(): void {
    if (this.#rafId !== null) cancelAnimationFrame(this.#rafId);
    this.#rafId = null;
    const camera = this.#camera !== null && this.#controls !== null ? this.#captureCamera() : null;
    this.#playback?.action.stop();
    this.#playback = null;
    this.#restoreOrdinaryTransforms();
    this.#applySelectionDirect();
    if (camera !== null) this.#restoreCamera(camera);
    this.#render();
  }

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-STOP-SCENARIO">
  async stopScenario(): Promise<ViewerOperationResult> {
    if (this.#playback?.kind !== 'scenario') return Object.freeze({ ok: true });
    try {
      this.#restoreOrdinaryPose();
      return Object.freeze({ ok: true });
    } catch (cause) {
      return this.#operationFailure('scenario', 'active-scenario', cause);
    }
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-RESIZE">
  resize(): void {
    if (this.#renderer === null || this.#camera === null) return;
    const width = this.#container.clientWidth;
    if (width <= 0) return;
    const height = this.#container.clientHeight > 0 ? this.#container.clientHeight : width * 0.75;
    this.#renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    this.#renderer.setSize(width, height, false);
    this.#camera.aspect = width / height;
    this.#camera.updateProjectionMatrix();
    this.#render();
  }
  // </SEMANTIC_BLOCK>

  #render(): void {
    if (this.#renderer !== null && this.#scene !== null && this.#camera !== null) {
      this.#renderer.render(this.#scene, this.#camera);
    }
  }

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-RECOVER-CONTEXT">
  async #recoverContext(): Promise<void> {
    if (this.#disposed) return;
    if (this.#contextRecoveryAttempted) {
      this.#disposed = true;
      this.#releaseResources();
      this.#callbacks.onRecoveryResult(Object.freeze({
        ok: false,
        error: viewerError('WEBGL_RECOVERY_FAILED', 'The WebGL context was lost again after the single recovery attempt.'),
      }));
      return;
    }
    this.#contextRecoveryAttempted = true;
    const camera = this.#camera !== null && this.#controls !== null ? this.#captureCamera() : null;
    this.#releaseResources();
    const result = await this.#initializeResources(camera);
    if (this.#disposed) return;
    if (result.ok) this.#callbacks.onRecoveryResult(Object.freeze({ ok: true }));
    else this.#callbacks.onRecoveryResult(Object.freeze({
      ok: false,
      error: Object.freeze({
        code: 'WEBGL_RECOVERY_FAILED',
        scope: 'blocking',
        message: result.error.message,
      }),
    }));
  }
  // </SEMANTIC_BLOCK>

  #releaseResources(): void {
    if (this.#rafId !== null) {
      try { cancelAnimationFrame(this.#rafId); } catch { /* cleanup continues */ }
    }
    this.#rafId = null;
    try { this.#completeCameraTransition('cancelled'); } catch { /* cleanup continues */ }
    this.#cameraRafId = null;
    this.#savedCameraView = null;
    try { this.#playback?.action.stop(); } catch { /* cleanup continues */ }
    this.#playback = null;
    try { this.#resizeObserver?.disconnect(); } catch { /* cleanup continues */ }
    this.#resizeObserver = null;
    try { this.#controls?.removeEventListener('change', this.#handleControlsChange); } catch { /* cleanup continues */ }
    try { this.#controls?.dispose(); } catch { /* cleanup continues */ }
    this.#controls = null;
    const canvas = this.#renderer?.domElement;
    if (canvas instanceof HTMLCanvasElement) {
      try { canvas.removeEventListener('webglcontextlost', this.#handleContextLost); } catch { /* cleanup continues */ }
    }

    this.#keyLight = null;
    this.#fillLight = null;

    const disposedTextures = new Set<Texture>();
    const disposedGeometries = new Set<object>();
    const disposedMaterials = new Set<Material>();
    try {
      this.#root?.traverse((object) => {
        if (!(object instanceof Mesh)) return;
        if (!disposedGeometries.has(object.geometry)) {
          disposedGeometries.add(object.geometry);
          try { object.geometry.dispose(); } catch { /* cleanup continues */ }
        }
        const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) {
          if (disposedMaterials.has(material)) continue;
          disposedMaterials.add(material);
          for (const value of Object.values(material)) {
            if (value instanceof Texture && !disposedTextures.has(value)) {
              disposedTextures.add(value);
              try { value.dispose(); } catch { /* cleanup continues */ }
            }
          }
          try { material.dispose(); } catch { /* cleanup continues */ }
        }
      });
    } catch { /* cleanup continues */ }
    try { this.#mixer?.stopAllAction(); } catch { /* cleanup continues */ }
    if (this.#root !== null) {
      try { this.#mixer?.uncacheRoot(this.#root); } catch { /* cleanup continues */ }
    }
    try { this.#renderer?.dispose(); } catch { /* cleanup continues */ }
    try { this.#renderer?.forceContextLoss(); } catch { /* cleanup continues */ }
    if (canvas instanceof HTMLElement) {
      try { canvas.remove(); } catch { /* cleanup continues */ }
    }

    this.#renderer = null;
    this.#scene = null;
    this.#camera = null;
    this.#gltf = null;
    this.#root = null;
    this.#mixer = null;
    this.#nodesByName.clear();
    this.#materialsByName.clear();
    this.#baseTransforms.clear();
    this.#ordinaryTransforms.clear();
    this.#baseVisibility.clear();
    this.#baseMaterialColors.clear();
    this.#clipsByName.clear();
    this.#enabledColors.clear();
    this.#enabledVariants.clear();
    this.#enabledAnimations.clear();
    this.#enabledScenarios.clear();
    this.#enabledCameraViews.clear();
  }

  // <SEMANTIC_BLOCK id="CFC-FN-VIEWER-DISPOSE">
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    try {
      this.#releaseResources();
    } finally {
      this.#config = null;
      this.#currentSelection = Object.freeze({ colorId: null, variantId: null });
    }
  }
  // </SEMANTIC_BLOCK>
}
// </SEMANTIC_BLOCK>
