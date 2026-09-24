import { exportJWK, exportPKCS8, generateKeyPair } from "jose"

/**
 * Signing keys for Convex Auth v2, in the format `npx @convex-dev/auth`
 * produces: a base64-encoded PKCS#8 PEM and a JWKS with a matching `kid`.
 */
export async function generateAuthKeys() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  })
  const pem = await exportPKCS8(privateKey)
  const jwk = await exportJWK(publicKey)
  return {
    AUTH_PRIVATE_KEY: Buffer.from(pem).toString("base64"),
    AUTH_JWKS: JSON.stringify({
      keys: [{ ...jwk, kid: crypto.randomUUID(), alg: "RS256", use: "sig" }],
    }),
  }
}
