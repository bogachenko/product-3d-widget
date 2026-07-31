import { normalizeProductConfiguration, type NormalizedProductConfiguration } from './configuration.js';
import { ThreeViewer, type ViewerInitializationResult, type ViewerRecoveryResult } from './three-viewer.js';
import { ModelViewerArAdapter } from './ar-adapter.js';

export interface ClipSource {
  readonly kind: 'clip';
  readonly clipName: string;
}

export interface RangeSource {
  readonly kind: 'range';
  readonly clipName: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface ColorVariantConfig {
  readonly id: string;
  readonly label: string;
  readonly swatch: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly materialNames: readonly string[];
}

export interface StructuralVariantConfig {
  readonly id: string;
  readonly label: string;
  readonly isDefault: boolean;
  readonly isBase: boolean;
  readonly visibleNodeNames: readonly string[];
  readonly hiddenNodeNames: readonly string[];
}

export interface AnimationConfig {
  readonly id: string;
  readonly label: string;
  readonly source: ClipSource | RangeSource;
  readonly compatibleVariantIds: readonly string[];
}

export interface ScenarioStepConfig {
  readonly id: string;
  readonly description: string;
  readonly animationId: string;
}

export interface ScenarioConfig {
  readonly id: string;
  readonly label: string;
  readonly steps: readonly ScenarioStepConfig[];
}

export interface ProductConfiguration {
  readonly productId: string;
  readonly glbUrl: string;
  readonly usdzUrl?: string;
  readonly colors?: readonly ColorVariantConfig[];
  readonly variants?: readonly StructuralVariantConfig[];
  readonly animations?: readonly AnimationConfig[];
  readonly scenarios?: readonly ScenarioConfig[];
  readonly ar?: Readonly<{ enabled: boolean }>;
}

export type LifecycleState =
  | 'STATE-NOT-CONFIGURED'
  | 'STATE-LOADING-CONFIGURATION'
  | 'STATE-LOADING-MODEL'
  | 'STATE-READY'
  | 'STATE-ANIMATION-PLAYING'
  | 'STATE-SCENARIO-ACTIVE'
  | 'STATE-AR-ACTIVE'
  | 'STATE-ERROR'
  | 'STATE-DISCONNECTED';

export interface ConfirmedSelection {
  readonly colorId: string | null;
  readonly variantId: string | null;
}

export interface AvailabilityState {
  readonly canConfigure: boolean;
  readonly canSelectColor: boolean;
  readonly canSelectVariant: boolean;
  readonly canPlayAnimation: boolean;
  readonly canStartScenario: boolean;
  readonly canGoBack: boolean;
  readonly canGoNext: boolean;
  readonly canStopScenario: boolean;
  readonly canLaunchAR: boolean;
}

export interface CapabilityState {
  readonly colors: readonly Readonly<{ id: string; label: string }>[];
  readonly variants: readonly Readonly<{ id: string; label: string }>[];
  readonly animations: readonly Readonly<{ id: string; label: string; compatibleVariantIds: readonly string[] }>[];
  readonly scenarios: readonly Readonly<{ id: string; label: string; compatibleVariantIds: readonly string[] }>[];
  readonly arConfigured: boolean;
  readonly localErrors: readonly WidgetError[];
}

export type WidgetErrorCode =
  | 'CONFIGURATION_INVALID'
  | 'COLOR_DISABLED'
  | 'VARIANT_DISABLED'
  | 'ANIMATION_DISABLED'
  | 'SCENARIO_DISABLED'
  | 'USDZ_UNUSABLE'
  | 'WEBGL2_UNAVAILABLE'
  | 'PRIMARY_GLB_FAILED'
  | 'VIEWER_INITIALIZATION_FAILED'
  | 'VIEWER_OPERATION_FAILED'
  | 'WEBGL_RECOVERY_FAILED'
  | 'AR_INITIALIZATION_FAILED'
  | 'AR_SYNC_FAILED'
  | 'AR_REQUEST_FAILED';

export interface WidgetError {
  readonly code: WidgetErrorCode;
  readonly scope: 'blocking' | 'color' | 'variant' | 'animation' | 'scenario' | 'ar';
  readonly message: string;
  readonly entityId?: string;
}

export interface Product3DWidgetState {
  readonly lifecycle: LifecycleState;
  readonly productId: string | null;
  readonly selection: ConfirmedSelection;
  readonly animation: Readonly<{ id: string | null; status: 'idle' | 'playing' }>;
  readonly scenario: Readonly<{
    id: string | null;
    stepIndex: number | null;
    status: 'idle' | 'playing' | 'holding-final-frame';
    canGoBack: boolean;
    canGoNext: boolean;
  }>;
  readonly availability: AvailabilityState;
  readonly capabilities: CapabilityState;
  readonly ar: Readonly<{ available: boolean; webxrActive: boolean }>;
  readonly error: WidgetError | null;
}

export type CommandRejectionReason =
  | 'disconnected'
  | 'not-ready'
  | 'terminal-error'
  | 'already-configured'
  | 'unknown-color'
  | 'unknown-variant'
  | 'unknown-animation'
  | 'unknown-scenario'
  | 'scenario-active'
  | 'no-active-scenario'
  | 'scenario-boundary'
  | 'incompatible-variant'
  | 'incompatible-animation'
  | 'incompatible-scenario'
  | 'ar-not-configured'
  | 'ar-unavailable'
  | 'user-activation-required';

export type CommandResult =
  | Readonly<{
      accepted: false;
      outcome: 'rejected';
      reason: CommandRejectionReason;
      state: Product3DWidgetState;
      compatibleVariantIds?: readonly string[];
    }>
  | Readonly<{ accepted: true; outcome: 'completed'; state: Product3DWidgetState }>
  | Readonly<{ accepted: true; outcome: 'initiated'; state: Product3DWidgetState }>
  | Readonly<{ accepted: true; outcome: 'failed'; error: WidgetError; state: Product3DWidgetState }>;

export type InitializationResult =
  | Readonly<{ accepted: true; outcome: 'ready'; state: Product3DWidgetState }>
  | Readonly<{
      accepted: false;
      outcome: 'rejected';
      errors: readonly WidgetError[];
      state: Product3DWidgetState;
      reason?: 'disconnected' | 'already-configured' | 'terminal-error';
    }>
  | Readonly<{ accepted: true; outcome: 'failed'; error: WidgetError; state: Product3DWidgetState }>;

export type WidgetEventName =
  | 'product-3d-state-change'
  | 'product-3d-selection-change'
  | 'product-3d-animation-change'
  | 'product-3d-scenario-change'
  | 'product-3d-ar-availability-change'
  | 'product-3d-ar-launched'
  | 'product-3d-ar-returned'
  | 'product-3d-error';

type SpecializedWidgetEventName = Exclude<WidgetEventName, 'product-3d-state-change' | 'product-3d-error'>;

const EMPTY_CAPABILITIES: CapabilityState = Object.freeze({
  colors: Object.freeze([]),
  variants: Object.freeze([]),
  animations: Object.freeze([]),
  scenarios: Object.freeze([]),
  arConfigured: false,
  localErrors: Object.freeze([]),
});

const EMPTY_AVAILABILITY: AvailabilityState = Object.freeze({
  canConfigure: false,
  canSelectColor: false,
  canSelectVariant: false,
  canPlayAnimation: false,
  canStartScenario: false,
  canGoBack: false,
  canGoNext: false,
  canStopScenario: false,
  canLaunchAR: false,
});

const freezeSnapshot = (state: Product3DWidgetState): Product3DWidgetState => Object.freeze({
  ...state,
  selection: Object.freeze({ ...state.selection }),
  animation: Object.freeze({ ...state.animation }),
  scenario: Object.freeze({ ...state.scenario }),
  availability: Object.freeze({ ...state.availability }),
  capabilities: Object.freeze({
    ...state.capabilities,
    colors: Object.freeze(state.capabilities.colors.map((item) => Object.freeze({ ...item }))),
    variants: Object.freeze(state.capabilities.variants.map((item) => Object.freeze({ ...item }))),
    animations: Object.freeze(state.capabilities.animations.map((item) => Object.freeze({
      ...item,
      compatibleVariantIds: Object.freeze([...item.compatibleVariantIds]),
    }))),
    scenarios: Object.freeze(state.capabilities.scenarios.map((item) => Object.freeze({
      ...item,
      compatibleVariantIds: Object.freeze([...item.compatibleVariantIds]),
    }))),
    localErrors: Object.freeze(state.capabilities.localErrors.map((item) => Object.freeze({ ...item }))),
  }),
  ar: Object.freeze({ ...state.ar }),
  error: state.error === null ? null : Object.freeze({ ...state.error }),
});

const INITIAL_STATE: Product3DWidgetState = freezeSnapshot({
  lifecycle: 'STATE-NOT-CONFIGURED',
  productId: null,
  selection: Object.freeze({ colorId: null, variantId: null }),
  animation: Object.freeze({ id: null, status: 'idle' }),
  scenario: Object.freeze({
    id: null,
    stepIndex: null,
    status: 'idle',
    canGoBack: false,
    canGoNext: false,
  }),
  availability: EMPTY_AVAILABILITY,
  capabilities: EMPTY_CAPABILITIES,
  ar: Object.freeze({ available: false, webxrActive: false }),
  error: null,
});

// <SEMANTIC_BLOCK id="CFC-CLASS-PRODUCT-3D-WIDGET">
// <INTENT>Own the confirmed public state, host API, host events and leaf lifecycles.</INTENT>
// <LINKS><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-CONFIGURE"/><REQUIREMENT ref="FR-INSTANCE-SINGLE-PRODUCT"/><BUSINESS_PROCESS ref="BP-PRODUCT-INITIALIZATION"/></LINKS>
export class Product3DWidget extends HTMLElement {
  readonly #viewerHost: HTMLDivElement;
  readonly #loadingSurface: HTMLDivElement;
  readonly #errorSurface: HTMLDivElement;
  readonly #arHost: HTMLDivElement;

  #state: Product3DWidgetState = INITIAL_STATE;
  #configuration: NormalizedProductConfiguration | null = null;
  #viewer: ThreeViewer | null = null;
  #arAdapter: ModelViewerArAdapter | null = null;
  #cycle = 0;
  #terminalPrimaryGlbFailure = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host {
          display: block;
          position: relative;
          aspect-ratio: var(--product-3d-aspect-ratio, 4 / 3);
          min-width: 0;
          min-height: 0;
          contain: layout paint;
        }
        [part="viewer"], [part="loading"], [part="error"] {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          box-sizing: border-box;
        }
        [part="viewer"] { overflow: hidden; }
        [part="loading"], [part="error"] {
          display: grid;
          place-items: center;
          padding: 1rem;
          color: currentColor;
          font: inherit;
          text-align: center;
        }
        [hidden] { display: none !important; }
        .ar-host {
          position: absolute;
          width: 0;
          height: 0;
          overflow: hidden;
        }
      </style>
      <div part="viewer"></div>
      <div part="loading" role="status" aria-live="polite" hidden>Loading 3D product…</div>
      <div part="error" role="alert" hidden></div>
      <div class="ar-host" aria-hidden="true"></div>
    `;
    this.#viewerHost = root.querySelector('[part="viewer"]') as HTMLDivElement;
    this.#loadingSurface = root.querySelector('[part="loading"]') as HTMLDivElement;
    this.#errorSurface = root.querySelector('[part="error"]') as HTMLDivElement;
    this.#arHost = root.querySelector('.ar-host') as HTMLDivElement;
  }

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-CONNECTED">
  // <INTENT>Start a fresh initialization cycle when connected and a configuration has already been accepted for this instance.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-AVAILABILITY-STATES"/><BUSINESS_PROCESS ref="BP-PRODUCT-INITIALIZATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-CONNECTED"/></LINKS>
  protected connectedCallback(): void {
    if (this.#terminalPrimaryGlbFailure) {
      this.#commitAndNotify({ ...this.#state, lifecycle: 'STATE-ERROR' });
      return;
    }
    if (this.#configuration === null) {
      this.#commitAndNotify({
        ...INITIAL_STATE,
        lifecycle: 'STATE-NOT-CONFIGURED',
        availability: { ...EMPTY_AVAILABILITY, canConfigure: true },
      });
      return;
    }
    void this.#initializeCycle().catch((cause: unknown) => {
      const error: WidgetError = Object.freeze({
        code: 'VIEWER_INITIALIZATION_FAILED',
        scope: 'blocking',
        message: `Viewer initialization failed unexpectedly: ${cause instanceof Error ? cause.message : String(cause)}`,
      });
      const state = this.#commitAndNotify({ ...this.#state, lifecycle: 'STATE-ERROR', error });
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state, error }),
        bubbles: true,
        composed: true,
      }));
    });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-DISCONNECTED">
  // <INTENT>Synchronously prohibit new work and initiate idempotent cleanup of every owned runtime resource.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-DISCONNECT-CLEANUP"/><BUSINESS_PROCESS ref="BP-LOAD-AND-FAILURE-HANDLING"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-DISCONNECTED"/></LINKS>
  protected disconnectedCallback(): void {
    this.#cycle += 1;
    const viewer = this.#viewer;
    const arAdapter = this.#arAdapter;
    this.#viewer = null;
    this.#arAdapter = null;
    try { viewer?.dispose(); } catch { /* cleanup remains best-effort */ }
    try { arAdapter?.dispose(); } catch { /* cleanup remains best-effort */ }
    this.#viewerHost.replaceChildren();
    this.#arHost.replaceChildren();
    this.#commitAndNotify({
      ...this.#state,
      lifecycle: 'STATE-DISCONNECTED',
      selection: { colorId: null, variantId: null },
      animation: { id: null, status: 'idle' },
      scenario: { id: null, stepIndex: null, status: 'idle', canGoBack: false, canGoNext: false },
      ar: { available: false, webxrActive: false },
      error: this.#state.error,
    });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-CONFIGURE">
  // <INTENT>Validate and, only after mandatory validation succeeds, accept the single product assignment and initialize its primary viewer.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-INSTANCE-SINGLE-PRODUCT"/><BUSINESS_PROCESS ref="BP-PRODUCT-INITIALIZATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-CONFIGURE"/></LINKS>
  async configure(config: ProductConfiguration): Promise<InitializationResult> {
    if (!this.isConnected) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'disconnected',
        errors: Object.freeze([]),
        state: this.#state,
      });
    }
    if (this.#terminalPrimaryGlbFailure) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'terminal-error',
        errors: Object.freeze([]),
        state: this.#state,
      });
    }
    if (this.#configuration !== null) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'already-configured',
        errors: Object.freeze([]),
        state: this.#state,
      });
    }

    this.#commitAndNotify({ ...INITIAL_STATE, lifecycle: 'STATE-LOADING-CONFIGURATION' });
    const validation = normalizeProductConfiguration(config);
    if (!validation.ok) {
      const blocking = validation.errors[0] ?? Object.freeze({
        code: 'CONFIGURATION_INVALID' as const,
        scope: 'blocking' as const,
        message: 'Product configuration is invalid.',
      });
      const state = this.#commitAndNotify({ ...INITIAL_STATE, lifecycle: 'STATE-ERROR', error: blocking });
      for (const error of validation.errors) {
        this.dispatchEvent(new CustomEvent('product-3d-error', {
          detail: Object.freeze({ state, error }),
          bubbles: true,
          composed: true,
        }));
      }
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        errors: validation.errors,
        state,
      });
    }

    this.#configuration = validation.configuration;
    return this.#initializeCycle();
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-GET-STATE">
  // <INTENT>Return the last confirmed deeply readonly snapshot without triggering work.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-HOST-STATE-OBSERVABILITY"/><BUSINESS_PROCESS ref="BP-PRODUCT-INITIALIZATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-GET-STATE"/></LINKS>
  getState(): Product3DWidgetState {
    return this.#state;
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-SELECT-COLOR">
  // <INTENT>Apply an enabled color while preserving structural selection and any allowed running regular animation.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-CURRENT-SELECTION-PRESERVATION"/><BUSINESS_PROCESS ref="BP-PRODUCT-EXPLORATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-SELECT-COLOR"/></LINKS>
  async selectColor(colorId: string): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle === 'STATE-SCENARIO-ACTIVE') return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'scenario-active', state: this.#state });
    if (!['STATE-READY', 'STATE-ANIMATION-PLAYING'].includes(this.#state.lifecycle) || this.#viewer === null) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });
    if (!this.#state.capabilities.colors.some((item) => item.id === colorId)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'unknown-color', state: this.#state });

    const result = await this.#viewer.applyColor(colorId);
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      selection: { ...this.#state.selection, colorId },
    }, 'product-3d-selection-change');
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-SELECT-VARIANT">
  // <INTENT>Apply an enabled structural variant only when current operation compatibility permits it.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-SCENARIO-LOCK-PRODUCT-SELECTION"/><BUSINESS_PROCESS ref="BP-PRODUCT-EXPLORATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-SELECT-VARIANT"/></LINKS>
  async selectVariant(variantId: string): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle === 'STATE-SCENARIO-ACTIVE') return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'scenario-active', state: this.#state });
    if (!['STATE-READY', 'STATE-ANIMATION-PLAYING'].includes(this.#state.lifecycle) || this.#viewer === null) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });
    if (!this.#state.capabilities.variants.some((item) => item.id === variantId)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'unknown-variant', state: this.#state });

    if (this.#state.animation.id !== null) {
      const active = this.#state.capabilities.animations.find((item) => item.id === this.#state.animation.id);
      if (active !== undefined && !active.compatibleVariantIds.includes(variantId)) {
        return Object.freeze({
          accepted: false,
          outcome: 'rejected',
          reason: 'incompatible-variant',
          compatibleVariantIds: active.compatibleVariantIds,
          state: this.#state,
        });
      }
    }

    const result = await this.#viewer.applyVariant(variantId);
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      selection: { ...this.#state.selection, variantId },
    }, 'product-3d-selection-change');
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-PLAY-ANIMATION">
  // <INTENT>Start or atomically replace a regular animation after full compatibility validation.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-ANIMATION-INTERRUPTION"/><BUSINESS_PROCESS ref="BP-ANIMATION-PLAYBACK"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-PLAY-ANIMATION"/></LINKS>
  async playAnimation(animationId: string): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle === 'STATE-SCENARIO-ACTIVE') return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'scenario-active', state: this.#state });
    if (this.#viewer === null || !['STATE-READY', 'STATE-ANIMATION-PLAYING'].includes(this.#state.lifecycle)) {
      return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });
    }
    const animation = this.#state.capabilities.animations.find((item) => item.id === animationId);
    if (animation === undefined) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'unknown-animation', state: this.#state });
    if (this.#state.selection.variantId === null || !animation.compatibleVariantIds.includes(this.#state.selection.variantId)) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'incompatible-animation',
        compatibleVariantIds: animation.compatibleVariantIds,
        state: this.#state,
      });
    }

    const priorLifecycle = this.#state.lifecycle;
    const result = await this.#viewer.playAnimation(animationId);
    if (!result.ok) {
      const state = priorLifecycle === 'STATE-ANIMATION-PLAYING'
        ? this.#commitAndNotify({
            ...this.#state,
            lifecycle: 'STATE-READY',
            animation: { id: null, status: 'idle' },
          }, 'product-3d-animation-change')
        : this.#state;
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      lifecycle: 'STATE-ANIMATION-PLAYING',
      animation: { id: animationId, status: 'playing' },
      scenario: { id: null, stepIndex: null, status: 'idle', canGoBack: false, canGoNext: false },
    }, 'product-3d-animation-change');
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-START-SCENARIO">
  // <INTENT>Start, replace or restart a scenario atomically only after complete prevalidation.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-SCENARIO-START-STOPS-ANIMATION"/><BUSINESS_PROCESS ref="BP-SCENARIO-EXECUTION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-START-SCENARIO"/></LINKS>
  async startScenario(scenarioId: string): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#viewer === null || !['STATE-READY', 'STATE-ANIMATION-PLAYING', 'STATE-SCENARIO-ACTIVE'].includes(this.#state.lifecycle)) {
      return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });
    }
    const scenario = this.#state.capabilities.scenarios.find((item) => item.id === scenarioId);
    if (scenario === undefined) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'unknown-scenario', state: this.#state });
    if (this.#state.selection.variantId === null || !scenario.compatibleVariantIds.includes(this.#state.selection.variantId)) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'incompatible-scenario',
        compatibleVariantIds: scenario.compatibleVariantIds,
        state: this.#state,
      });
    }

    const priorLifecycle = this.#state.lifecycle;
    const mode = priorLifecycle === 'STATE-SCENARIO-ACTIVE'
      ? (this.#state.scenario.id === scenarioId ? 'restart' : 'replace')
      : 'start';
    const result = await this.#viewer.startScenario(scenarioId, mode);
    if (!result.ok) {
      const state = this.#commitAndNotify({
        ...this.#state,
        lifecycle: 'STATE-READY',
        animation: { id: null, status: 'idle' },
        scenario: { id: null, stepIndex: null, status: 'idle', canGoBack: false, canGoNext: false },
      }, 'product-3d-scenario-change');
      if (priorLifecycle === 'STATE-ANIMATION-PLAYING') {
        this.dispatchEvent(new CustomEvent('product-3d-animation-change', {
          detail: state,
          bubbles: true,
          composed: true,
        }));
      }
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      lifecycle: 'STATE-SCENARIO-ACTIVE',
      animation: { id: null, status: 'idle' },
      scenario: {
        id: scenarioId,
        stepIndex: result.stepIndex,
        status: 'playing',
        canGoBack: result.canGoBack,
        canGoNext: result.canGoNext,
      },
    }, 'product-3d-scenario-change');
    if (priorLifecycle === 'STATE-ANIMATION-PLAYING') {
      this.dispatchEvent(new CustomEvent('product-3d-animation-change', {
        detail: state,
        bubbles: true,
        composed: true,
      }));
    }
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-PREVIOUS-STEP">
  // <INTENT>Move to and replay the previous scenario step while preserving camera and selection.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-PUBLIC-CONTROL-METHODS"/><BUSINESS_PROCESS ref="BP-SCENARIO-EXECUTION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-PREVIOUS-STEP"/></LINKS>
  async previousScenarioStep(): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle !== 'STATE-SCENARIO-ACTIVE' || this.#viewer === null) {
      return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'no-active-scenario', state: this.#state });
    }
    if (!this.#state.scenario.canGoBack) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'scenario-boundary', state: this.#state });
    const result = await this.#viewer.goToScenarioStep('back');
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      scenario: {
        id: result.scenarioId,
        stepIndex: result.stepIndex,
        status: 'playing',
        canGoBack: result.canGoBack,
        canGoNext: result.canGoNext,
      },
    }, 'product-3d-scenario-change');
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-NEXT-STEP">
  // <INTENT>Move to and replay the next scenario step while preserving camera and selection.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-PUBLIC-CONTROL-METHODS"/><BUSINESS_PROCESS ref="BP-SCENARIO-EXECUTION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-NEXT-STEP"/></LINKS>
  async nextScenarioStep(): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle !== 'STATE-SCENARIO-ACTIVE' || this.#viewer === null) {
      return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'no-active-scenario', state: this.#state });
    }
    if (!this.#state.scenario.canGoNext) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'scenario-boundary', state: this.#state });
    const result = await this.#viewer.goToScenarioStep('next');
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      scenario: {
        id: result.scenarioId,
        stepIndex: result.stepIndex,
        status: 'playing',
        canGoBack: result.canGoBack,
        canGoNext: result.canGoNext,
      },
    }, 'product-3d-scenario-change');
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-STOP-SCENARIO">
  // <INTENT>Stop the active scenario and restore ordinary base pose with confirmed selection and camera.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-PUBLIC-CONTROL-METHODS"/><BUSINESS_PROCESS ref="BP-SCENARIO-EXECUTION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-STOP-SCENARIO"/></LINKS>
  async stopScenario(): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle !== 'STATE-SCENARIO-ACTIVE' || this.#viewer === null) {
      return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'no-active-scenario', state: this.#state });
    }
    const result = await this.#viewer.stopScenario();
    if (!result.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });
    }
    const state = this.#commitAndNotify({
      ...this.#state,
      lifecycle: 'STATE-READY',
      scenario: { id: null, stepIndex: null, status: 'idle', canGoBack: false, canGoNext: false },
    }, 'product-3d-scenario-change');
    return Object.freeze({ accepted: true, outcome: 'completed', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-LAUNCH-AR">
  // <INTENT>Initiate one mode-neutral AR request from a valid user activation without inferring the selected channel.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-SCENARIO-LOCK-AR"/><BUSINESS_PROCESS ref="BP-AR-PLACEMENT"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-LAUNCH-AR"/></LINKS>
  async launchAR(): Promise<CommandResult> {
    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });
    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });
    if (this.#state.lifecycle === 'STATE-SCENARIO-ACTIVE') return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'scenario-active', state: this.#state });
    if (!['STATE-READY', 'STATE-ANIMATION-PLAYING'].includes(this.#state.lifecycle)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });
    if (!this.#state.capabilities.arConfigured) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'ar-not-configured', state: this.#state });
    if (!this.#state.ar.available || this.#arAdapter === null || this.#viewer === null) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'ar-unavailable', state: this.#state });
    const activation = navigator.userActivation;
    if (activation !== undefined && !activation.isActive) {
      return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'user-activation-required', state: this.#state });
    }

    if (this.#state.lifecycle === 'STATE-ANIMATION-PLAYING') {
      const stopped = await this.#viewer.stopAnimationAndReset('ar');
      if (!stopped.ok) {
        this.dispatchEvent(new CustomEvent('product-3d-error', {
          detail: Object.freeze({ state: this.#state, error: stopped.error }),
          bubbles: true,
          composed: true,
        }));
        return Object.freeze({ accepted: true, outcome: 'failed', error: stopped.error, state: this.#state });
      }
      this.#commitAndNotify({
        ...this.#state,
        lifecycle: 'STATE-READY',
        animation: { id: null, status: 'idle' },
      }, 'product-3d-animation-change');
    }

    const synced = await this.#arAdapter.syncSelection(this.#state.selection);
    if (!synced.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: synced.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: synced.error, state: this.#state });
    }
    const launched = await this.#arAdapter.launch();
    if (!launched.ok) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state: this.#state, error: launched.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: launched.error, state: this.#state });
    }
    return Object.freeze({ accepted: true, outcome: 'initiated', state: this.#state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-INITIALIZE-CYCLE">
  // <INTENT>Run the minimum sequence normalize configuration → initialize viewer → initialize optional AR adapter for the current connection cycle.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-COMMAND-ACCEPTANCE-SEMANTICS"/><BUSINESS_PROCESS ref="BP-PRODUCT-INITIALIZATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-INITIALIZE-CYCLE"/></LINKS>
  async #initializeCycle(): Promise<InitializationResult> {
    const config = this.#configuration;
    if (config === null || !this.isConnected) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'disconnected',
        errors: Object.freeze([]),
        state: this.#state,
      });
    }
    if (this.#terminalPrimaryGlbFailure) {
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'terminal-error',
        errors: Object.freeze([]),
        state: this.#state,
      });
    }

    const cycle = ++this.#cycle;
    this.#viewer?.dispose();
    this.#arAdapter?.dispose();
    this.#viewer = null;
    this.#arAdapter = null;
    this.#viewerHost.replaceChildren();
    this.#arHost.replaceChildren();
    this.#commitAndNotify({
      ...INITIAL_STATE,
      lifecycle: 'STATE-LOADING-MODEL',
      productId: config.productId,
      selection: config.initialSelection,
      capabilities: {
        ...EMPTY_CAPABILITIES,
        arConfigured: config.arEnabled,
        localErrors: config.localErrors,
      },
    });

    const viewer = new ThreeViewer(this.#viewerHost, {
      onAnimationCompleted: (animationId: string): void => {
        if (cycle !== this.#cycle || this.#state.animation.id !== animationId) return;
        this.#commitAndNotify({
          ...this.#state,
          lifecycle: 'STATE-READY',
          animation: { id: null, status: 'idle' },
        }, 'product-3d-animation-change');
      },
      onScenarioStepCompleted: (scenarioId: string, stepIndex: number): void => {
        if (cycle !== this.#cycle || this.#state.scenario.id !== scenarioId || this.#state.scenario.stepIndex !== stepIndex) return;
        this.#commitAndNotify({
          ...this.#state,
          scenario: { ...this.#state.scenario, status: 'holding-final-frame' },
        }, 'product-3d-scenario-change');
      },
      onRecoveryResult: (result: ViewerRecoveryResult): void => {
        if (cycle !== this.#cycle || result.ok) return;
        const state = this.#commitAndNotify({ ...this.#state, lifecycle: 'STATE-ERROR', error: result.error });
        this.dispatchEvent(new CustomEvent('product-3d-error', {
          detail: Object.freeze({ state, error: result.error }),
          bubbles: true,
          composed: true,
        }));
      },
    });
    this.#viewer = viewer;
    const result: ViewerInitializationResult = await viewer.initialize(config, config.initialSelection);
    if (cycle !== this.#cycle || !this.isConnected) {
      viewer.dispose();
      return Object.freeze({
        accepted: false,
        outcome: 'rejected',
        reason: 'disconnected',
        errors: Object.freeze([]),
        state: this.#state,
      });
    }
    if (!result.ok) {
      viewer.dispose();
      this.#viewer = null;
      this.#terminalPrimaryGlbFailure = result.terminal;
      const state = this.#commitAndNotify({ ...this.#state, lifecycle: 'STATE-ERROR', error: result.error });
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state, error: result.error }),
        bubbles: true,
        composed: true,
      }));
      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state });
    }

    const enabledColors = new Set(result.enabledColorIds);
    const enabledVariants = new Set(result.enabledVariantIds);
    const enabledAnimations = new Set(result.enabledAnimationIds);
    const enabledScenarios = new Set(result.enabledScenarioIds);
    const localErrors: WidgetError[] = [...config.localErrors, ...result.localErrors];
    let arAvailable = false;

    if (config.arEnabled) {
      const adapter = new ModelViewerArAdapter(this.#arHost, {
        onAvailabilityChange: (available: boolean): void => {
          if (cycle !== this.#cycle || this.#arAdapter !== adapter || this.#state.ar.available === available) return;
          this.#commitAndNotify({
            ...this.#state,
            ar: { ...this.#state.ar, available },
          }, 'product-3d-ar-availability-change');
        },
        onWebXRStart: (): void => {
          if (cycle !== this.#cycle || this.#arAdapter !== adapter || this.#state.ar.webxrActive) return;
          this.#commitAndNotify({
            ...this.#state,
            lifecycle: 'STATE-AR-ACTIVE',
            ar: { ...this.#state.ar, webxrActive: true },
          }, 'product-3d-ar-launched');
        },
        onWebXREnd: (): void => {
          if (cycle !== this.#cycle || this.#arAdapter !== adapter || !this.#state.ar.webxrActive) return;
          this.#commitAndNotify({
            ...this.#state,
            lifecycle: 'STATE-READY',
            ar: { ...this.#state.ar, webxrActive: false },
          }, 'product-3d-ar-returned');
        },
        onError: (error: WidgetError): void => {
          if (cycle !== this.#cycle || this.#arAdapter !== adapter) return;
          this.dispatchEvent(new CustomEvent('product-3d-error', {
            detail: Object.freeze({ state: this.#state, error }),
            bubbles: true,
            composed: true,
          }));
        },
      });
      const arResult = await adapter.initialize(config);
      if (cycle !== this.#cycle || !this.isConnected) {
        adapter.dispose();
        viewer.dispose();
        return Object.freeze({
          accepted: false,
          outcome: 'rejected',
          reason: 'disconnected',
          errors: Object.freeze([]),
          state: this.#state,
        });
      }
      if (arResult.ok) {
        this.#arAdapter = adapter;
        arAvailable = arResult.available;
        localErrors.push(...arResult.localErrors);
      } else {
        adapter.dispose();
        const errors = Object.freeze([...localErrors, arResult.error]);
        const capabilities: CapabilityState = {
          colors: [...config.colorsById.values()].filter((item) => enabledColors.has(item.id)).map(({ id, label }) => ({ id, label })),
          variants: [...config.variantsById.values()].filter((item) => enabledVariants.has(item.id)).map(({ id, label }) => ({ id, label })),
          animations: [...config.animationsById.values()].filter((item) => enabledAnimations.has(item.id)).map((item) => ({ id: item.id, label: item.label, compatibleVariantIds: [...item.compatibleVariantIds].filter((id) => enabledVariants.has(id)) })),
          scenarios: [...config.scenariosById.values()].filter((item) => enabledScenarios.has(item.id)).map((item) => ({ id: item.id, label: item.label, compatibleVariantIds: [...item.compatibleVariantIds].filter((id) => enabledVariants.has(id)) })),
          arConfigured: true,
          localErrors: errors,
        };
        const state = this.#commitAndNotify({
          ...this.#state,
          lifecycle: 'STATE-READY',
          selection: result.selection,
          capabilities,
          ar: { available: false, webxrActive: false },
          error: null,
        });
        for (const error of errors) {
          this.dispatchEvent(new CustomEvent('product-3d-error', {
            detail: Object.freeze({ state, error }),
            bubbles: true,
            composed: true,
          }));
        }
        return Object.freeze({ accepted: true, outcome: 'ready', state });
      }
    }

    const capabilities: CapabilityState = {
      colors: [...config.colorsById.values()].filter((item) => enabledColors.has(item.id)).map(({ id, label }) => ({ id, label })),
      variants: [...config.variantsById.values()].filter((item) => enabledVariants.has(item.id)).map(({ id, label }) => ({ id, label })),
      animations: [...config.animationsById.values()].filter((item) => enabledAnimations.has(item.id)).map((item) => ({
        id: item.id,
        label: item.label,
        compatibleVariantIds: [...item.compatibleVariantIds].filter((id) => enabledVariants.has(id)),
      })),
      scenarios: [...config.scenariosById.values()].filter((item) => enabledScenarios.has(item.id)).map((item) => ({
        id: item.id,
        label: item.label,
        compatibleVariantIds: [...item.compatibleVariantIds].filter((id) => enabledVariants.has(id)),
      })),
      arConfigured: config.arEnabled,
      localErrors,
    };
    const state = this.#commitAndNotify({
      ...this.#state,
      lifecycle: 'STATE-READY',
      selection: result.selection,
      capabilities,
      ar: { available: arAvailable, webxrActive: false },
      error: null,
    });
    for (const error of localErrors) {
      this.dispatchEvent(new CustomEvent('product-3d-error', {
        detail: Object.freeze({ state, error }),
        bubbles: true,
        composed: true,
      }));
    }
    return Object.freeze({ accepted: true, outcome: 'ready', state });
  }
  // </SEMANTIC_BLOCK>

  // <SEMANTIC_BLOCK id="CFC-FN-WIDGET-COMMIT-NOTIFY">
  // <INTENT>Atomically replace the confirmed snapshot and enforce general-event → specialized-event ordering.</INTENT>
  // <LINKS><REQUIREMENT ref="FR-HOST-STATE-EVENTS"/><BUSINESS_PROCESS ref="BP-PRODUCT-INITIALIZATION"/><MODULE ref="MOD-WIDGET-CONTROLLER"/><MODULE_CONTRACT ref="CONTRACT-MOD-WIDGET-CONTROLLER"/><FUNCTION_CONTRACT ref="CFC-FN-WIDGET-COMMIT-NOTIFY"/></LINKS>
  #commitAndNotify(next: Product3DWidgetState, specializedEvent?: SpecializedWidgetEventName): Product3DWidgetState {
    const ordinary = next.lifecycle === 'STATE-READY' || next.lifecycle === 'STATE-ANIMATION-PLAYING';
    const scenarioActive = next.lifecycle === 'STATE-SCENARIO-ACTIVE';
    const variantId = next.selection.variantId;
    const activeAnimation = next.animation.id === null
      ? undefined
      : next.capabilities.animations.find((item) => item.id === next.animation.id);
    const canSelectVariant = ordinary && next.capabilities.variants.some((item) =>
      activeAnimation === undefined || activeAnimation.compatibleVariantIds.includes(item.id));
    const canPlayAnimation = ordinary && variantId !== null
      && next.capabilities.animations.some((item) => item.compatibleVariantIds.includes(variantId));
    const canStartScenario = (ordinary || scenarioActive) && variantId !== null
      && next.capabilities.scenarios.some((item) => item.compatibleVariantIds.includes(variantId));
    const availability: AvailabilityState = {
      canConfigure: this.isConnected && this.#configuration === null && !this.#terminalPrimaryGlbFailure,
      canSelectColor: ordinary && next.capabilities.colors.length > 0,
      canSelectVariant,
      canPlayAnimation,
      canStartScenario,
      canGoBack: scenarioActive && next.scenario.canGoBack,
      canGoNext: scenarioActive && next.scenario.canGoNext,
      canStopScenario: scenarioActive,
      canLaunchAR: ordinary && next.capabilities.arConfigured && next.ar.available,
    };
    const state = freezeSnapshot({ ...next, availability });
    this.#state = state;
    const loading = state.lifecycle === 'STATE-LOADING-CONFIGURATION' || state.lifecycle === 'STATE-LOADING-MODEL';
    this.#loadingSurface.hidden = !loading;
    this.#errorSurface.hidden = state.error === null;
    this.#errorSurface.textContent = state.error?.message ?? '';
    this.dispatchEvent(new CustomEvent('product-3d-state-change', {
      detail: state,
      bubbles: true,
      composed: true,
    }));
    if (specializedEvent !== undefined) {
      this.dispatchEvent(new CustomEvent(specializedEvent, {
        detail: state,
        bubbles: true,
        composed: true,
      }));
    }
    return state;
  }
  // </SEMANTIC_BLOCK>
}
// </SEMANTIC_BLOCK>

if (!customElements.get('product-3d-widget')) {
  customElements.define('product-3d-widget', Product3DWidget);
}

declare global {
  interface HTMLElementTagNameMap {
    'product-3d-widget': Product3DWidget;
  }
}
