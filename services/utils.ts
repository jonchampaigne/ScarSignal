
/**
 * Generates a unique ID (UUID v4 style) safe for all contexts.
 * Fallback for environments where crypto.randomUUID is not available (e.g. HTTP).
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Safely parses JSON string, returning null if failed instead of throwing.
 */
export function safeJSONParse<T>(str: string | null): T | null {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    return null;
  }
}
