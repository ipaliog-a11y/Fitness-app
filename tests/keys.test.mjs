/**
 * Did a message key reach the screen instead of its translation?
 *
 * This is the bug that has now shipped three times — `Z1 zone.recovery.name`
 * in the heart report, then `geo.noPosition` and an untranslated "GPS lock"
 * side by side on the live run screen. Every time, the same cause:
 *
 *     type MessageKey = keyof typeof en   // …which is a string
 *
 * so `{zone.name}` compiles, renders the key, and no amount of reading catches
 * it. The catalogue types cannot help: they guarantee every key *has* a
 * translation, not that anybody asked for one.
 *
 * Text scanning cannot help either, and that is the point of this file. To a
 * regex, `{t(key)}` and `{key}` are the same handful of characters; the
 * difference lives entirely in the type. So this asks the TypeScript compiler
 * instead: for every expression rendered into the DOM, what type is it, and is
 * that type a message key?
 *
 * The browser sweep in i18n.test.mjs would find these too, but only on screens
 * it can drive itself into — it never reached a GPS error state, which is how
 * two of the three survived it. A type check has no such blind spot: an
 * unreachable screen is checked exactly as well as the home tab.
 *
 *   npm run test:keys
 */

import ts from 'typescript';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Attributes whose value a person reads.
 *
 * `className` and `id` are strings too, and flagging those would drown the
 * signal. These are the ones that reach a screen or a screen reader.
 */
const TEXT_ATTRS = new Set(['label', 'title', 'placeholder', 'aria-label', 'alt', 'emptyLabel']);

/**
 * Bare strings that are legitimately rendered as themselves.
 *
 * Punctuation and symbols mostly. Anything with real words in it belongs in
 * the catalogue, so this list stays short on purpose.
 */
const ALLOWED_LITERALS = new Set([
  // Units, written the same in Greek prose.
  'km/h', 'mph', 'km', 'mi', 'bpm', 'spm',
  // The app's own name.
  'runlog',
  // ARIA and CSS values that happen to be words.
  'auto', 'none', 'page', 'off', 'on', 'polite', 'assertive',
]);

const configPath = ts.findConfigFile(ROOT, ts.sys.fileExists, 'tsconfig.json');
const parsed = ts.parseJsonConfigFileContent(
  ts.readConfigFile(configPath, ts.sys.readFile).config,
  ts.sys,
  ROOT,
);
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();

/**
 * Every key in the catalogue, taken from the type rather than from the file.
 *
 * `keyof typeof en` resolves to a union of string-literal types, so the
 * compiler will hand over the whole list — and it cannot drift out of step
 * with the catalogue the way a regex over en.ts would.
 */
function messageKeys() {
  const source = program.getSourceFile(join(ROOT, 'src/i18n/en.ts'));
  if (!source) throw new Error('cannot find src/i18n/en.ts in the program');
  let keys = null;
  ts.forEachChild(source, (node) => {
    if (!ts.isTypeAliasDeclaration(node) || node.name.text !== 'MessageKey') return;
    const type = checker.getTypeAtLocation(node.name);
    const parts = type.isUnion() ? type.types : [type];
    keys = new Set(parts.filter((t) => t.isStringLiteral()).map((t) => t.value));
  });
  if (!keys || keys.size === 0) throw new Error('could not read the MessageKey union');
  return keys;
}

const KEYS = messageKeys();

/**
 * The string literals a type can be, or null when it can be something else.
 *
 * `undefined` and `null` are dropped first: `geoDetail ?? 'fallback'` has type
 * `MessageKey | undefined` at the point it is rendered, and the optionality is
 * not what is interesting about it.
 */
function literalValues(type) {
  const parts = type.isUnion() ? type.types : [type];
  const values = [];
  for (const part of parts) {
    if (part.flags & (ts.TypeFlags.Undefined | ts.TypeFlags.Null | ts.TypeFlags.Never)) continue;
    if (!part.isStringLiteral()) return null;
    values.push(part.value);
  }
  return values.length > 0 ? values : null;
}

const leaks = [];
const literals = [];

/** Is this expression rendered, rather than merely computed? */
function renderedExpression(node) {
  if (!ts.isJsxExpression(node) || !node.expression) return false;
  const parent = node.parent;
  // A child of an element: <span>{…}</span>
  if (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) return true;
  // The value of an attribute a person reads: title={…}
  if (ts.isJsxAttribute(parent)) {
    const name = parent.name.getText();
    return TEXT_ATTRS.has(name);
  }
  return false;
}

/**
 * Calls whose argument is said or shown to a person.
 *
 * Not every string built from a key is a bug. The opposite, in fact: plan
 * completion is persisted under `${week}-${dayOfWeek}-${title}`, and the
 * *untranslated* key is exactly right there, because an identity that changed
 * with the interface language would orphan every tick the moment someone
 * switched to Greek. React keys and DOM ids are the same story.
 *
 * So rather than suspect every template literal, follow the handful of
 * functions that reach a person. This is where the spoken cues are built, and
 * where a workout came to announce itself as "workout dot kind dot work".
 */
const SINKS = new Set(['speak', 'onToast', 'showToast']);

function sinkArguments(node) {
  if (!ts.isCallExpression(node)) return [];
  const callee = ts.isPropertyAccessExpression(node.expression)
    ? node.expression.name.getText()
    : node.expression.getText();
  if (!SINKS.has(callee)) return [];
  const out = [];
  for (const arg of node.arguments) {
    if (ts.isTemplateExpression(arg)) out.push(...arg.templateSpans.map((s) => s.expression));
    else out.push(arg);
  }
  return out;
}

/**
 * Split an expression into the values it can actually produce.
 *
 * Typing the whole thing is not enough, and this is the trap the first version
 * of this file fell into. `geoDetail ?? t('run.gpsUnavailable')` has one arm of
 * type MessageKey and one of type string, and a union with `string` in it *is*
 * `string` — so the expression looks innocent and the leak in the first arm is
 * invisible. Both of the bugs that prompted this check had that shape.
 *
 * So descend through the operators that choose between values and judge each
 * arm on its own.
 */
function branches(expr) {
  if (ts.isParenthesizedExpression(expr)) return branches(expr.expression);
  if (ts.isConditionalExpression(expr)) {
    return [...branches(expr.whenTrue), ...branches(expr.whenFalse)];
  }
  if (ts.isBinaryExpression(expr)) {
    const op = expr.operatorToken.kind;
    // Either side of these can end up being the value shown.
    if (op === ts.SyntaxKind.QuestionQuestionToken || op === ts.SyntaxKind.BarBarToken) {
      return [...branches(expr.left), ...branches(expr.right)];
    }
    /*
     * `cond && <div/>` is the guard idiom, and only the right side is ever
     * rendered as a value — when the left is truthy it is discarded, and when
     * it is falsy React draws nothing. Treating it as a candidate reported
     * `confirmAction` ('finish' | 'discard') as untranslated copy.
     */
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return branches(expr.right);
  }
  return [expr];
}

function where(node) {
  const source = node.getSourceFile();
  const { line } = source.getLineAndCharacterOfPosition(node.getStart());
  return `${relative(ROOT, source.fileName)}:${line + 1}`;
}

for (const source of program.getSourceFiles()) {
  if (source.isDeclarationFile) continue;
  if (!/\.tsx?$/.test(source.fileName)) continue;
  if (!source.fileName.startsWith(join(ROOT, 'src'))) continue;

  const inspect = (expr, rendered) => {
    const values = literalValues(checker.getTypeAtLocation(expr));
    if (!values) return;
    const text = expr.getText().replace(/\s+/g, ' ').slice(0, 56);
    if (values.every((v) => KEYS.has(v))) {
      /*
       * Every value this can take is a key in the catalogue. A t() call
       * returns plain `string` and never lands here, so whatever this is,
       * nobody translated it.
       */
      const what =
        values.length > 4 ? `MessageKey (${values.length} of them)` : values.join(', ');
      leaks.push(`${where(expr)}  ${text}  → ${what}`);
    } else if (
      rendered &&
      values.every((v) => !KEYS.has(v)) &&
      values.some((v) => /[A-Za-z]{3}/.test(v) && !ALLOWED_LITERALS.has(v.toLowerCase()))
    ) {
      // Prose written straight into an expression, where the text scan in
      // i18n.test.mjs cannot see it — this is how "GPS lock" survived.
      literals.push(`${where(expr)}  ${text}  → ${values.join(' | ')}`);
    }
  };

  const visit = (node) => {
    if (renderedExpression(node)) {
      for (const branch of branches(node.expression)) inspect(branch, true);
    }
    for (const arg of sinkArguments(node)) {
      for (const branch of branches(arg)) inspect(branch, false);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (leaks.length > 0) {
  console.error(`\n${leaks.length} message keys rendered without t():\n`);
  for (const leak of leaks) console.error(`  ${leak}`);
  console.error(
    '\nMessageKey is a string, so this compiles and prints the key itself.\n' +
      'Wrap it: {t(key)}.\n',
  );
}

if (literals.length > 0) {
  console.error(`\n${literals.length} untranslated strings rendered from an expression:\n`);
  for (const literal of literals) console.error(`  ${literal}`);
  console.error(
    '\nGive each one a key in src/i18n/en.ts and src/i18n/el.ts, or add it to\n' +
      'ALLOWED_LITERALS here if it is genuinely not words.\n',
  );
}

if (leaks.length > 0 || literals.length > 0) process.exit(1);

console.log(`✓ no leaked message keys (${KEYS.size} keys, ${program.getSourceFiles().length} files)`);
