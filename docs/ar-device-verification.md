# Проверка нативных AR-каналов на реальных устройствах

Автоматические тесты подтверждают только режим-нейтральный запрос через публичные `canActivateAR` и `activateAR()`, а также события начала и завершения WebXR. Они не подтверждают Scene Viewer или Quick Look.

## Общая подготовка

1. Собрать production bundle командой `npm run build`.
2. Разместить тестовую страницу и GLB/USDZ по HTTPS с корректными MIME-типами и доступом без авторизации.
3. На странице создать `product-3d-widget`, вызвать `configure()` из конфигурации с `ar.enabled: true` и дождаться `STATE-READY`.
4. Выводить в отдельный журнал результаты `launchAR()`, все восемь публичных событий и полные снимки `getState()`. Для цветового варианта с PBR-картами отдельно проверить перенос base color, normal и metallic-roughness; публичный model-viewer API может заменить только существующий в исходном GLB texture slot.
5. Запускать `launchAR()` только непосредственно из обработчика нажатия пользователя.

## Android: Scene Viewer

Оборудование: физическое Android-устройство с актуальными Google Play Services for AR и браузером Chrome.

1. Открыть HTTPS-страницу в Chrome.
2. Убедиться, что `state.capabilities.arConfigured === true`, `state.ar.available === true` и `state.availability.canLaunchAR === true`.
3. Нажать кнопку AR один раз.
4. Зафиксировать результат `{ accepted: true, outcome: 'initiated' }` без поля выбранного режима.
5. Убедиться, что открывается системный AR-интерфейс и показывается тот же товар с последним подтверждённым цветом настолько, насколько это поддерживает публичный API `<model-viewer>`.
6. Вернуться на страницу.
7. Подтвердить, что компонент не публиковал `product-3d-ar-launched` или `product-3d-ar-returned` только из-за `visibilitychange`/`focus`, а состояние не содержит `scene-viewer`, mode или аналогичного поля.
8. Повторить без USDZ: Android-путь должен продолжать использовать основной GLB.

## iOS: Quick Look

Оборудование: физический iPhone/iPad с актуальной iOS и Safari.

1. Открыть HTTPS-страницу в Safari.
2. Выполнить шаги 2–4 из Android-проверки.
3. Убедиться, что открывается Quick Look:
   - с отдельным `usdzUrl`, когда он задан и пригоден;
   - без `usdzUrl`, используя предусмотренный `<model-viewer>` GLB-to-USDZ fallback.
4. Проверить визуальное соответствие последнему подтверждённому цвету настолько, насколько это поддерживает публичный API `<model-viewer>`.
5. Вернуться в Safari.
6. Подтвердить отсутствие событий `product-3d-ar-launched`/`product-3d-ar-returned`, если публичного WebXR-start/end события не было.
7. Подтвердить отсутствие `quick-look`, mode или выбранного канала в публичном состоянии, результатах и ошибках.

## WebXR на совместимом устройстве

1. Запустить AR из пользовательского нажатия.
2. При публичном `ar-status: session-started` подтвердить порядок:
   `product-3d-state-change` → `product-3d-ar-launched`, lifecycle `STATE-AR-ACTIVE`, `ar.webxrActive === true`.
3. При публичном `ar-status: not-presenting` подтвердить порядок:
   `product-3d-state-change` → `product-3d-ar-returned`, lifecycle `STATE-READY`, `ar.webxrActive === false`.
4. Убедиться, что остановленная перед AR обычная анимация не возобновляется.
