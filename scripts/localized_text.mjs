// Build-time localized text: every value is { zh, en, ja }. Sentences come from
// keyed templates in content/i18n/messages/{language}.json; arguments are either
// localized values (such as authoritative item names) or language-neutral values.
import fs from 'node:fs';

export const LANGUAGES = ['zh', 'en', 'ja'];

export function createLocalizedText(root = '.') {
  const messages = Object.fromEntries(LANGUAGES.map((language) => [
    language, JSON.parse(fs.readFileSync(`${root}/content/i18n/messages/${language}.json`, 'utf8')),
  ]));
  const localized = (build) => Object.fromEntries(LANGUAGES.map((language) => [language, build(language)]));
  const valueIn = (value, language) => (value !== null && typeof value === 'object' ? value[language] : String(value));
  /** A keyed template with {name} arguments. */
  const text = (key, args = {}) => localized((language) => {
    const template = messages[language][key];
    if (typeof template !== 'string') throw new Error(`Missing ${language} message: ${key}`);
    return template.replace(/\{(\w+)\}/g, (_, name) => {
      if (args[name] === undefined) throw new Error(`Missing argument ${name} for message ${key}`);
      return valueIn(args[name], language);
    });
  });
  /** Localized values joined with a keyed separator. */
  const join = (values, separatorKey) => {
    const separator = text(separatorKey);
    return localized((language) => values.map((value) => valueIn(value, language)).join(separator[language]));
  };
  /** The same value in every language (numbers, codes, proper names kept in English). */
  const same = (value) => localized(() => String(value));
  return { text, join, same, localized };
}
