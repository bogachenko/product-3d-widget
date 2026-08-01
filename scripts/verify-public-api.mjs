import { readdir, readFile } from 'node:fs/promises';
import ts from 'typescript';

const expectedMethods = [
  'cancelCameraTransition',
  'configure',
  'focusOnNode',
  'focusOnNodes',
  'getState',
  'launchAR',
  'nextScenarioStep',
  'playAnimation',
  'previousScenarioStep',
  'restoreCameraView',
  'selectColor',
  'selectVariant',
  'setCameraView',
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

const declaration = await readFile('dist/product-3d-widget.d.ts', 'utf8');
const source = ts.createSourceFile('product-3d-widget.d.ts', declaration, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
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

const runtimeSource = await readFile('src/product-3d-widget.ts', 'utf8');
const parts = [...runtimeSource.matchAll(/part="([\w-]+)"/g)].map((match) => match[1]).filter((value) => value !== undefined);
if (JSON.stringify([...new Set(parts)].sort()) !== JSON.stringify(['error', 'loading', 'viewer'])) {
  throw new Error(`Unexpected CSS parts: ${[...new Set(parts)].join(', ')}`);
}
const properties = [...runtimeSource.matchAll(/--product-3d-[\w-]+/g)].map((match) => match[0]);
if (JSON.stringify([...new Set(properties)]) !== JSON.stringify(['--product-3d-aspect-ratio'])) {
  throw new Error(`Unexpected CSS custom properties: ${[...new Set(properties)].join(', ')}`);
}

console.log('PASS exact runtime layout, fifteen public methods, eight events and approved styling surface');
