from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def update(path: str, replacements: list[tuple[str, str]], approved_change: str) -> None:
    file = ROOT / path
    text = file.read_text()
    for old, new in replacements:
        count = text.count(old)
        if count != 1:
            raise RuntimeError(f"{path}: expected one match for {old[:80]!r}, found {count}")
        text = text.replace(old, new, 1)
    marker = "    <APPROVAL_GATE"
    if approved_change not in text:
        if text.count(marker) != 1:
            raise RuntimeError(f"{path}: approval marker count is {text.count(marker)}")
        text = text.replace(marker, approved_change + "\n" + marker, 1)
    file.write_text(text)


update(
    "RequirementsAnalysis.xml",
    [
        (
            '<ENTITY id="ENTITY-PRODUCT-CONFIGURATION"><NAME>Конфигурация товара</NAME><DESCRIPTION>Набор данных, определяющий обязательную основную GLB-модель, необязательные цвета и структурные варианты товара, анимации, пошаговые сценарии, настройки AR и необязательную отдельную USDZ-модель.</DESCRIPTION></ENTITY>',
            '<ENTITY id="ENTITY-PRODUCT-CONFIGURATION"><NAME>Конфигурация товара</NAME><DESCRIPTION>Набор данных, определяющий обязательную основную GLB-модель, необязательную обычную позу из конечного кадра настроенной анимации, цвета и структурные варианты товара, анимации, пошаговые сценарии, настройки AR и необязательную отдельную USDZ-модель.</DESCRIPTION></ENTITY>',
        ),
        (
            '<ENTITY id="ENTITY-ANIMATION"><NAME>Анимация товара</NAME><DESCRIPTION>Движение или изменение состояния 3D-модели, заданное именованным клипом либо временным диапазоном общей анимации и связанное со списком совместимых структурных вариантов.</DESCRIPTION></ENTITY>',
            '<ENTITY id="ENTITY-ANIMATION"><NAME>Анимация товара</NAME><DESCRIPTION>Движение или изменение состояния 3D-модели, заданное именованным клипом либо временным диапазоном общей анимации и связанное со списком совместимых структурных вариантов.</DESCRIPTION></ENTITY>\n        <ENTITY id="ENTITY-ORDINARY-POSE"><NAME>Обычная поза товара</NAME><DESCRIPTION>Поза, показываемая после инициализации и восстанавливаемая после обычных операций. По умолчанию это базовая поза GLB; конфигурация может выбрать конечный кадр доступной обычной анимации.</DESCRIPTION></ENTITY>',
        ),
        (
            '<FUNCTIONAL_REQUIREMENT id="FR-CONFIGURATION-ACCEPTANCE"><DESCRIPTION>product-3d-widget должен принимать от хост-страницы конфигурацию конкретного товара, проверять её и применять только после успешной проверки обязательных данных. При некорректной обязательной конфигурации компонент не должен переходить к загрузке и отображению товара и должен сообщить об ошибке.</DESCRIPTION>',
            '<FUNCTIONAL_REQUIREMENT id="FR-CONFIGURATION-ACCEPTANCE"><DESCRIPTION>product-3d-widget должен принимать от хост-страницы конфигурацию конкретного товара, проверять её и применять только после успешной проверки обязательных данных. Необязательная ordinary rest pose может ссылаться на конечный кадр настроенной обычной анимации; некорректная ссылка отключает только rest pose и сохраняет fallback на базовую позу GLB. При некорректной обязательной конфигурации компонент не должен переходить к загрузке и отображению товара и должен сообщить об ошибке.</DESCRIPTION>',
        ),
        (
            '<FUNCTIONAL_REQUIREMENT id="FR-GLB-MODEL-LOADING"><DESCRIPTION>product-3d-widget должен загружать обязательную основную GLB-модель, отображать состояние загрузки и после успешной загрузки показывать модель пользователю.</DESCRIPTION>',
            '<FUNCTIONAL_REQUIREMENT id="FR-GLB-MODEL-LOADING"><DESCRIPTION>product-3d-widget должен загружать обязательную основную GLB-модель, отображать состояние загрузки и после успешной загрузки показывать модель в настроенной обычной позе. Если rest pose отсутствует, некорректна или недоступна в загруженной модели, используется базовая поза GLB.</DESCRIPTION>',
        ),
        (
            '<FUNCTIONAL_REQUIREMENT id="FR-ANIMATION-RESET-AFTER-PLAYBACK"><DESCRIPTION>После завершения обычной анимации product-3d-widget должен вернуть модель в исходное состояние, сохранив выбранные цвет, структурный вариант и пользовательский ракурс камеры.</DESCRIPTION>',
            '<FUNCTIONAL_REQUIREMENT id="FR-ANIMATION-RESET-AFTER-PLAYBACK"><DESCRIPTION>После завершения обычной анимации product-3d-widget должен вернуть модель в настроенную обычную позу, сохранив выбранные цвет, структурный вариант и пользовательский ракурс камеры.</DESCRIPTION>',
        ),
    ],
    '''    <APPROVED_CHANGE id="RA-CHANGE-CONFIGURABLE-REST-POSE" approved_at="2026-08-01T10:58:00+03:00">
        <DECISION>Владелец проекта утвердил необязательную обычную позу товара, задаваемую конечным кадром настроенной обычной анимации.</DECISION>
        <FALLBACK>При отсутствии или недоступности rest pose используется базовая поза основной GLB без блокировки остальных возможностей.</FALLBACK>
        <PROPAGATION>Настроенная обычная поза показывается при готовности и используется вместо сырой базовой позы GLB во всех существующих требованиях восстановления обычного состояния.</PROPAGATION>
    </APPROVED_CHANGE>''',
)

requirements = (ROOT / "RequirementsAnalysis.xml").read_text()
requirements = requirements.replace("вернуть модель в обычное исходное состояние", "вернуть модель в настроенную обычную позу")
requirements = requirements.replace("вернуть модель в исходное состояние", "вернуть модель в настроенную обычную позу")
(ROOT / "RequirementsAnalysis.xml").write_text(requirements)

update(
    "DevelopmentPlan.xml",
    [
        (
            '<CHOICE>Статическая проверка и вычисление совместимости выполняются чистыми функциями без DOM, fetch и Three.js.</CHOICE>',
            '<CHOICE>Статическая проверка, нормализация необязательной rest pose и вычисление совместимости выполняются чистыми функциями без DOM, fetch и Three.js.</CHOICE>',
        ),
        (
            '<RESPONSIBILITY>Проверять внешнюю конфигурацию, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>',
            '<RESPONSIBILITY>Проверять внешнюю конфигурацию, нормализовать необязательную rest pose, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>',
        ),
        (
            '<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, GLB-ресурсами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>',
            '<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, GLB-ресурсами, базовой и настроенной обычной позами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>',
        ),
    ],
    '''    <APPROVED_CHANGE id="DP-CHANGE-CONFIGURABLE-REST-POSE" approved_at="2026-08-01T10:58:00+03:00">
        <MODULE_ASSIGNMENT module="MOD-CONFIGURATION">Проверяет форму restPose и ссылку на настроенную анимацию; ошибка локальна.</MODULE_ASSIGNMENT>
        <MODULE_ASSIGNMENT module="MOD-THREE-VIEWER">После model-bound validation вычисляет конечный кадр указанной анимации, сохраняет immutable transform snapshot и использует его как ordinary pose.</MODULE_ASSIGNMENT>
        <MODULE_ASSIGNMENT module="MOD-WIDGET-CONTROLLER">Публичные методы, события и lifecycle не меняются.</MODULE_ASSIGNMENT>
        <CONSTRAINT>Новые runtime-модули и зависимости не добавляются.</CONSTRAINT>
    </APPROVED_CHANGE>''',
)

update(
    "ModuleContracts.xml",
    [
        (
            '<RULE>Ошибка только необязательной возможности отключает ровно эту возможность или группу согласно требованиям.</RULE>',
            '<RULE>Ошибка только необязательной возможности, включая restPose, отключает ровно эту возможность или группу согласно требованиям; недоступная restPose использует базовую позу GLB.</RULE>',
        ),
        (
            '<RESPONSIBILITY id="CONTRACT-MOD-THREE-VIEWER-RESP-04">Проверять model-bound ссылки необязательных вариантов, анимаций и сценариев после загрузки GLB.</RESPONSIBILITY>',
            '<RESPONSIBILITY id="CONTRACT-MOD-THREE-VIEWER-RESP-04">Проверять model-bound ссылки необязательных вариантов, анимаций, restPose и сценариев после загрузки GLB.</RESPONSIBILITY>',
        ),
        (
            '<RESPONSIBILITY id="CONTRACT-MOD-THREE-VIEWER-RESP-08">Сохранять camera view и выбор при утверждённых операциях восстановления и замены.</RESPONSIBILITY>',
            '<RESPONSIBILITY id="CONTRACT-MOD-THREE-VIEWER-RESP-08">Вычислять и хранить настроенную ordinary pose, а также сохранять camera view и выбор при утверждённых операциях восстановления и замены.</RESPONSIBILITY>',
        ),
        (
            '<STATE_ITEM>Внутренний camera snapshot для утверждённых restore-операций.</STATE_ITEM>',
            '<STATE_ITEM>Immutable transform snapshots базовой GLB-позы и настроенной ordinary pose.</STATE_ITEM>\n                    <STATE_ITEM>Внутренний camera snapshot для утверждённых restore-операций.</STATE_ITEM>',
        ),
    ],
    '''    <APPROVED_CHANGE id="MC-CHANGE-CONFIGURABLE-REST-POSE" approved_at="2026-08-01T10:58:00+03:00">
        <CONFIGURATION_CONTRACT ref="CONTRACT-MOD-CONFIGURATION">restPose является необязательной локально отключаемой возможностью и нормализуется без DOM или Three.js.</CONFIGURATION_CONTRACT>
        <VIEWER_CONTRACT ref="CONTRACT-MOD-THREE-VIEWER">Viewer сэмплирует только конечный кадр уже включённой анимации, сохраняет transform snapshot и восстанавливает его без изменения camera или selections.</VIEWER_CONTRACT>
    </APPROVED_CHANGE>''',
)

update(
    "ClassFunctionContracts.xml",
    [
        (
            '<FIELD name="usdzUrl" type="string" required="NO">Optional separate USDZ asset; absence preserves automatic GLB-to-USDZ Quick Look fallback.</FIELD>',
            '<FIELD name="usdzUrl" type="string" required="NO">Optional separate USDZ asset; absence preserves automatic GLB-to-USDZ Quick Look fallback.</FIELD>\n                <FIELD name="restPose" type="RestPoseConfig" required="NO">Optional ordinary pose derived from the endpoint of one configured regular animation.</FIELD>',
        ),
        (
            '<DATA_CONTRACT id="CFC-TYPE-COLOR-VARIANT-CONFIG" visibility="PUBLIC" kind="readonly interface">',
            '''<DATA_CONTRACT id="CFC-TYPE-REST-POSE-CONFIG" visibility="PUBLIC" kind="readonly discriminated interface">
            <NAME>RestPoseConfig</NAME>
            <FIELDS>
                <FIELD name="kind" type="'animation-end'" required="YES">The ordinary pose is sampled from an animation endpoint.</FIELD>
                <FIELD name="animationId" type="string" required="YES">Non-empty id of an enabled configured regular animation.</FIELD>
            </FIELDS>
            <RULES>
                <RULE>Invalid static or model-bound references produce REST_POSE_DISABLED and fall back to the GLB base pose.</RULE>
                <RULE>Rest pose does not become a public operation or lifecycle state.</RULE>
            </RULES>
        </DATA_CONTRACT>
        <DATA_CONTRACT id="CFC-TYPE-COLOR-VARIANT-CONFIG" visibility="PUBLIC" kind="readonly interface">''',
        ),
        (
            '<FIELD name="usdzUrl" type="string | null" required="YES">Optional separate USDZ before model-viewer usability check.</FIELD>',
            '<FIELD name="usdzUrl" type="string | null" required="YES">Optional separate USDZ before model-viewer usability check.</FIELD>\n                <FIELD name="restPose" type="NormalizedRestPose | null" required="YES">Validated optional animation endpoint reference or null for the GLB base pose fallback.</FIELD>',
        ),
        (
            '<VALUE>ANIMATION_DISABLED</VALUE>\n                <VALUE>SCENARIO_DISABLED</VALUE>',
            '<VALUE>ANIMATION_DISABLED</VALUE>\n                <VALUE>REST_POSE_DISABLED</VALUE>\n                <VALUE>SCENARIO_DISABLED</VALUE>',
        ),
    ],
    '''    <APPROVED_CHANGE id="CFC-CHANGE-CONFIGURABLE-REST-POSE" approved_at="2026-08-01T10:58:00+03:00">
        <PUBLIC_TYPE ref="CFC-TYPE-REST-POSE-CONFIG">Добавляется только необязательное поле конфигурации; десять публичных методов и восемь событий не меняются.</PUBLIC_TYPE>
        <FUNCTION ref="CFC-FN-NORMALIZE-CONFIG">Нормализует restPose после animations и возвращает локальную REST_POSE_DISABLED при недопустимой ссылке.</FUNCTION>
        <CLASS ref="CFC-CLASS-THREE-VIEWER">Private local helpers сэмплируют animation endpoint и управляют двумя transform snapshots в пределах существующего viewer contract.</CLASS>
        <VERIFICATION>Vitest проверяет static fallback; Playwright проверяет initial ordinary pose, начало анимации с её первого кадра и восстановление ordinary pose после completion.</VERIFICATION>
    </APPROVED_CHANGE>''',
)
