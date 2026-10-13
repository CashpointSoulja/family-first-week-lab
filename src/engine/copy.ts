/** Phrases the product must never say: diagnosis, medical advice, prediction or false safety. */
export const BANNED_PHRASES: RegExp[] = [
  /diagnos/i, /dementia/i, /alzheimer/i, /\bUTI\b/, /infection/i, /dehydrat/i, /fall risk/i, /fallen/i,
  /see a (doctor|gp)/i, /medical advice/i, /will (fall|decline)/i, /predict/i, /at risk/i, /everything is (fine|ok)/i,
  /safe and well/i, /all is well/i, /nothing to worry/i, /emergency/i,
];

export function findBanned(text: string): string[] {
  return BANNED_PHRASES.filter((r) => r.test(text)).map((r) => r.source);
}
