const JWT_SECRET = process.env.JWT_SECRET || "swami-samartha-mess-secret-key-super-secure-2026";

function base64urlEncode(str: string | ArrayBuffer): string {
  let bytes: Uint8Array;
  if (typeof str === "string") {
    bytes = new TextEncoder().encode(str);
  } else {
    bytes = new Uint8Array(str);
  }
  let base64 = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    base64 += String.fromCharCode(bytes[i]);
  }
  return btoa(base64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binStr = atob(base64);
  const bytes = new Uint8Array(binStr.length);
  for (let i = 0; i < binStr.length; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes;
}

export async function signToken(payload: Record<string, unknown>, expiresInSeconds = 259200): Promise<string> {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + expiresInSeconds;
  
  const fullPayload = {
    ...payload,
    iat: now,
    exp: exp,
  };

  const headerEncoded = base64urlEncode(JSON.stringify(header));
  const payloadEncoded = base64urlEncode(JSON.stringify(fullPayload));
  const dataToSign = `${headerEncoded}.${payloadEncoded}`;

  const encoder = new TextEncoder();
  const secretKeyData = encoder.encode(JWT_SECRET);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    secretKeyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(dataToSign)
  );

  const signatureEncoded = base64urlEncode(signature);
  return `${dataToSign}.${signatureEncoded}`;
}

export async function verifyToken(token: string): Promise<Record<string, any> | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const dataToVerify = `${headerEncoded}.${payloadEncoded}`;

    const encoder = new TextEncoder();
    const secretKeyData = encoder.encode(JWT_SECRET);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      secretKeyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const signatureBytes = base64urlDecode(signatureEncoded);
    const dataBytes = encoder.encode(dataToVerify);

    const isValid = await crypto.subtle.verify(
      "HMAC",
      cryptoKey,
      signatureBytes,
      dataBytes
    );

    if (!isValid) return null;

    const payloadJSON = new TextDecoder().decode(base64urlDecode(payloadEncoded));
    const payload = JSON.parse(payloadJSON);

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}
