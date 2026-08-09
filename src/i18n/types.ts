/**
 * Catalogue value shapes.
 *
 * A leaf module on purpose: the English catalogue derives the key union, the
 * translator imports the catalogues, and every other locale imports the type
 * the English one produced. Putting these two types anywhere else makes that
 * chain circular.
 */

/**
 * A message with grammatical number.
 *
 * The optional arms exist for languages English does not need them for. Greek
 * is one/other like English, but Polish distinguishes few (2–4) from many
 * (5+), and Dutch is one/other again — so the shape has to allow arms the
 * source language will never fill. `other` is the required fallback because
 * every CLDR plural set has one.
 */
export interface PluralMessage {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type Message = string | PluralMessage;

export function isPlural(m: Message): m is PluralMessage {
  return typeof m !== 'string';
}
