import { afterEach, describe, expect, it, vi } from "vitest";
import { generateKeyPair, SignJWT, createLocalJWKSet, exportJWK } from "jose";
import type { Env } from "../src/server/env";
const mocks = vi.hoisted(() => ({ keys: vi.fn() }));
vi.mock("jose", async (original) => ({
  ...(await original<typeof import("jose")>()),
  createRemoteJWKSet: () => mocks.keys,
}));
import { authorize, sameOrigin } from "../src/server/auth";
const env = {
  ACCESS_AUD: "app-audience",
  ACCESS_TEAM_DOMAIN: "owner.cloudflareaccess.com",
  OWNER_EMAIL: "owner@example.com",
  APP_URL: "https://invoices.example.com",
} as Env;
afterEach(() => vi.clearAllMocks());
describe("Access protection", () => {
  it("fails closed without configured audience", async () =>
    expect(
      await authorize(new Request(env.APP_URL), { ...env, ACCESS_AUD: "" }),
    ).toBe(false));
  it("does not trust an identity header without a JWT", async () =>
    expect(
      await authorize(
        new Request(env.APP_URL, {
          headers: { "Cf-Access-Authenticated-User-Email": env.OWNER_EMAIL },
        }),
        env,
      ),
    ).toBe(false));
  it.each(["owner", "other-owner", "wrong-audience", "expired"])(
    "validates signed identity: %s",
    async (kind) => {
      const { privateKey, publicKey } = await generateKeyPair("RS256");
      const jwk = await exportJWK(publicKey);
      mocks.keys.mockImplementation(
        createLocalJWKSet({ keys: [{ ...jwk, kid: "test", alg: "RS256" }] }),
      );
      const jwt = await new SignJWT({
        email:
          kind === "other-owner" ? "attacker@example.com" : env.OWNER_EMAIL,
      })
        .setProtectedHeader({ alg: "RS256", kid: "test" })
        .setIssuer(`https://${env.ACCESS_TEAM_DOMAIN}`)
        .setAudience(kind === "wrong-audience" ? "another-app" : env.ACCESS_AUD)
        .setExpirationTime(kind === "expired" ? "0s" : "5m")
        .sign(privateKey);
      expect(
        await authorize(
          new Request(env.APP_URL, {
            headers: { "Cf-Access-Jwt-Assertion": jwt },
          }),
          env,
        ),
      ).toBe(kind === "owner");
    },
  );
  it("rejects cross-origin and missing-origin mutations", () => {
    expect(sameOrigin(new Request(env.APP_URL), env)).toBe(false);
    expect(
      sameOrigin(
        new Request(env.APP_URL, { headers: { Origin: "https://evil.test" } }),
        env,
      ),
    ).toBe(false);
    expect(
      sameOrigin(
        new Request(env.APP_URL, { headers: { Origin: env.APP_URL } }),
        env,
      ),
    ).toBe(true);
  });
});
