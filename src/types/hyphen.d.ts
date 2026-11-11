// Бібліотека переносів слів без вбудованих типів
declare module "hyphen/uk" {
  export function hyphenateSync(text: string, options?: { hyphenChar?: string; minWordLength?: number }): string;
  export function hyphenate(text: string, options?: { hyphenChar?: string; minWordLength?: number }): Promise<string>;
}
