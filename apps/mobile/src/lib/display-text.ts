/** Repairs legacy percent-encoded copy without touching ordinary percent signs. */
export function displayText(value: string) {
  if (!/%[0-9a-f]{2}/i.test(value)) return value;
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

