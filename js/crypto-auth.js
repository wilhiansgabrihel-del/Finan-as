const CryptoAuth = {
  async hashPassword(password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
    const saltB64 = btoa(String.fromCharCode(...salt));
    return `pbkdf2:${saltB64}:${hash}`;
  },

  async verifyPassword(password, stored) {
    if (!stored || !stored.startsWith("pbkdf2:")) {
      return btoa(unescape(encodeURIComponent(password))) === stored;
    }
    const [, saltB64, expectedHash] = stored.split(":");
    const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits"]
    );
    const bits = await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      256
    );
    const hash = btoa(String.fromCharCode(...new Uint8Array(bits)));
    return hash === expectedHash;
  },

  isLegacy(stored) {
    return stored && !stored.startsWith("pbkdf2:");
  },
};
