import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "./env";
const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
export async function authorize(request: Request, env: Env): Promise<boolean> {
  if (
    !env.ACCESS_AUD ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN)
  )
    return false;
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!token) return false;
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  let keys = keySets.get(issuer);
  if (!keys) {
    keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
    keySets.set(issuer, keys);
  }
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer,
      audience: env.ACCESS_AUD,
      algorithms: ["RS256"],
    });
    return (
      typeof payload.email === "string" &&
      payload.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()
    );
  } catch {
    return false;
  }
}
export function sameOrigin(request: Request, env: Env): boolean {
  return request.headers.get("Origin") === new URL(env.APP_URL).origin;
}
