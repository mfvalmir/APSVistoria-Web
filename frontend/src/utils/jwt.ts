export function decodeToken<T>(token: string): T | null {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const binario = atob(base64);
    // atob decodifica cada byte como um char Latin-1; para textos com acentuação
    // (UTF-8 multi-byte, ex: "ã" = 0xC3 0xA3) é preciso remontar os bytes antes do JSON.parse.
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const json = new TextDecoder("utf-8").decode(bytes);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}
