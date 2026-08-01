from __future__ import annotations

import json
from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match in {path}, found {count}")
    file.write_text(text.replace(old, new, 1), encoding="utf-8")


def insert_before(path: str, marker: str, content: str, label: str) -> None:
    replace_once(path, marker, content + marker, label)


# RequirementsAnalysis.xml: camera commands are an explicit host API while rendering remains delegated to Three.js.
replace_once(
    "RequirementsAnalysis.xml",
    '<RESPONSIBILITY id="RESP-PUBLIC-CONTROL-API">Предоставлять публичные методы экземпляра для управления цветом, структурным вариантом, анимациями, сценариями и AR.</RESPONSIBILITY>',
    '<RESPONSIBILITY id="RESP-PUBLIC-CONTROL-API">Предоставлять публичные методы экземпляра для управления цветом, структурным вариантом, анимациями, сценариями, программными ракурсами камеры и AR.</RESPONSIBILITY>',
    "extend public control responsibility",
)
replace_once(
    "RequirementsAnalysis.xml",
    '<EXCLUSION id="EXCL-OWN-3D-ENGINE">Компонент не реализует собственный механизм 3D-рендеринга, управления камерой или воспроизведения анимаций.</EXCLUSION>',
    '<EXCLUSION id="EXCL-OWN-3D-ENGINE">Компонент не реализует собственный 3D-рендерер или независимый camera engine; отображение, OrbitControls и применение программных camera transforms выполняются через публичный API Three.js.</EXCLUSION>',
    "clarify delegated camera engine",
)
replace_once(
    "RequirementsAnalysis.xml",
    '<BUSINESS_PROCESS id="BP-PRODUCT-EXPLORATION"><DESCRIPTION>Пользователь взаимодействует с 3D-моделью непосредственно в области просмотра и вызывает через внешний интерфейс хост-страницы публичные методы выбора цвета и структурного варианта.</DESCRIPTION></BUSINESS_PROCESS>',
    '<BUSINESS_PROCESS id="BP-PRODUCT-EXPLORATION"><DESCRIPTION>Пользователь взаимодействует с 3D-моделью непосредственно в области просмотра, а хост-страница вызывает публичные методы выбора товара и программного перевода камеры к настроенному ракурсу либо одной или нескольким точкам модели.</DESCRIPTION></BUSINESS_PROCESS>',
    "extend exploration process",
)
replace_once(
    "RequirementsAnalysis.xml",
    '<ENTITY id="ENTITY-PRODUCT-CONFIGURATION"><NAME>Конфигурация товара</NAME><DESCRIPTION>Набор данных, определяющий обязательную основную GLB-модель, необязательную обычную позу из конечного кадра настроенной анимации, цвета и структурные варианты товара, анимации, пошаговые сценарии, настройки AR и необязательную отдельную USDZ-модель.</DESCRIPTION></ENTITY>',
    '<ENTITY id="ENTITY-PRODUCT-CONFIGURATION"><NAME>Конфигурация товара</NAME><DESCRIPTION>Набор данных, определяющий обязательную основную GLB-модель, необязательную обычную позу, именованные ракурсы камеры, цвета и структурные варианты товара, анимации, пошаговые сценарии, настройки AR и необязательную отдельную USDZ-модель.</DESCRIPTION></ENTITY>',
    "extend product configuration entity",
)
insert_before(
    "RequirementsAnalysis.xml",
    "    </ENTITIES>\n",
    '        <ENTITY id="ENTITY-CAMERA-VIEW"><NAME>Именованный ракурс камеры</NAME><DESCRIPTION>Необязательная конфигурационная запись, задающая идентификатор, узел позиции камеры, узел цели и длительность плавного перехода.</DESCRIPTION></ENTITY>\n'
    '        <ENTITY id="ENTITY-CAMERA-RESTORE-POSE"><NAME>Сохранённый пользовательский ракурс</NAME><DESCRIPTION>Внутренний снимок позиции камеры и цели OrbitControls, захватываемый перед первой программной сменой ракурса и доступный для явного восстановления.</DESCRIPTION></ENTITY>\n',
    "insert camera entities",
)
replace_once(
    "RequirementsAnalysis.xml",
    '<FUNCTIONAL_REQUIREMENT id="FR-PUBLIC-CONTROL-METHODS"><DESCRIPTION>product-3d-widget не должен создавать кнопки или панели управления товаром. Компонент должен предоставлять хост-странице публичную границу управления для выбора цвета и структурного варианта, запуска обычных анимаций и сценариев, навигации по шагам сценария, остановки сценария, запуска AR и получения актуального состояния. Конкретные операции, имена, входы и результаты определяются нижестоящими контрактами.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-HOST-CONTROL-API"/><USE_CASE ref="UC-HOST-PAGE-INITIALIZE-WIDGET"/></LINKS></FUNCTIONAL_REQUIREMENT>',
    '<FUNCTIONAL_REQUIREMENT id="FR-PUBLIC-CONTROL-METHODS"><DESCRIPTION>product-3d-widget не должен создавать кнопки или панели управления товаром. Компонент должен предоставлять хост-странице публичную границу управления для выбора цвета и структурного варианта, запуска обычных анимаций и сценариев, навигации по шагам сценария, остановки сценария, программного управления ракурсом камеры, запуска AR и получения актуального состояния. Конкретные операции, имена, входы и результаты определяются нижестоящими контрактами.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-HOST-CONTROL-API"/><USE_CASE ref="UC-HOST-PAGE-INITIALIZE-WIDGET"/></LINKS></FUNCTIONAL_REQUIREMENT>',
    "extend public methods requirement",
)
replace_once(
    "RequirementsAnalysis.xml",
    '<FUNCTIONAL_REQUIREMENT id="FR-NO-SEPARATE-CAMERA-CONTROLS"><DESCRIPTION>Вращение модели, масштабирование и перемещение точки обзора должны выполняться средствами 3D-просмотра. Компонент не должен создавать отдельные кнопки управления камерой.</DESCRIPTION><LINKS><USE_CASE ref="UC-END-USER-EXPLORE-PRODUCT"/></LINKS></FUNCTIONAL_REQUIREMENT>',
    '<FUNCTIONAL_REQUIREMENT id="FR-NO-SEPARATE-CAMERA-CONTROLS"><DESCRIPTION>Ручное вращение модели, масштабирование и перемещение точки обзора должны выполняться средствами 3D-просмотра. Компонент не должен создавать собственные кнопки управления камерой; хост-страница может управлять программными ракурсами через публичные методы.</DESCRIPTION><LINKS><USE_CASE ref="UC-END-USER-EXPLORE-PRODUCT"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>',
    "clarify no built-in camera buttons",
)
replace_once(
    "RequirementsAnalysis.xml",
    '<INVARIANT id="INV-CAMERA-PRESERVATION">\n            <DESCRIPTION>Операции анимации, сценария и AR-запроса сохраняют пользовательский ракурс во всех случаях, где требования прямо не предписывают иное; фактическое завершение WebXR также не сбрасывает ракурс.</DESCRIPTION>',
    '<INVARIANT id="INV-CAMERA-PRESERVATION">\n            <DESCRIPTION>Операции анимации, сценария и AR-запроса сохраняют пользовательский ракурс, если хост-страница не вызвала явную публичную camera-команду; фактическое завершение WebXR также не сбрасывает ракурс.</DESCRIPTION>',
    "make explicit camera commands an exception",
)
insert_before(
    "RequirementsAnalysis.xml",
    "    </FUNCTIONAL_REQUIREMENTS>\n",
    '        <FUNCTIONAL_REQUIREMENT id="FR-CAMERA-VIEW-CONFIGURATION"><DESCRIPTION>Хост-страница должна иметь возможность необязательно задать именованные ракурсы камеры. Каждый ракурс содержит уникальный идентификатор, имя узла позиции камеры, имя узла цели и необязательную длительность перехода. Некорректная запись или отсутствующий узел GLB должны отключать только этот ракурс.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-CAMERA-VIEW"/><ENTITY ref="ENTITY-PRODUCT-CONFIGURATION"/><ENTITY ref="ENTITY-GLB-MODEL"/></LINKS></FUNCTIONAL_REQUIREMENT>\n'
    '        <FUNCTIONAL_REQUIREMENT id="FR-CAMERA-PUBLIC-CONTROLS"><DESCRIPTION>В состояниях готовности, обычной анимации и активного сценария хост-страница должна иметь возможность перевести камеру к именованному ракурсу, сфокусировать её на одном или нескольких узлах, восстановить сохранённый пользовательский ракурс и отменить выполняющийся camera transition.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-CAMERA-VIEW"/><ENTITY ref="ENTITY-CAMERA-RESTORE-POSE"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>\n'
    '        <FUNCTIONAL_REQUIREMENT id="FR-CAMERA-MULTI-NODE-FOCUS"><DESCRIPTION>Фокусировка на нескольких узлах должна вычислять общий ограничивающий объём доступных узлов и помещать его в кадр с учётом текущего направления обзора либо явно указанного узла позиции камеры.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-GLB-MODEL"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>\n'
    '        <FUNCTIONAL_REQUIREMENT id="FR-CAMERA-RESTORE-AND-CANCEL"><DESCRIPTION>Перед первой принятой программной сменой ракурса компонент должен сохранить пользовательскую камеру. Последующие camera-команды не заменяют этот снимок до успешного restore. Отмена останавливает только текущий переход в достигнутой промежуточной позиции и сохраняет возможность последующего восстановления.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-CAMERA-RESTORE-POSE"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>\n'
    '        <FUNCTIONAL_REQUIREMENT id="FR-CAMERA-TRANSITION-ISOLATION"><DESCRIPTION>Программная смена ракурса не должна останавливать или перезапускать обычную анимацию либо сценарий и не должна изменять выбранные цвет и структурный вариант. Пока переход выполняется, другая camera-команда кроме cancel должна отклоняться без изменения подтверждённого состояния.</DESCRIPTION><LINKS><ENTITY ref="ENTITY-CURRENT-SELECTION"/><ENTITY ref="ENTITY-HOST-CONTROL-API"/></LINKS></FUNCTIONAL_REQUIREMENT>\n',
    "insert camera requirements",
)
insert_before(
    "RequirementsAnalysis.xml",
    "    </INVARIANTS>\n",
    '        <INVARIANT id="INV-CAMERA-TRANSITION-ISOLATION"><DESCRIPTION>Camera transition изменяет только viewer-owned camera и OrbitControls target; выбор товара, модельная поза, animation/scenario execution и публичный snapshot остаются неизменными.</DESCRIPTION><DERIVED_FROM><REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION"/></DERIVED_FROM></INVARIANT>\n'
    '        <INVARIANT id="INV-CAMERA-RESTORE-ORIGIN"><DESCRIPTION>До успешного restore хранится ровно один снимок ракурса, предшествовавшего первой принятой программной camera-команде.</DESCRIPTION><DERIVED_FROM><REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL"/></DERIVED_FROM></INVARIANT>\n',
    "insert camera invariants",
)

# Technology.xml: reuse Three.js and browser RAF; no dependency is added.
replace_once(
    "Technology.xml",
    '<RESPONSIBILITY>Основной встроенный 3D-просмотр: загрузка GLB, WebGLRenderer, сцена, камера, управление ракурсом, материалы и цвета, видимость узлов структурных вариантов, AnimationMixer, именованные клипы, временные диапазоны, восстановление состояния и обработка потери WebGL-контекста.</RESPONSIBILITY>',
    '<RESPONSIBILITY>Основной встроенный 3D-просмотр: загрузка GLB, WebGLRenderer, сцена, камера, OrbitControls, программные переходы к именованным ракурсам и узлам, материалы и цвета, видимость узлов структурных вариантов, AnimationMixer, именованные клипы, временные диапазоны, восстановление состояния и обработка потери WebGL-контекста.</RESPONSIBILITY>',
    "extend Three.js responsibility",
)
replace_once(
    "Technology.xml",
    '                <REQUIREMENT ref="FR-MODEL-INTERACTION"/>\n                <REQUIREMENT ref="FR-COLOR-SELECTION"/>',
    '                <REQUIREMENT ref="FR-MODEL-INTERACTION"/>\n                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS"/>\n                <REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS"/>\n                <REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL"/>\n                <REQUIREMENT ref="FR-COLOR-SELECTION"/>',
    "link camera requirements to Three.js",
)

# DevelopmentPlan.xml: keep the four-module architecture and assign camera validation/rendering to existing modules.
replace_once(
    "DevelopmentPlan.xml",
    '<RESPONSIBILITY>Владеть жизненным циклом Custom Element, подтверждённым публичным состоянием, gate публичных команд, оркестрацией операций, порядком событий и cleanup.</RESPONSIBILITY>',
    '<RESPONSIBILITY>Владеть жизненным циклом Custom Element, подтверждённым публичным состоянием, gate публичных команд, включая camera-команды, оркестрацией операций, порядком событий и cleanup.</RESPONSIBILITY>',
    "extend controller responsibility",
)
replace_once(
    "DevelopmentPlan.xml",
    '<RESPONSIBILITY>Проверять внешнюю конфигурацию, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>',
    '<RESPONSIBILITY>Проверять внешнюю конфигурацию, включая именованные camera views, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>',
    "extend configuration responsibility",
)
replace_once(
    "DevelopmentPlan.xml",
    '<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, GLB-ресурсами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>',
    '<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, OrbitControls, программными camera transitions и restore snapshot, GLB-ресурсами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>',
    "extend viewer responsibility",
)
for marker, addition, label in [
    ('                <REQUIREMENT ref="FR-PUBLIC-CONTROL-METHODS" />\n', '                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS" />\n                <REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION" />\n', 'controller camera requirement links'),
    ('                <REQUIREMENT ref="FR-CONFIGURATION-ACCEPTANCE" />\n', '                <REQUIREMENT ref="FR-CAMERA-VIEW-CONFIGURATION" />\n', 'configuration camera requirement links'),
    ('                <REQUIREMENT ref="FR-GLB-MODEL-LOADING" />\n', '                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS" />\n                <REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS" />\n                <REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL" />\n                <REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION" />\n', 'viewer camera requirement links'),
]:
    replace_once("DevelopmentPlan.xml", marker, marker + addition, label)

# ModuleContracts.xml: propagate the same responsibility through controller/configuration/viewer contracts.
replace_once(
    "ModuleContracts.xml",
    '<RESPONSIBILITY id="CONTRACT-MOD-WIDGET-CONTROLLER-RESP-04">Проверять lifecycle gate, блокировки сценария и применимость публичной команды до её принятия.</RESPONSIBILITY>',
    '<RESPONSIBILITY id="CONTRACT-MOD-WIDGET-CONTROLLER-RESP-04">Проверять lifecycle gate, блокировки сценария, camera transition gate и применимость публичной команды до её принятия.</RESPONSIBILITY>',
    "controller camera gate responsibility",
)
replace_once(
    "ModuleContracts.xml",
    '<INPUT id="MC-IN-CONTROLLER-VIEWER-RESULT" trust="TRUSTED_MODULE_RESULT">Фактически наблюдаемый результат загрузки, выбора, анимации, сценария, resize или recovery от MOD-THREE-VIEWER.</INPUT>',
    '<INPUT id="MC-IN-CONTROLLER-VIEWER-RESULT" trust="TRUSTED_MODULE_RESULT">Фактически наблюдаемый результат загрузки, выбора, camera-команды, анимации, сценария, resize или recovery от MOD-THREE-VIEWER.</INPUT>',
    "controller viewer result includes camera",
)
replace_once(
    "ModuleContracts.xml",
    '<RESPONSIBILITY id="CONTRACT-MOD-THREE-VIEWER-RESP-08">Сохранять camera view и выбор при утверждённых операциях восстановления и замены.</RESPONSIBILITY>',
    '<RESPONSIBILITY id="CONTRACT-MOD-THREE-VIEWER-RESP-08">Сохранять camera view и выбор при утверждённых операциях восстановления и замены; выполнять именованные и node-bound camera transitions с одним restore snapshot.</RESPONSIBILITY>',
    "viewer camera transition responsibility",
)
replace_once(
    "ModuleContracts.xml",
    '<INPUT id="MC-IN-VIEWER-RESIZE" trust="PLATFORM_EVENT">Фактическое изменение размера контейнера либо результат ResizeObserver.</INPUT>',
    '<INPUT id="MC-IN-VIEWER-CAMERA" trust="TRUSTED_CONTROLLER_COMMAND">Именованный camera view, список node names, focus options, restore либо cancel.</INPUT>\n                <INPUT id="MC-IN-VIEWER-RESIZE" trust="PLATFORM_EVENT">Фактическое изменение размера контейнера либо результат ResizeObserver.</INPUT>',
    "viewer camera input",
)
replace_once(
    "ModuleContracts.xml",
    '<OUTPUT id="MC-OUT-VIEWER-NAVIGATION">Фактическая доступность back/next и текущий шаг после выполненной операции.</OUTPUT>',
    '<OUTPUT id="MC-OUT-VIEWER-NAVIGATION">Фактическая доступность back/next и текущий шаг после выполненной операции.</OUTPUT>\n                <OUTPUT id="MC-OUT-VIEWER-CAMERA">Completed, cancelled, rejected или failed result camera-команды без самостоятельного изменения публичного snapshot.</OUTPUT>',
    "viewer camera output",
)
replace_once(
    "ModuleContracts.xml",
    '<STATE_ITEM>Внутренний camera snapshot для утверждённых restore-операций.</STATE_ITEM>',
    '<STATE_ITEM>Внутренний camera snapshot для model reset и отдельный единственный restore snapshot для публичных camera-команд.</STATE_ITEM>\n                    <STATE_ITEM>Не более одного активного camera transition и его requestAnimationFrame.</STATE_ITEM>',
    "viewer camera state ownership",
)
for marker, addition, label in [
    ('                <REQUIREMENT ref="FR-PUBLIC-CONTROL-METHODS" />\n', '                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS" />\n                <REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION" />\n', 'module controller camera refs'),
    ('                <REQUIREMENT ref="FR-CONFIGURATION-ACCEPTANCE" />\n', '                <REQUIREMENT ref="FR-CAMERA-VIEW-CONFIGURATION" />\n', 'module configuration camera refs'),
    ('                <REQUIREMENT ref="FR-GLB-MODEL-LOADING" />\n', '                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS" />\n                <REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS" />\n                <REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL" />\n                <REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION" />\n', 'module viewer camera refs'),
]:
    replace_once("ModuleContracts.xml", marker, marker + addition, label)

# ClassFunctionContracts.xml: define public data and five methods plus viewer operations.
replace_once(
    "ClassFunctionContracts.xml",
    '                <FIELD name="restPose" type="RestPoseConfig" required="NO">Optional ordinary pose derived from the endpoint of one configured regular animation.</FIELD>\n                <FIELD name="colors"',
    '                <FIELD name="restPose" type="RestPoseConfig" required="NO">Optional ordinary pose derived from the endpoint of one configured regular animation.</FIELD>\n                <FIELD name="cameraViews" type="readonly CameraViewConfig[]" required="NO">Optional named camera positions and targets resolved against the primary GLB.</FIELD>\n                <FIELD name="colors"',
    "product configuration cameraViews field",
)
insert_before(
    "ClassFunctionContracts.xml",
    '        <DATA_CONTRACT id="CFC-TYPE-COLOR-VARIANT-CONFIG"',
    '        <DATA_CONTRACT id="CFC-TYPE-CAMERA-VIEW-CONFIG" visibility="PUBLIC" kind="readonly interface">\n'
    '            <NAME>CameraViewConfig</NAME><FIELDS><FIELD name="id" type="string" required="YES">Unique non-empty camera view id.</FIELD><FIELD name="positionNodeName" type="string" required="YES">GLB node whose world position becomes the camera position.</FIELD><FIELD name="targetNodeName" type="string" required="YES">GLB node whose world position becomes the OrbitControls target.</FIELD><FIELD name="durationMs" type="number" required="NO">Finite transition duration from 0 through 60000; default 700.</FIELD></FIELDS>\n'
    '        </DATA_CONTRACT>\n'
    '        <DATA_CONTRACT id="CFC-TYPE-CAMERA-TRANSITION-OPTIONS" visibility="PUBLIC" kind="readonly interface"><NAME>CameraTransitionOptions</NAME><FIELDS><FIELD name="durationMs" type="number" required="NO">Finite transition duration from 0 through 60000.</FIELD></FIELDS></DATA_CONTRACT>\n'
    '        <DATA_CONTRACT id="CFC-TYPE-CAMERA-FOCUS-OPTIONS" visibility="PUBLIC" kind="readonly interface"><NAME>CameraFocusOptions</NAME><FIELDS><FIELD name="durationMs" type="number" required="NO">Finite transition duration from 0 through 60000.</FIELD><FIELD name="positionNodeName" type="string" required="NO">Optional GLB node fixing the viewing side and exact camera position.</FIELD><FIELD name="distance" type="number" required="NO">Positive finite target distance used only without positionNodeName.</FIELD><FIELD name="padding" type="number" required="NO">Finite framing multiplier from 1 through 10; default 1.25.</FIELD></FIELDS></DATA_CONTRACT>\n',
    "insert camera public data contracts",
)
replace_once(
    "ClassFunctionContracts.xml",
    '                <FIELD name="scenarios" type="readonly Readonly&lt;{ id: string; label: string; compatibleVariantIds: readonly string[] }&gt;[]" required="YES">Enabled scenarios and their computed structural compatibility intersections.</FIELD>\n                <FIELD name="arConfigured"',
    '                <FIELD name="scenarios" type="readonly Readonly&lt;{ id: string; label: string; compatibleVariantIds: readonly string[] }&gt;[]" required="YES">Enabled scenarios and their computed structural compatibility intersections.</FIELD>\n                <FIELD name="cameraViews" type="readonly Readonly&lt;{ id: string }&gt;[]" required="YES">Model-bound enabled named camera views.</FIELD>\n                <FIELD name="arConfigured"',
    "capability cameraViews field",
)
replace_once(
    "ClassFunctionContracts.xml",
    '                <VALUE>unknown-scenario</VALUE>\n                <VALUE>scenario-active</VALUE>',
    '                <VALUE>unknown-scenario</VALUE>\n                <VALUE>unknown-camera-view</VALUE>\n                <VALUE>unknown-node</VALUE>\n                <VALUE>invalid-camera-target</VALUE>\n                <VALUE>no-camera-view-to-restore</VALUE>\n                <VALUE>camera-transition-active</VALUE>\n                <VALUE>scenario-active</VALUE>',
    "camera rejection reasons",
)
replace_once(
    "ClassFunctionContracts.xml",
    '                <VALUE>REST_POSE_DISABLED</VALUE>\n                <VALUE>SCENARIO_DISABLED</VALUE>',
    '                <VALUE>REST_POSE_DISABLED</VALUE>\n                <VALUE>CAMERA_VIEW_DISABLED</VALUE>\n                <VALUE>SCENARIO_DISABLED</VALUE>',
    "camera error code",
)
replace_once(
    "ClassFunctionContracts.xml",
    '                <VARIANT name="ready" type="{ ok: true; selection: ConfirmedSelection; enabledColorIds: readonly string[]; enabledVariantIds: readonly string[]; enabledAnimationIds: readonly string[]; enabledScenarioIds: readonly string[]; localErrors: readonly WidgetError[] }">',
    '                <VARIANT name="ready" type="{ ok: true; selection: ConfirmedSelection; enabledColorIds: readonly string[]; enabledVariantIds: readonly string[]; enabledAnimationIds: readonly string[]; enabledScenarioIds: readonly string[]; enabledCameraViewIds: readonly string[]; localErrors: readonly WidgetError[] }">',
    "viewer initialization camera ids",
)
insert_before(
    "ClassFunctionContracts.xml",
    '        <DATA_CONTRACT id="CFC-TYPE-VIEWER-RECOVERY-RESULT"',
    '        <DATA_CONTRACT id="CFC-TYPE-VIEWER-CAMERA-RESULT" visibility="INTERNAL" kind="discriminated readonly union"><NAME>ViewerCameraResult</NAME><VARIANTS><VARIANT name="completed" type="{ ok: true; outcome: \'completed\' }">Target view was reached.</VARIANT><VARIANT name="cancelled" type="{ ok: true; outcome: \'cancelled\' }">Transition stopped at its current interpolated pose.</VARIANT><VARIANT name="rejected" type="{ ok: false; rejected: true; reason: camera rejection reason }">No camera mutation was accepted.</VARIANT><VARIANT name="failed" type="{ ok: false; rejected: false; error: WidgetError }">Accepted camera operation failed.</VARIANT></VARIANTS></DATA_CONTRACT>\n',
    "insert viewer camera result contract",
)
# Public widget method contracts are inserted before launchAR.
insert_before(
    "ClassFunctionContracts.xml",
    '                <FUNCTION_CONTRACT id="CFC-FN-WIDGET-LAUNCH-AR" visibility="PUBLIC">',
    '                <FUNCTION_CONTRACT id="CFC-FN-WIDGET-SET-CAMERA-VIEW" visibility="PUBLIC"><NAME>setCameraView</NAME><SIGNATURE>setCameraView(viewId: string): Promise&lt;CommandResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-PRODUCT-3D-WIDGET"/><INTENT>Move to one enabled named camera view without changing product execution or public snapshot.</INTENT><PRECONDITIONS><CONDITION>READY, ANIMATION-PLAYING or SCENARIO-ACTIVE.</CONDITION><CONDITION>No camera transition is active.</CONDITION></PRECONDITIONS><POSTCONDITIONS><CONDITION>Success reaches configured position and target; cancellation leaves the interpolated pose.</CONDITION></POSTCONDITIONS><FAILURE_BEHAVIOR><RULE>Unknown or disabled view is rejected without error event.</RULE></FAILURE_BEHAVIOR><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS"/><REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>A named view changes the rendered framing and does not stop scenario playback.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-WIDGET-FOCUS-NODE" visibility="PUBLIC"><NAME>focusOnNode</NAME><SIGNATURE>focusOnNode(nodeName: string, options?: CameraFocusOptions): Promise&lt;CommandResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-PRODUCT-3D-WIDGET"/><INTENT>Focus one model node through the same multi-node operation.</INTENT><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>One valid node is accepted; an absent node is rejected without mutation.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-WIDGET-FOCUS-NODES" visibility="PUBLIC"><NAME>focusOnNodes</NAME><SIGNATURE>focusOnNodes(nodeNames: readonly string[], options?: CameraFocusOptions): Promise&lt;CommandResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-PRODUCT-3D-WIDGET"/><INTENT>Frame the union of one or more model nodes from the current direction or an explicit position node.</INTENT><PRECONDITIONS><CONDITION>At least one unique non-empty node name.</CONDITION><CONDITION>Options are finite and within contracted bounds.</CONDITION></PRECONDITIONS><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS"/><REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Two focus nodes are jointly visible after a zero-duration command.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-WIDGET-RESTORE-CAMERA-VIEW" visibility="PUBLIC"><NAME>restoreCameraView</NAME><SIGNATURE>restoreCameraView(options?: CameraTransitionOptions): Promise&lt;CommandResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-PRODUCT-3D-WIDGET"/><INTENT>Return to the camera captured before the first accepted programmatic camera command.</INTENT><FAILURE_BEHAVIOR><RULE>Without a saved view, reject without mutation.</RULE></FAILURE_BEHAVIOR><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Several camera moves followed by restore return to the original rendered framing.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-WIDGET-CANCEL-CAMERA-TRANSITION" visibility="PUBLIC"><NAME>cancelCameraTransition</NAME><SIGNATURE>cancelCameraTransition(): Promise&lt;CommandResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-PRODUCT-3D-WIDGET"/><INTENT>Stop only the active camera transition and preserve its restore origin.</INTENT><POSTCONDITIONS><CONDITION>Idempotent when no transition is active.</CONDITION></POSTCONDITIONS><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL"/><REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Cancel resolves the active camera command as cancelled and leaves animation/scenario unchanged.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n',
    "insert public camera function contracts",
)
insert_before(
    "ClassFunctionContracts.xml",
    '                <FUNCTION_CONTRACT id="CFC-FN-VIEWER-RESIZE" visibility="INTERNAL">',
    '                <FUNCTION_CONTRACT id="CFC-FN-VIEWER-SET-CAMERA-VIEW" visibility="INTERNAL"><NAME>setCameraView</NAME><SIGNATURE>setCameraView(viewId: string): Promise&lt;ViewerCameraResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-THREE-VIEWER"/><INTENT>Resolve configured GLB nodes and run one camera transition.</INTENT><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-VIEW-CONFIGURATION"/><REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Exact position and target node world positions are reached.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-VIEWER-FOCUS-NODES" visibility="INTERNAL"><NAME>focusOnNodes</NAME><SIGNATURE>focusOnNodes(nodeNames: readonly string[], options?: CameraFocusOptions): Promise&lt;ViewerCameraResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-THREE-VIEWER"/><INTENT>Compute a union bound and a camera position that frames all requested nodes.</INTENT><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Union framing includes separated nodes and supports an empty-node world position.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-VIEWER-RESTORE-CAMERA-VIEW" visibility="INTERNAL"><NAME>restoreCameraView</NAME><SIGNATURE>restoreCameraView(options?: CameraTransitionOptions): Promise&lt;ViewerCameraResult&gt;</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-THREE-VIEWER"/><INTENT>Transition to and clear the saved restore snapshot only after successful completion.</INTENT><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Cancellation retains the restore snapshot; completion clears it.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n'
    '                <FUNCTION_CONTRACT id="CFC-FN-VIEWER-CANCEL-CAMERA-TRANSITION" visibility="INTERNAL"><NAME>cancelCameraTransition</NAME><SIGNATURE>cancelCameraTransition(): ViewerOperationResult</SIGNATURE><CLASS_CONTRACT ref="CFC-CLASS-THREE-VIEWER"/><INTENT>Cancel one camera RAF without touching playback RAF or restore origin.</INTENT><REQUIREMENTS><REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL"/><REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION"/></REQUIREMENTS><MINIMUM_RUNNABLE_CHECK>Playback continues after camera cancellation.</MINIMUM_RUNNABLE_CHECK></FUNCTION_CONTRACT>\n',
    "insert viewer camera function contracts",
)
# Add requirements to both relevant class requirement sets by replacing all exact occurrences intentionally.
text = Path("ClassFunctionContracts.xml").read_text(encoding="utf-8")
controller_marker = '                <REQUIREMENT ref="FR-PUBLIC-CONTROL-METHODS" />\n'
if text.count(controller_marker) < 1:
    raise RuntimeError("missing controller requirement marker")
text = text.replace(controller_marker, controller_marker + '                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS" />\n                <REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION" />\n', 1)
viewer_marker = '                <REQUIREMENT ref="FR-GLB-MODEL-LOADING" />\n'
if text.count(viewer_marker) < 1:
    raise RuntimeError("missing viewer requirement marker")
# The first matching class-level viewer list after inserted methods is sufficient for traceability.
index = text.rfind(viewer_marker)
text = text[:index + len(viewer_marker)] + '                <REQUIREMENT ref="FR-CAMERA-VIEW-CONFIGURATION" />\n                <REQUIREMENT ref="FR-CAMERA-PUBLIC-CONTROLS" />\n                <REQUIREMENT ref="FR-CAMERA-MULTI-NODE-FOCUS" />\n                <REQUIREMENT ref="FR-CAMERA-RESTORE-AND-CANCEL" />\n                <REQUIREMENT ref="FR-CAMERA-TRANSITION-ISOLATION" />\n' + text[index + len(viewer_marker):]
Path("ClassFunctionContracts.xml").write_text(text, encoding="utf-8")

# src/product-3d-widget.ts public types, capabilities and commands.
replace_once(
    "src/product-3d-widget.ts",
    "import { ThreeViewer, type ViewerInitializationResult, type ViewerRecoveryResult } from './three-viewer.js';",
    "import { ThreeViewer, type ViewerCameraResult, type ViewerInitializationResult, type ViewerRecoveryResult } from './three-viewer.js';",
    "import viewer camera result",
)
insert_before(
    "src/product-3d-widget.ts",
    "export interface ColorVariantConfig {\n",
    "export interface CameraViewConfig {\n  readonly id: string;\n  readonly positionNodeName: string;\n  readonly targetNodeName: string;\n  readonly durationMs?: number;\n}\n\nexport interface CameraTransitionOptions {\n  readonly durationMs?: number;\n}\n\nexport interface CameraFocusOptions extends CameraTransitionOptions {\n  readonly positionNodeName?: string;\n  readonly distance?: number;\n  readonly padding?: number;\n}\n\n",
    "insert public camera types",
)
replace_once(
    "src/product-3d-widget.ts",
    "  readonly restPose?: RestPoseConfig;\n  readonly colors?:",
    "  readonly restPose?: RestPoseConfig;\n  readonly cameraViews?: readonly CameraViewConfig[];\n  readonly colors?:",
    "add cameraViews to ProductConfiguration",
)
replace_once(
    "src/product-3d-widget.ts",
    "  readonly scenarios: readonly Readonly<{ id: string; label: string; compatibleVariantIds: readonly string[] }>[];\n  readonly arConfigured:",
    "  readonly scenarios: readonly Readonly<{ id: string; label: string; compatibleVariantIds: readonly string[] }>[];\n  readonly cameraViews: readonly Readonly<{ id: string }>[];\n  readonly arConfigured:",
    "add cameraViews capability",
)
replace_once(
    "src/product-3d-widget.ts",
    "  | 'REST_POSE_DISABLED'\n  | 'SCENARIO_DISABLED'",
    "  | 'REST_POSE_DISABLED'\n  | 'CAMERA_VIEW_DISABLED'\n  | 'SCENARIO_DISABLED'",
    "add camera error code",
)
replace_once(
    "src/product-3d-widget.ts",
    "  readonly scope: 'blocking' | 'color' | 'variant' | 'animation' | 'scenario' | 'ar';",
    "  readonly scope: 'blocking' | 'color' | 'variant' | 'animation' | 'scenario' | 'camera' | 'ar';",
    "add camera error scope",
)
replace_once(
    "src/product-3d-widget.ts",
    "  | 'unknown-scenario'\n  | 'scenario-active'",
    "  | 'unknown-scenario'\n  | 'unknown-camera-view'\n  | 'unknown-node'\n  | 'invalid-camera-target'\n  | 'no-camera-view-to-restore'\n  | 'camera-transition-active'\n  | 'scenario-active'",
    "add camera rejection reasons",
)
replace_once(
    "src/product-3d-widget.ts",
    "  | Readonly<{ accepted: true; outcome: 'completed'; state: Product3DWidgetState }>\n  | Readonly<{ accepted: true; outcome: 'initiated'; state: Product3DWidgetState }>",
    "  | Readonly<{ accepted: true; outcome: 'completed'; state: Product3DWidgetState }>\n  | Readonly<{ accepted: true; outcome: 'cancelled'; state: Product3DWidgetState }>\n  | Readonly<{ accepted: true; outcome: 'initiated'; state: Product3DWidgetState }>",
    "add cancelled command outcome",
)
replace_once(
    "src/product-3d-widget.ts",
    "  scenarios: Object.freeze([]),\n  arConfigured: false,",
    "  scenarios: Object.freeze([]),\n  cameraViews: Object.freeze([]),\n  arConfigured: false,",
    "empty camera capabilities",
)
replace_once(
    "src/product-3d-widget.ts",
    "    scenarios: Object.freeze(state.capabilities.scenarios.map((item) => Object.freeze({\n      ...item,\n      compatibleVariantIds: Object.freeze([...item.compatibleVariantIds]),\n    }))),\n    localErrors:",
    "    scenarios: Object.freeze(state.capabilities.scenarios.map((item) => Object.freeze({\n      ...item,\n      compatibleVariantIds: Object.freeze([...item.compatibleVariantIds]),\n    }))),\n    cameraViews: Object.freeze(state.capabilities.cameraViews.map((item) => Object.freeze({ ...item }))),\n    localErrors:",
    "freeze camera capabilities",
)
insert_before(
    "src/product-3d-widget.ts",
    "  // <SEMANTIC_BLOCK id=\"CFC-FN-WIDGET-LAUNCH-AR\">\n",
    "  #cameraCommandResult(result: ViewerCameraResult): CommandResult {\n    if (result.ok) return Object.freeze({ accepted: true, outcome: result.outcome, state: this.#state });\n    if (result.rejected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: result.reason, state: this.#state });\n    this.dispatchEvent(new CustomEvent('product-3d-error', {\n      detail: Object.freeze({ state: this.#state, error: result.error }),\n      bubbles: true,\n      composed: true,\n    }));\n    return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });\n  }\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-WIDGET-SET-CAMERA-VIEW\">\n  async setCameraView(viewId: string): Promise<CommandResult> {\n    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });\n    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });\n    if (this.#viewer === null || !['STATE-READY', 'STATE-ANIMATION-PLAYING', 'STATE-SCENARIO-ACTIVE'].includes(this.#state.lifecycle)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });\n    if (!this.#state.capabilities.cameraViews.some((item) => item.id === viewId)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'unknown-camera-view', state: this.#state });\n    return this.#cameraCommandResult(await this.#viewer.setCameraView(viewId));\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-WIDGET-FOCUS-NODE\">\n  async focusOnNode(nodeName: string, options?: CameraFocusOptions): Promise<CommandResult> {\n    return this.focusOnNodes([nodeName], options);\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-WIDGET-FOCUS-NODES\">\n  async focusOnNodes(nodeNames: readonly string[], options?: CameraFocusOptions): Promise<CommandResult> {\n    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });\n    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });\n    if (this.#viewer === null || !['STATE-READY', 'STATE-ANIMATION-PLAYING', 'STATE-SCENARIO-ACTIVE'].includes(this.#state.lifecycle)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });\n    return this.#cameraCommandResult(await this.#viewer.focusOnNodes(nodeNames, options));\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-WIDGET-RESTORE-CAMERA-VIEW\">\n  async restoreCameraView(options?: CameraTransitionOptions): Promise<CommandResult> {\n    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });\n    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });\n    if (this.#viewer === null || !['STATE-READY', 'STATE-ANIMATION-PLAYING', 'STATE-SCENARIO-ACTIVE'].includes(this.#state.lifecycle)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });\n    return this.#cameraCommandResult(await this.#viewer.restoreCameraView(options));\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-WIDGET-CANCEL-CAMERA-TRANSITION\">\n  async cancelCameraTransition(): Promise<CommandResult> {\n    if (!this.isConnected) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'disconnected', state: this.#state });\n    if (this.#terminalPrimaryGlbFailure) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'terminal-error', state: this.#state });\n    if (this.#viewer === null || !['STATE-READY', 'STATE-ANIMATION-PLAYING', 'STATE-SCENARIO-ACTIVE'].includes(this.#state.lifecycle)) return Object.freeze({ accepted: false, outcome: 'rejected', reason: 'not-ready', state: this.#state });\n    const result = this.#viewer.cancelCameraTransition();\n    if (!result.ok) {\n      this.dispatchEvent(new CustomEvent('product-3d-error', { detail: Object.freeze({ state: this.#state, error: result.error }), bubbles: true, composed: true }));\n      return Object.freeze({ accepted: true, outcome: 'failed', error: result.error, state: this.#state });\n    }\n    return Object.freeze({ accepted: true, outcome: 'completed', state: this.#state });\n  }\n  // </SEMANTIC_BLOCK>\n\n",
    "insert public camera methods",
)
replace_once(
    "src/product-3d-widget.ts",
    "    const enabledScenarios = new Set(result.enabledScenarioIds);\n    const localErrors:",
    "    const enabledScenarios = new Set(result.enabledScenarioIds);\n    const enabledCameraViews = new Set(result.enabledCameraViewIds);\n    const localErrors:",
    "capture enabled camera views",
)
# Both capability construction branches receive cameraViews.
text = Path("src/product-3d-widget.ts").read_text(encoding="utf-8")
needle = "          scenarios: [...config.scenariosById.values()].filter((item) => enabledScenarios.has(item.id)).map((item) => ({ id: item.id, label: item.label, compatibleVariantIds: [...item.compatibleVariantIds].filter((id) => enabledVariants.has(id)) })),\n          arConfigured: true,"
if text.count(needle) != 1:
    raise RuntimeError(f"AR failure capabilities marker count {text.count(needle)}")
text = text.replace(needle, needle.replace("          arConfigured", "          cameraViews: [...config.cameraViewsById.values()].filter((item) => enabledCameraViews.has(item.id)).map(({ id }) => ({ id })),\n          arConfigured"), 1)
needle = "      scenarios: [...config.scenariosById.values()].filter((item) => enabledScenarios.has(item.id)).map((item) => ({\n        id: item.id,\n        label: item.label,\n        compatibleVariantIds: [...item.compatibleVariantIds].filter((id) => enabledVariants.has(id)),\n      })),\n      arConfigured: config.arEnabled,"
if text.count(needle) != 1:
    raise RuntimeError(f"ready capabilities marker count {text.count(needle)}")
text = text.replace(needle, needle.replace("      arConfigured", "      cameraViews: [...config.cameraViewsById.values()].filter((item) => enabledCameraViews.has(item.id)).map(({ id }) => ({ id })),\n      arConfigured"), 1)
Path("src/product-3d-widget.ts").write_text(text, encoding="utf-8")

# src/configuration.ts camera view normalization.
replace_once(
    "src/configuration.ts",
    "  AnimationConfig,\n  ClipSource,",
    "  AnimationConfig,\n  CameraViewConfig,\n  ClipSource,",
    "import CameraViewConfig",
)
insert_before(
    "src/configuration.ts",
    "export interface NormalizedColorVariant {\n",
    "export interface NormalizedCameraView extends Required<CameraViewConfig> {}\n\n",
    "normalized camera view interface",
)
replace_once(
    "src/configuration.ts",
    "  readonly restPose: NormalizedRestPose | null;\n  readonly colorsById:",
    "  readonly restPose: NormalizedRestPose | null;\n  readonly cameraViewsById: ReadonlyMap<string, NormalizedCameraView>;\n  readonly colorsById:",
    "normalized configuration camera views",
)
insert_before(
    "src/configuration.ts",
    "const normalizeColorGroup = (\n",
    "const normalizeCameraViews = (\n  value: unknown,\n  localErrors: WidgetError[],\n): ReadonlyMap<string, NormalizedCameraView> => {\n  if (value === undefined) return new Map();\n  if (!Array.isArray(value)) {\n    localErrors.push(error('CAMERA_VIEW_DISABLED', 'camera', 'cameraViews must be an array when provided.'));\n    return new Map();\n  }\n  const result = new Map<string, NormalizedCameraView>();\n  const seen = new Set<string>();\n  for (const item of value) {\n    const entityId = isObject(item) && nonEmptyString(item.id) ? item.id.trim() : undefined;\n    const durationMs = isObject(item) && item.durationMs === undefined ? 700 : isObject(item) ? item.durationMs : undefined;\n    if (!isObject(item)\n      || !nonEmptyString(item.id)\n      || !nonEmptyString(item.positionNodeName)\n      || !nonEmptyString(item.targetNodeName)\n      || typeof durationMs !== 'number'\n      || !Number.isFinite(durationMs)\n      || durationMs < 0\n      || durationMs > 60_000\n      || seen.has(item.id.trim())) {\n      localErrors.push(error('CAMERA_VIEW_DISABLED', 'camera', 'A camera view is invalid.', entityId));\n      if (entityId !== undefined) seen.add(entityId);\n      continue;\n    }\n    const id = item.id.trim();\n    seen.add(id);\n    result.set(id, Object.freeze({\n      id,\n      positionNodeName: item.positionNodeName.trim(),\n      targetNodeName: item.targetNodeName.trim(),\n      durationMs,\n    }));\n  }\n  return result;\n};\n\n",
    "insert camera view normalizer",
)
replace_once(
    "src/configuration.ts",
    "  const restPose = normalizeRestPose(input.restPose, animationsById, localErrors);\n  const scenariosById",
    "  const restPose = normalizeRestPose(input.restPose, animationsById, localErrors);\n  const cameraViewsById = normalizeCameraViews(input.cameraViews, localErrors);\n  const scenariosById",
    "normalize camera views",
)
replace_once(
    "src/configuration.ts",
    "    restPose,\n    colorsById,",
    "    restPose,\n    cameraViewsById,\n    colorsById,",
    "store camera views",
)

# src/three-viewer.ts camera transitions and model-bound validation.
replace_once(
    "src/three-viewer.ts",
    "  ConfirmedSelection,\n  WidgetError,",
    "  CameraFocusOptions,\n  CameraTransitionOptions,\n  ConfirmedSelection,\n  WidgetError,",
    "import camera option types",
)
replace_once(
    "src/three-viewer.ts",
    "      enabledScenarioIds: readonly string[];\n      localErrors:",
    "      enabledScenarioIds: readonly string[];\n      enabledCameraViewIds: readonly string[];\n      localErrors:",
    "viewer initialization camera ids",
)
insert_before(
    "src/three-viewer.ts",
    "export type ViewerRecoveryResult",
    "export type ViewerCameraResult =\n  | Readonly<{ ok: true; outcome: 'completed' | 'cancelled' }>\n  | Readonly<{ ok: false; rejected: true; reason: 'unknown-camera-view' | 'unknown-node' | 'invalid-camera-target' | 'no-camera-view-to-restore' | 'camera-transition-active' }>\n  | Readonly<{ ok: false; rejected: false; error: WidgetError }>;\n",
    "viewer camera result type",
)
insert_before(
    "src/three-viewer.ts",
    "type Playback = {\n",
    "type CameraTransition = {\n  fromPosition: Vector3;\n  fromTarget: Vector3;\n  toPosition: Vector3;\n  toTarget: Vector3;\n  startTime: number;\n  durationMs: number;\n  resolve(result: Extract<ViewerCameraResult, { ok: true }>): void;\n};\n\n",
    "camera transition type",
)
insert_before(
    "src/three-viewer.ts",
    "// <SEMANTIC_BLOCK id=\"CFC-CLASS-THREE-VIEWER\">",
    "const cameraDuration = (value: unknown, fallback = 700): number | null => {\n  const duration = value === undefined ? fallback : value;\n  return typeof duration === 'number' && Number.isFinite(duration) && duration >= 0 && duration <= 60_000\n    ? duration\n    : null;\n};\n\nconst cameraPadding = (value: unknown): number | null => {\n  const padding = value === undefined ? 1.25 : value;\n  return typeof padding === 'number' && Number.isFinite(padding) && padding >= 1 && padding <= 10\n    ? padding\n    : null;\n};\n\n",
    "camera option validators",
)
replace_once(
    "src/three-viewer.ts",
    "  #rafId: number | null = null;\n  #lastFrameTime",
    "  #rafId: number | null = null;\n  #cameraRafId: number | null = null;\n  #cameraTransition: CameraTransition | null = null;\n  #savedCameraView: CameraSnapshot | null = null;\n  #lastFrameTime",
    "camera transition fields",
)
replace_once(
    "src/three-viewer.ts",
    "  readonly #enabledScenarios = new Set<string>();\n",
    "  readonly #enabledScenarios = new Set<string>();\n  readonly #enabledCameraViews = new Set<string>();\n",
    "enabled camera view set",
)
replace_once(
    "src/three-viewer.ts",
    "    this.#enabledScenarios.clear();\n\n    for (const color",
    "    this.#enabledScenarios.clear();\n    this.#enabledCameraViews.clear();\n\n    for (const color",
    "clear enabled camera views",
)
insert_before(
    "src/three-viewer.ts",
    "    for (const scenario of this.#config!.scenariosById.values()) {\n",
    "    for (const view of this.#config!.cameraViewsById.values()) {\n      if (this.#nodesByName.has(view.positionNodeName) && this.#nodesByName.has(view.targetNodeName)) {\n        this.#enabledCameraViews.add(view.id);\n      } else {\n        localErrors.push(localError('CAMERA_VIEW_DISABLED', 'camera', `Camera view \"${view.id}\" references a missing node.`, view.id));\n      }\n    }\n\n",
    "model-bound camera view validation",
)
replace_once(
    "src/three-viewer.ts",
    "      enabledScenarioIds: Object.freeze([...this.#enabledScenarios]),\n      localErrors:",
    "      enabledScenarioIds: Object.freeze([...this.#enabledScenarios]),\n      enabledCameraViewIds: Object.freeze([...this.#enabledCameraViews]),\n      localErrors:",
    "return enabled camera ids",
)
insert_before(
    "src/three-viewer.ts",
    "  // <SEMANTIC_BLOCK id=\"CFC-FN-VIEWER-APPLY-COLOR\">\n",
    "  #cameraRejected(reason: Extract<ViewerCameraResult, { ok: false; rejected: true }>['reason']): ViewerCameraResult {\n    return Object.freeze({ ok: false, rejected: true, reason });\n  }\n\n  #cameraFailed(cause: unknown): ViewerCameraResult {\n    return Object.freeze({\n      ok: false,\n      rejected: false,\n      error: Object.freeze({\n        code: 'VIEWER_OPERATION_FAILED',\n        scope: 'camera',\n        message: `The camera operation failed: ${cause instanceof Error ? cause.message : String(cause)}.`,\n      }),\n    });\n  }\n\n  #completeCameraTransition(outcome: 'completed' | 'cancelled'): void {\n    const transition = this.#cameraTransition;\n    if (transition === null) return;\n    this.#cameraTransition = null;\n    if (this.#cameraRafId !== null) cancelAnimationFrame(this.#cameraRafId);\n    this.#cameraRafId = null;\n    if (this.#controls !== null) this.#controls.enabled = true;\n    transition.resolve(Object.freeze({ ok: true, outcome }));\n  }\n\n  readonly #tickCameraTransition = (now: number): void => {\n    this.#cameraRafId = null;\n    const transition = this.#cameraTransition;\n    if (transition === null || this.#camera === null || this.#controls === null || this.#disposed) return;\n    const linear = transition.durationMs === 0 ? 1 : Math.min(Math.max((now - transition.startTime) / transition.durationMs, 0), 1);\n    const progress = 1 - Math.pow(1 - linear, 3);\n    this.#camera.position.lerpVectors(transition.fromPosition, transition.toPosition, progress);\n    this.#controls.target.lerpVectors(transition.fromTarget, transition.toTarget, progress);\n    this.#camera.lookAt(this.#controls.target);\n    this.#controls.update();\n    this.#render();\n    if (linear >= 1) {\n      this.#completeCameraTransition('completed');\n      return;\n    }\n    this.#cameraRafId = requestAnimationFrame(this.#tickCameraTransition);\n  };\n\n  #transitionCamera(position: Vector3, target: Vector3, durationMs: number, remember: boolean): Promise<ViewerCameraResult> {\n    if (this.#cameraTransition !== null) return Promise.resolve(this.#cameraRejected('camera-transition-active'));\n    if (this.#camera === null || this.#controls === null) return Promise.resolve(this.#cameraFailed(new Error('Camera is unavailable')));\n    if (remember && this.#savedCameraView === null) this.#savedCameraView = this.#captureCamera();\n    if (durationMs === 0) {\n      this.#camera.position.copy(position);\n      this.#controls.target.copy(target);\n      this.#camera.lookAt(target);\n      this.#controls.update();\n      this.#render();\n      return Promise.resolve(Object.freeze({ ok: true, outcome: 'completed' }));\n    }\n    this.#controls.enabled = false;\n    return new Promise((resolve) => {\n      this.#cameraTransition = {\n        fromPosition: this.#camera!.position.clone(),\n        fromTarget: this.#controls!.target.clone(),\n        toPosition: position.clone(),\n        toTarget: target.clone(),\n        startTime: performance.now(),\n        durationMs,\n        resolve,\n      };\n      this.#cameraRafId = requestAnimationFrame(this.#tickCameraTransition);\n    });\n  }\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-VIEWER-SET-CAMERA-VIEW\">\n  async setCameraView(viewId: string): Promise<ViewerCameraResult> {\n    if (this.#cameraTransition !== null) return this.#cameraRejected('camera-transition-active');\n    const view = this.#config?.cameraViewsById.get(viewId);\n    if (view === undefined || !this.#enabledCameraViews.has(viewId)) return this.#cameraRejected('unknown-camera-view');\n    try {\n      this.#root!.updateMatrixWorld(true);\n      const position = this.#nodesByName.get(view.positionNodeName)!.getWorldPosition(new Vector3());\n      const target = this.#nodesByName.get(view.targetNodeName)!.getWorldPosition(new Vector3());\n      return await this.#transitionCamera(position, target, view.durationMs, true);\n    } catch (cause) {\n      return this.#cameraFailed(cause);\n    }\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-VIEWER-FOCUS-NODES\">\n  async focusOnNodes(nodeNames: readonly string[], options?: CameraFocusOptions): Promise<ViewerCameraResult> {\n    if (this.#cameraTransition !== null) return this.#cameraRejected('camera-transition-active');\n    const durationMs = cameraDuration(options?.durationMs);\n    const padding = cameraPadding(options?.padding);\n    const distance = options?.distance;\n    const positionNodeName = options?.positionNodeName;\n    if (!Array.isArray(nodeNames)\n      || nodeNames.length === 0\n      || nodeNames.some((name) => typeof name !== 'string' || name.trim().length === 0)\n      || durationMs === null\n      || padding === null\n      || (distance !== undefined && (typeof distance !== 'number' || !Number.isFinite(distance) || distance <= 0))\n      || (positionNodeName !== undefined && (typeof positionNodeName !== 'string' || positionNodeName.trim().length === 0))) {\n      return this.#cameraRejected('invalid-camera-target');\n    }\n    const names = [...new Set(nodeNames.map((name) => name.trim()))];\n    if (names.some((name) => !this.#nodesByName.has(name))) return this.#cameraRejected('unknown-node');\n    if (positionNodeName !== undefined && !this.#nodesByName.has(positionNodeName.trim())) return this.#cameraRejected('unknown-node');\n    try {\n      this.#root!.updateMatrixWorld(true);\n      const bounds = new Box3().makeEmpty();\n      for (const name of names) {\n        const node = this.#nodesByName.get(name)!;\n        const nodeBounds = new Box3().setFromObject(node);\n        if (nodeBounds.isEmpty()) bounds.expandByPoint(node.getWorldPosition(new Vector3()));\n        else bounds.union(nodeBounds);\n      }\n      if (bounds.isEmpty()) return this.#cameraRejected('invalid-camera-target');\n      const target = bounds.getCenter(new Vector3());\n      let position: Vector3;\n      if (positionNodeName !== undefined) {\n        position = this.#nodesByName.get(positionNodeName.trim())!.getWorldPosition(new Vector3());\n      } else {\n        const sphere = bounds.getBoundingSphere(new Sphere());\n        const radius = Math.max(sphere.radius, 0.01);\n        const verticalFov = this.#camera!.fov * Math.PI / 180;\n        const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * this.#camera!.aspect);\n        const limitingFov = Math.max(Math.min(verticalFov, horizontalFov), 0.1);\n        const currentDistance = Math.max(this.#camera!.position.distanceTo(this.#controls!.target), 0.1);\n        const targetDistance = distance ?? Math.max(radius / Math.sin(limitingFov / 2) * padding, sphere.radius <= 0.01 ? currentDistance * 0.35 : 0.05);\n        const direction = this.#camera!.position.clone().sub(this.#controls!.target);\n        if (direction.lengthSq() < 1e-12) direction.set(1.15, 0.72, 1.35);\n        position = target.clone().addScaledVector(direction.normalize(), targetDistance);\n      }\n      const targetDistance = Math.max(position.distanceTo(target), 0.01);\n      this.#controls!.minDistance = Math.min(this.#controls!.minDistance, targetDistance * 0.1);\n      this.#camera!.near = Math.max(Math.min(this.#camera!.near, targetDistance / 100), 0.001);\n      this.#camera!.far = Math.max(this.#camera!.far, targetDistance * 100);\n      this.#camera!.updateProjectionMatrix();\n      return await this.#transitionCamera(position, target, durationMs, true);\n    } catch (cause) {\n      return this.#cameraFailed(cause);\n    }\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-VIEWER-RESTORE-CAMERA-VIEW\">\n  async restoreCameraView(options?: CameraTransitionOptions): Promise<ViewerCameraResult> {\n    if (this.#cameraTransition !== null) return this.#cameraRejected('camera-transition-active');\n    if (this.#savedCameraView === null) return this.#cameraRejected('no-camera-view-to-restore');\n    const durationMs = cameraDuration(options?.durationMs);\n    if (durationMs === null) return this.#cameraRejected('invalid-camera-target');\n    const snapshot = this.#savedCameraView;\n    const result = await this.#transitionCamera(snapshot.position, snapshot.target, durationMs, false);\n    if (result.ok && result.outcome === 'completed') this.#savedCameraView = null;\n    return result;\n  }\n  // </SEMANTIC_BLOCK>\n\n  // <SEMANTIC_BLOCK id=\"CFC-FN-VIEWER-CANCEL-CAMERA-TRANSITION\">\n  cancelCameraTransition(): ViewerOperationResult {\n    try {\n      this.#completeCameraTransition('cancelled');\n      return Object.freeze({ ok: true });\n    } catch (cause) {\n      return this.#operationFailure('camera', 'active-camera-transition', cause);\n    }\n  }\n  // </SEMANTIC_BLOCK>\n\n",
    "insert viewer camera implementation",
)
# releaseResources must cancel camera transitions and clear camera state.
replace_once(
    "src/three-viewer.ts",
    "    this.#rafId = null;\n    try { this.#playback?.action.stop(); }",
    "    this.#rafId = null;\n    try { this.#completeCameraTransition('cancelled'); } catch { /* cleanup continues */ }\n    this.#cameraRafId = null;\n    this.#savedCameraView = null;\n    try { this.#playback?.action.stop(); }",
    "camera cleanup",
)
replace_once(
    "src/three-viewer.ts",
    "    this.#enabledScenarios.clear();\n  }",
    "    this.#enabledScenarios.clear();\n    this.#enabledCameraViews.clear();\n  }",
    "clear camera view capability",
)

# Public API verifier now expects fifteen methods and unchanged events.
replace_once(
    "scripts/verify-public-api.mjs",
    "const expectedMethods = [\n  'configure',",
    "const expectedMethods = [\n  'cancelCameraTransition',\n  'configure',\n  'focusOnNode',\n  'focusOnNodes',",
    "camera public methods prefix",
)
replace_once(
    "scripts/verify-public-api.mjs",
    "  'previousScenarioStep',\n  'selectColor',",
    "  'previousScenarioStep',\n  'restoreCameraView',\n  'selectColor',",
    "restore camera public method",
)
replace_once(
    "scripts/verify-public-api.mjs",
    "  'selectVariant',\n  'startScenario',",
    "  'selectVariant',\n  'setCameraView',\n  'startScenario',",
    "set camera public method",
)
replace_once(
    "scripts/verify-public-api.mjs",
    "console.log('PASS exact runtime layout, ten public methods, eight events and approved styling surface');",
    "console.log('PASS exact runtime layout, fifteen public methods, eight events and approved styling surface');",
    "public API verifier message",
)

# Unit test configuration includes and validates camera views.
replace_once(
    "tests/configuration.test.ts",
    "  glbUrl: '/tests/fixtures/product.gltf',\n  colors:",
    "  glbUrl: '/tests/fixtures/product.gltf',\n  cameraViews: [\n    { id: 'front', positionNodeName: 'CAM_Front', targetNodeName: 'FOCUS_Product', durationMs: 500 },\n  ],\n  colors:",
    "valid camera view fixture",
)
insert_before(
    "tests/configuration.test.ts",
    "  it('disables only an invalid non-default color', () => {\n",
    "  it('normalizes camera views without mutating the input', () => {\n    const result = normalizeProductConfiguration(validConfiguration());\n    expect(result.ok).toBe(true);\n    if (result.ok) expect(result.configuration.cameraViewsById.get('front')).toEqual({\n      id: 'front', positionNodeName: 'CAM_Front', targetNodeName: 'FOCUS_Product', durationMs: 500,\n    });\n  });\n\n  it('disables only an invalid camera view', () => {\n    const input = validConfiguration();\n    const result = normalizeProductConfiguration({\n      ...input,\n      cameraViews: [...input.cameraViews!, { id: 'bad', positionNodeName: '', targetNodeName: 'FOCUS_Product' }],\n    });\n    expect(result.ok).toBe(true);\n    if (result.ok) {\n      expect([...result.configuration.cameraViewsById.keys()]).toEqual(['front']);\n      expect(result.configuration.localErrors.some((item) => item.code === 'CAMERA_VIEW_DISABLED' && item.entityId === 'bad')).toBe(true);\n    }\n  });\n\n",
    "camera configuration tests",
)

# Browser fixture: one animated triangle plus camera/focus empties.
Path("tests/fixtures/camera-control.gltf").write_text(json.dumps({
    "asset": {"version": "2.0", "generator": "product-3d-widget camera control tests"},
    "scene": 0,
    "scenes": [{"nodes": [0, 1, 2, 3, 4, 5]}],
    "nodes": [
        {"name": "Product", "mesh": 0},
        {"name": "CAM_Close", "translation": [0, 0, 1.2]},
        {"name": "CAM_Side", "translation": [1.8, 0, 0]},
        {"name": "FOCUS_Product", "translation": [0, 0, 0]},
        {"name": "Focus_Left", "translation": [-0.4, 0, 0]},
        {"name": "Focus_Right", "translation": [0.4, 0, 0]},
    ],
    "meshes": [{"name": "ProductMesh", "primitives": [{"attributes": {"POSITION": 0}, "indices": 1, "material": 0}]}],
    "materials": [{"name": "Body", "pbrMetallicRoughness": {"baseColorFactor": [0.2, 0.4, 0.8, 1], "metallicFactor": 0, "roughnessFactor": 0.8}}],
    "animations": [{"name": "Pulse", "samplers": [{"input": 2, "output": 3, "interpolation": "LINEAR"}], "channels": [{"sampler": 0, "target": {"node": 0, "path": "scale"}}]}],
    "buffers": [{"byteLength": 76, "uri": "data:application/octet-stream;base64,AAAAvwAAAL8AAAAAAAAAPwAAAL8AAAAAAAAAAAAAAD8AAAAAAAABAAIAAAAAAAAAAACAPwAAgD8AAIA/AACAPwAAAEAAAIA/AACAPw=="}],
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
        {"bufferView": 3, "componentType": 5126, "count": 2, "type": "VEC3", "min": [1, 1, 1], "max": [1.4, 1.4, 1.4]},
    ],
}, separators=(",", ":")), encoding="utf-8")

Path("tests/camera-control.spec.ts").write_text("""import { expect, test } from 'playwright/test';

const configuration = {
  productId: 'camera-control',
  glbUrl: '/tests/fixtures/camera-control.gltf',
  cameraViews: [
    { id: 'close', positionNodeName: 'CAM_Close', targetNodeName: 'FOCUS_Product', durationMs: 0 },
    { id: 'side', positionNodeName: 'CAM_Side', targetNodeName: 'FOCUS_Product', durationMs: 1000 },
  ],
  variants: [{ id: 'base', label: 'Base', isDefault: true, isBase: true, visibleNodeNames: [], hiddenNodeNames: [] }],
  animations: [{ id: 'pulse', label: 'Pulse', source: { kind: 'clip', clipName: 'Pulse' }, compatibleVariantIds: ['base'] }],
  scenarios: [{ id: 'assembly', label: 'Assembly', steps: [{ id: 'one', description: 'One', animationId: 'pulse' }] }],
};

const visiblePixelCount = async (page: any): Promise<number> => {
  const image = await page.locator('#widget').screenshot();
  return page.evaluate(async (encoded: string) => {
    const response = await fetch(`data:image/png;base64,${encoded}`);
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (context === null) throw new Error('2D context is unavailable.');
    context.drawImage(bitmap, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const background = [pixels[0], pixels[1], pixels[2], pixels[3]];
    let count = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      const difference = Math.abs(pixels[index] - background[0]) + Math.abs(pixels[index + 1] - background[1]) + Math.abs(pixels[index + 2] - background[2]) + Math.abs(pixels[index + 3] - background[3]);
      if (difference > 40) count += 1;
    }
    bitmap.close();
    return count;
  }, image.toString('base64'));
};

test('supports named views, multi-node focus, restore and cancellation during a scenario', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Deterministic camera rendering assertions run in Chromium.');
  await page.goto('/tests/fixtures/');
  await page.waitForFunction(() => customElements.get('product-3d-widget') !== undefined);
  const outcome = await page.evaluate(async (config) => {
    const widget = document.createElement('product-3d-widget') as any;
    widget.id = 'widget';
    widget.style.width = '400px';
    widget.style.height = '300px';
    document.body.append(widget);
    return (await widget.configure(config)).outcome;
  }, configuration);
  expect(outcome).toBe('ready');
  expect(await page.locator('#widget').evaluate((widget: any) => widget.getState().capabilities.cameraViews)).toEqual([{ id: 'close' }, { id: 'side' }]);

  const initialPixels = await visiblePixelCount(page);
  expect(await page.locator('#widget').evaluate((widget: any) => widget.setCameraView('close'))).toMatchObject({ accepted: true, outcome: 'completed' });
  const closePixels = await visiblePixelCount(page);
  expect(closePixels).toBeGreaterThan(initialPixels * 1.5);

  expect(await page.locator('#widget').evaluate((widget: any) => widget.focusOnNodes(['Focus_Left', 'Focus_Right'], { durationMs: 0, distance: 1.4 }))).toMatchObject({ accepted: true, outcome: 'completed' });
  expect(await page.locator('#widget').evaluate((widget: any) => widget.restoreCameraView({ durationMs: 0 }))).toMatchObject({ accepted: true, outcome: 'completed' });
  const restoredPixels = await visiblePixelCount(page);
  expect(Math.abs(restoredPixels - initialPixels) / initialPixels).toBeLessThan(0.05);

  expect(await page.locator('#widget').evaluate((widget: any) => widget.focusOnNode('missing', { durationMs: 0 }))).toMatchObject({ accepted: false, reason: 'unknown-node' });
  expect(await page.locator('#widget').evaluate((widget: any) => widget.startScenario('assembly'))).toMatchObject({ accepted: true, outcome: 'completed' });
  const cancellation = await page.locator('#widget').evaluate(async (widget: any) => {
    const moving = widget.setCameraView('side');
    await new Promise((resolve) => setTimeout(resolve, 80));
    const cancelled = await widget.cancelCameraTransition();
    return { moving: await moving, cancelled, lifecycle: widget.getState().lifecycle };
  });
  expect(cancellation.moving).toMatchObject({ accepted: true, outcome: 'cancelled' });
  expect(cancellation.cancelled).toMatchObject({ accepted: true, outcome: 'completed' });
  expect(cancellation.lifecycle).toBe('STATE-SCENARIO-ACTIVE');
});
""", encoding="utf-8")

# Update validation report only after all checks succeed in the workflow.
print("camera control patch applied")
