# product-3d-widget

Переиспользуемый браузерный Web Component для просмотра одной 3D-модели товара, переключения цветов, необязательных PBR-текстур и конструктивных вариантов, запуска анимаций и пошаговых сценариев, а также режим-нейтрального запуска AR.

## Требования для разработки

- Node.js `24.18.1`
- npm с поддержкой `npm ci`
- браузеры Playwright для полного E2E-прогона

## Установка

```bash
npm ci
```

## Production-сборка

```bash
npm run build
```

Команда создаёт `dist/product-3d-widget.js` как полностью минифицированный ESM-bundle и отдельный source map `dist/product-3d-widget.js.map`. Полная минификация выполняется встроенным Oxc Minifier через Rolldown; дополнительная зависимость для минификации не требуется.

## Ручной стенд

```bash
npm run demo
```

Откроется страница `/examples/manual/`. Она создаёт реальный экземпляр компонента, загружает тестовую glTF-модель и предоставляет:

- редактируемую JSON-конфигурацию;
- выбор цвета и конструктивного варианта;
- запуск анимаций и сценариев;
- переходы между шагами сценария;
- запуск AR при доступности;
- текущий immutable state;
- результаты команд и журнал всех восьми публичных событий.

Для проверки своей модели укажите URL GLB в поле `glbUrl`. Для iOS Quick Look можно дополнительно указать `usdzUrl`. Имена материалов, узлов и анимаций в конфигурации должны совпадать с именами внутри модели.

## Подключение пакета

```js
import 'product-3d-widget';

await customElements.whenDefined('product-3d-widget');

const widget = document.querySelector('product-3d-widget');

const result = await widget.configure({
  productId: 'product-1',
  glbUrl: '/models/product.glb',
});

console.log(result);
console.log(widget.getState());
```

```html
<product-3d-widget style="width: 720px"></product-3d-widget>
```

Минимально обязательны `productId` и `glbUrl`. Один DOM-экземпляр принимает конфигурацию только для одного товара.

## Публичные методы

- `configure(configuration)`
- `getState()`
- `selectColor(colorId)`
- `selectVariant(variantId)`
- `playAnimation(animationId)`
- `startScenario(scenarioId)`
- `previousScenarioStep()`
- `nextScenarioStep()`
- `stopScenario()`
- `launchAR()`

Все изменяющие команды возвращают Promise с явным результатом `completed`, `initiated`, `rejected` или `failed`.

## Публичные события

- `product-3d-state-change`
- `product-3d-selection-change`
- `product-3d-animation-change`
- `product-3d-scenario-change`
- `product-3d-ar-availability-change`
- `product-3d-ar-launched`
- `product-3d-ar-returned`
- `product-3d-error`

## Стилизация

Доступные Shadow Parts:

- `viewer`
- `loading`
- `error`

Соотношение сторон задаётся переменной:

```css
product-3d-widget {
  --product-3d-aspect-ratio: 4 / 3;
}
```

## Проверки

```bash
npm run typecheck
npm run build
npm run build:types
npm run verify:api
npm run test:unit
xvfb-run --auto-servernum npm run test:e2e
npm run verify:three
```

`npm run verify:three` также проверяет, что полная production-минификация явно включена и не может быть незаметно удалена из Vite-конфигурации.

Или одной командой:

```bash
xvfb-run --auto-servernum npm run verify
```

## AR

AR должен запускаться непосредственно из пользовательского нажатия. Для проверки Scene Viewer и Quick Look на физическом устройстве страница и модели должны быть доступны по HTTPS. Детальная матрица ручной проверки находится в `docs/ar-device-verification.md`.


### PBR-текстуры цветового варианта

Цветовой вариант может содержать необязательный объект `surface` с URL карт `baseColorTextureUrl`, `normalTextureUrl`, `metallicRoughnessTextureUrl`, `occlusionTextureUrl` и параметрами UV `repeat`, `offset`, `rotation`, `normalScale`. Старые конфигурации только со `swatch` сохраняют прежнее поведение.


### Геометрия ткани и UV-канал

Цветовой вариант может дополнительно задавать `visibleNodeNames` и `hiddenNodeNames`. Эта видимость применяется после структурного варианта, поэтому ткань и конструкция сохраняются как независимые выборы. В `surface.uvChannel` можно выбрать UV-набор от `0` до `3`; значение `0` используется по умолчанию. Для канала `1` целевые меши должны содержать атрибут `uv1`, для каналов `2` и `3` — соответственно `uv2` и `uv3`. Отсутствующий узел или UV-атрибут отключает только соответствующий цветовой вариант.
