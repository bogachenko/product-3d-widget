from pathlib import Path

path = Path('tools/apply-camera-control-api.py')
text = path.read_text(encoding='utf-8')
replacements = {
    "<RESPONSIBILITY>Проверять внешнюю конфигурацию, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>":
    "<RESPONSIBILITY>Проверять внешнюю конфигурацию, нормализовать необязательную rest pose, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>",
    "<RESPONSIBILITY>Проверять внешнюю конфигурацию, включая именованные camera views, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>":
    "<RESPONSIBILITY>Проверять внешнюю конфигурацию, нормализовать необязательные rest pose и именованные camera views, отделять блокирующие ошибки от локально отключаемых возможностей и вычислять неизменяемые производные данные совместимости.</RESPONSIBILITY>",
    "<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, GLB-ресурсами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>":
    "<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, GLB-ресурсами, базовой и настроенной обычной позами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>",
    "<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, OrbitControls, программными camera transitions и restore snapshot, GLB-ресурсами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>":
    "<RESPONSIBILITY>Владеть WebGLRenderer, сценой, камерой, OrbitControls, программными camera transitions и restore snapshot, GLB-ресурсами, базовой и настроенной обычной позами, применением выбора, воспроизведением анимаций и сценариев, resize и единственной попыткой восстановления WebGL-контекста.</RESPONSIBILITY>",
    "<RESPONSIBILITY id=\"CONTRACT-MOD-THREE-VIEWER-RESP-08\">Сохранять camera view и выбор при утверждённых операциях восстановления и замены.</RESPONSIBILITY>":
    "<RESPONSIBILITY id=\"CONTRACT-MOD-THREE-VIEWER-RESP-08\">Вычислять и хранить настроенную ordinary pose, а также сохранять camera view и выбор при утверждённых операциях восстановления и замены.</RESPONSIBILITY>",
    "<RESPONSIBILITY id=\"CONTRACT-MOD-THREE-VIEWER-RESP-08\">Сохранять camera view и выбор при утверждённых операциях восстановления и замены; выполнять именованные и node-bound camera transitions с одним restore snapshot.</RESPONSIBILITY>":
    "<RESPONSIBILITY id=\"CONTRACT-MOD-THREE-VIEWER-RESP-08\">Вычислять и хранить настроенную ordinary pose, сохранять camera view и выбор при утверждённых операциях восстановления и замены, а также выполнять именованные и node-bound camera transitions с одним restore snapshot.</RESPONSIBILITY>",
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f'missing patch literal: {old}')
    text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
