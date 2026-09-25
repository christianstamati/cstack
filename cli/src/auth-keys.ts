/**
 * Signing keys for Convex Auth v2, in the format `npx @convex-dev/auth`
 * produces: a base64-encoded PKCS#8 PEM and a JWKS with a matching `kid`.
 */
export async function generateAuthKeys() {
  const { privateKey, publicKey } = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  )

  const der = await crypto.subtle.exportKey("pkcs8", privateKey)
  const body =
    Buffer.from(der)
      .toString("base64")
      .match(/.{1,64}/g) ?? []
  const pem = `-----BEGIN PRIVATE KEY-----\n${body.join("\n")}\n-----END PRIVATE KEY-----`

  const { kty, n, e } = await crypto.subtle.exportKey("jwk", publicKey)

  return {
    AUTH_PRIVATE_KEY: Buffer.from(pem).toString("base64"),
    AUTH_JWKS: JSON.stringify({
      keys: [{ kty, n, e, kid: crypto.randomUUID(), alg: "RS256", use: "sig" }],
    }),
  }
}
