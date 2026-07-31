import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

const expectedMethods = [
  'configure',
  'getState',
  'launchAR',
  'nextScenarioStep',
  'playAnimation',
  'previousScenarioStep',
  'selectColor',
  'selectVariant',
  'startScenario',
  'stopScenario',
].sort();
const expectedEvents = [
  'product-3d-animation-change',
  'product-3d-ar-availability-change',
  'product-3d-ar-launched',
  'product-3d-ar-returned',
  'product-3d-error',
  'product-3d-scenario-change',
  'product-3d-selection-change',
  'product-3d-state-change',
].sort();
const expectedRuntimeFiles = [
  'ar-adapter.ts',
  'configuration.ts',
  'product-3d-widget.ts',
  'three-viewer.ts',
];

const runtimeFiles = (await readdir('src')).filter((name) => name.endsWith('.ts')).sort();
if (JSON.stringify(runtimeFiles) !== JSON.stringify(expectedRuntimeFiles)) {
  throw new Error(`Unexpected runtime source layout: ${runtimeFiles.join(', ')}`);
}

const runtimeSources = new Map(await Promise.all(runtimeFiles.map(async (name) => [name, await readFile(`src/${name}`, 'utf8')])));
const parsedRuntimeSources = new Map([...runtimeSources].map(([name, content]) => [
  name,
  ts.createSourceFile(name, content, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
]));
const runtimeClasses = [...parsedRuntimeSources.values()]
  .flatMap((file) => file.statements.filter(ts.isClassDeclaration).map((declaration) => declaration.name?.text))
  .filter(Boolean)
  .sort();
if (JSON.stringify(runtimeClasses) !== JSON.stringify(['ModelViewerArAdapter', 'Product3DWidget', 'ThreeViewer'])) {
  throw new Error(`Unexpected runtime classes: ${runtimeClasses.join(', ')}`);
}

const importsFor = (name) => parsedRuntimeSources.get(name).statements
  .filter(ts.isImportDeclaration)
  .map((declaration) => declaration.moduleSpecifier)
  .filter(ts.isStringLiteral)
  .map((literal) => literal.text);
const viewerImports = importsFor('three-viewer.ts');
const arImports = importsFor('ar-adapter.ts');
if (viewerImports.includes('./ar-adapter.js') || arImports.includes('./three-viewer.js')) {
  throw new Error('Leaf runtime modules import each other.');
}
if (arImports.some((specifier) => specifier === 'three' || specifier.startsWith('three/'))) {
  throw new Error('AR adapter imports Three.js instead of using model-viewer public APIs.');
}
const forbiddenModeDetail = /scene[ -]viewer|quick[ -]look|selected(?:Ar)?Mode|arMode\s*:/i;
for (const [name, content] of runtimeSources) {
  if (forbiddenModeDetail.test(content)) throw new Error(`${name} contains an unapproved AR mode detail.`);
}

const arSource = parsedRuntimeSources.get('ar-adapter.ts');
const forbiddenArProperties = new Set(['shadowRoot', 'scene', 'threeScene']);
const arListenerNames = new Set();
const visitAr = (node) => {
  if (ts.isPropertyAccessExpression(node) && forbiddenArProperties.has(node.name.text)) {
    throw new Error(`AR adapter accesses forbidden internal property: ${node.name.text}`);
  }
  if (ts.isCallExpression(node)
    && ts.isPropertyAccessExpression(node.expression)
    && node.expression.name.text === 'addEventListener'
    && node.arguments[0]
    && ts.isStringLiteral(node.arguments[0])) {
    arListenerNames.add(node.arguments[0].text);
  }
  ts.forEachChild(node, visitAr);
};
visitAr(arSource);
if ([...arListenerNames].some((name) => !['ar-status', 'error', 'load'].includes(name))) {
  throw new Error(`Unexpected AR adapter listener: ${[...arListenerNames].join(', ')}`);
}

const contractSource = await readFile('ClassFunctionContracts.xml', 'utf8');
const contractIds = [...contractSource.matchAll(/<FUNCTION_CONTRACT id="([^"]+)"/g)].map((match) => match[1]);
const semanticIds = [...runtimeSources.values()]
  .flatMap((content) => [...content.matchAll(/<SEMANTIC_BLOCK id="([^"]+)"/g)].map((match) => match[1]));
const missingSemanticIds = contractIds.filter((id) => !semanticIds.includes(id));
const duplicateSemanticIds = semanticIds.filter((id, index) => semanticIds.indexOf(id) !== index);
if (missingSemanticIds.length > 0 || duplicateSemanticIds.length > 0) {
  throw new Error(`Semantic anchor mismatch; missing=${missingSemanticIds.join(', ')} duplicate=${duplicateSemanticIds.join(', ')}`);
}
const requirementsSource = await readFile('RequirementsAnalysis.xml', 'utf8');
for (const [name, content] of runtimeSources) {
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('<SEMANTIC_BLOCK id=')) continue;
    const metadata = lines.slice(index + 1, index + 3).join('');
    for (const tag of ['INTENT', 'REQUIREMENT', 'BUSINESS_PROCESS', 'MODULE', 'MODULE_CONTRACT', 'FUNCTION_CONTRACT']) {
      if (!metadata.includes(`<${tag}`)) throw new Error(`${name}:${index + 1} semantic block lacks ${tag}.`);
    }
    const requirement = metadata.match(/<REQUIREMENT ref="([^"]+)"/)?.[1];
    const process = metadata.match(/<BUSINESS_PROCESS ref="([^"]+)"/)?.[1];
    if (requirement === undefined || !requirementsSource.includes(`id="${requirement}"`)) {
      throw new Error(`${name}:${index + 1} references an unknown requirement.`);
    }
    if (process === undefined || !requirementsSource.includes(`id="${process}"`)) {
      throw new Error(`${name}:${index + 1} references an unknown business process.`);
    }
  }
}

const declaration = await readFile('dist/product-3d-widget.d.ts', 'utf8');
const source = ts.createSourceFile('product-3d-widget.d.ts', declaration, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
const expectedExports = [
  'AnimationConfig',
  'AvailabilityState',
  'CapabilityState',
  'ClipSource',
  'ColorVariantConfig',
  'CommandRejectionReason',
  'CommandResult',
  'ConfirmedSelection',
  'InitializationResult',
  'LifecycleState',
  'Product3DWidget',
  'Product3DWidgetState',
  'ProductConfiguration',
  'RangeSource',
  'ScenarioConfig',
  'ScenarioStepConfig',
  'StructuralVariantConfig',
  'WidgetError',
  'WidgetErrorCode',
  'WidgetEventName',
].sort();
const exportedNames = source.statements
  .filter((statement) => statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword))
  .map((statement) => statement.name?.text)
  .filter(Boolean)
  .sort();
if (JSON.stringify(exportedNames) !== JSON.stringify(expectedExports)) {
  throw new Error(`Unexpected public declarations: ${exportedNames.join(', ')}`);
}

const widget = source.statements.find((statement) => ts.isClassDeclaration(statement) && statement.name?.text === 'Product3DWidget');
if (widget === undefined || !ts.isClassDeclaration(widget)) throw new Error('Product3DWidget declaration is missing.');
const publicMethods = widget.members
  .filter(ts.isMethodDeclaration)
  .filter((member) => !member.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ProtectedKeyword || modifier.kind === ts.SyntaxKind.PrivateKeyword))
  .map((member) => member.name.getText(source))
  .sort();
if (JSON.stringify(publicMethods) !== JSON.stringify(expectedMethods)) {
  throw new Error(`Unexpected public methods: ${publicMethods.join(', ')}`);
}

const eventAlias = source.statements.find((statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'WidgetEventName');
if (eventAlias === undefined || !ts.isTypeAliasDeclaration(eventAlias) || !ts.isUnionTypeNode(eventAlias.type)) {
  throw new Error('WidgetEventName union is missing.');
}
const events = eventAlias.type.types
  .filter(ts.isLiteralTypeNode)
  .map((node) => node.literal)
  .filter(ts.isStringLiteral)
  .map((literal) => literal.text)
  .sort();
if (JSON.stringify(events) !== JSON.stringify(expectedEvents)) {
  throw new Error(`Unexpected public events: ${events.join(', ')}`);
}
if (/\bstopAnimation\b|scene-viewer|quick-look|selectedArMode|arMode\s*:/.test(declaration)) {
  throw new Error('Generated declarations expose an unapproved method or AR mode detail.');
}

const runtimeSource = runtimeSources.get('product-3d-widget.ts');
const parts = [...runtimeSource.matchAll(/part="([\w-]+)"/g)].map((match) => match[1]).filter((value) => value !== undefined);
if (JSON.stringify([...new Set(parts)].sort()) !== JSON.stringify(['error', 'loading', 'viewer'])) {
  throw new Error(`Unexpected CSS parts: ${[...new Set(parts)].join(', ')}`);
}
const properties = [...runtimeSource.matchAll(/--product-3d-[\w-]+/g)].map((match) => match[0]);
if (JSON.stringify([...new Set(properties)]) !== JSON.stringify(['--product-3d-aspect-ratio'])) {
  throw new Error(`Unexpected CSS custom properties: ${[...new Set(properties)].join(', ')}`);
}
const emittedEvents = [...runtimeSource.matchAll(/new CustomEvent\(['"](product-3d-[^'"]+)['"]/g)].map((match) => match[1]);
if ([...new Set(emittedEvents)].some((name) => !expectedEvents.includes(name))) {
  throw new Error(`Runtime emits an unapproved public event: ${[...new Set(emittedEvents)].join(', ')}`);
}

console.log('PASS exact runtime layout, three classes, 31 traced function anchors, 20 public declarations, ten methods, eight events, leaf boundaries and approved styling surface');
