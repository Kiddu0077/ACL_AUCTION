import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";
import { createServerClient } from "@supabase/ssr";

import { getAdminDestination } from "../lib/admin-navigation.ts";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const projectUrl = "https://auth-speed-test.supabase.co";
const cookieName = "sb-auth-speed-test-auth-token";
const userId = "76b4f358-94a8-4b59-92c5-2c79bb91f390";
const keys = await crypto.subtle.generateKey(
  { name: "ECDSA", namedCurve: "P-256" },
  true,
  ["sign", "verify"],
);
const jwk = {
  ...(await crypto.subtle.exportKey("jwk", keys.publicKey)),
  kid: "auth-test-key",
  alg: "ES256",
  use: "sig",
};
const now = () => Math.floor(Date.now() / 1000);
const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

async function token(overrides = {}, signingKey = keys.privateKey) {
  const header = { alg: "ES256", typ: "JWT", kid: jwk.kid };
  const claims = {
    sub: userId,
    aud: "authenticated",
    role: "authenticated",
    iss: `${projectUrl}/auth/v1`,
    iat: now(),
    exp: now() + 3600,
    ...overrides,
  };
  const input = `${encode(header)}.${encode(claims)}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    signingKey,
    new TextEncoder().encode(input),
  );
  return `${input}.${Buffer.from(signature).toString("base64url")}`;
}

function session(accessToken, expiresAt = now() + 3600) {
  return {
    access_token: accessToken,
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: expiresAt,
    user: { id: userId, aud: "authenticated", role: "authenticated" },
  };
}

function request(path, authSession, method = "GET") {
  const headers = new Headers();
  if (authSession) headers.set("cookie", `${cookieName}=base64-${encode(authSession)}`);
  if (method === "POST") headers.set("Next-Action", "test-action");
  return new NextRequest(`https://league.test${path}`, { headers, method });
}

// Execute the real middleware with the real Supabase SDK. Only its network
// transport is substituted, so JWT signature, expiry and refresh behavior run.
function harness({ refreshedSession, acceptedSymmetricToken = false } = {}) {
  const requests = [];
  const code = ts.transpileModule(
    readFileSync(new URL("../lib/supabase/middleware.ts", import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const sdk = {
    createServerClient(_url, _key, options) {
      return createServerClient(projectUrl, "test-anon-key", {
        ...options,
        global: {
          fetch: async (url, init) => {
            requests.push({ url: String(url), method: init?.method });
            if (String(url).endsWith("/.well-known/jwks.json")) {
              return Response.json({ keys: [jwk] });
            }
            if (String(url).includes("/token?grant_type=refresh_token")) {
              return refreshedSession
                ? Response.json(refreshedSession)
                : Response.json({ code: "refresh_token_not_found", error_code: "refresh_token_not_found", msg: "Expired session" }, { status: 400 });
            }
            if (String(url).endsWith("/user")) {
              return acceptedSymmetricToken
                ? Response.json({ id: userId })
                : Response.json({ code: "bad_jwt", msg: "Invalid token" }, { status: 401 });
            }
            throw new Error(`Unexpected network request: ${url}`);
          },
        },
      });
    },
  };
  const module = { exports: {} };
  new Function("require", "module", "exports", code)(
    (name) => name === "@supabase/ssr" ? sdk : require(name),
    module,
    module.exports,
  );
  return { updateSession: module.exports.updateSession, requests };
}

test("anonymous admin pages and action POSTs stay gated, including login subpaths", async () => {
  const { updateSession, requests } = harness();
  for (const [path, method] of [["/admin/auction", "GET"], ["/admin/auction", "POST"], ["/admin/login/extra", "GET"]]) {
    const response = await updateSession(request(path, null, method));
    assert.equal(response.status, 307);
    const target = new URL(response.headers.get("location"));
    assert.equal(target.pathname, "/admin/login");
    assert.equal(target.searchParams.get("next"), path);
  }
  const login = await updateSession(request("/admin/login"));
  assert.equal(login.headers.get("x-middleware-next"), "1");
  assert.equal(requests.length, 0);
});

test("signed claims allow pages and POSTs; warmed verification has no Auth round trip", async () => {
  const { updateSession, requests } = harness();
  const authSession = session(await token());
  const first = await updateSession(request("/admin/dashboard", authSession));
  assert.equal(first.headers.get("x-middleware-next"), "1");
  const afterFirst = requests.length;
  const action = await updateSession(request("/admin/auction", authSession, "POST"));
  assert.equal(action.headers.get("x-middleware-next"), "1");
  assert.equal(requests.length, afterFirst);
  assert.equal(requests.some(({ url }) => url.endsWith("/user")), false);
});

test("forged signatures cannot authenticate by copying a user into the cookie", async () => {
  const forgedKeys = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const { updateSession } = harness();
  const response = await updateSession(request("/admin/auction", session(await token({}, forgedKeys.privateKey))));
  assert.equal(new URL(response.headers.get("location")).pathname, "/admin/login");
});

test("JWT expiry is checked independently of the cookie expiry", async () => {
  const { updateSession } = harness();
  const response = await updateSession(request("/admin/auction", session(await token({ exp: now() - 60 }))));
  assert.equal(new URL(response.headers.get("location")).pathname, "/admin/login");
});

test("symmetric tokens still require an Auth-server verification", async () => {
  const symmetricToken = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, exp: now() + 3600 })}.${Buffer.from("test-signature").toString("base64url")}`;
  for (const acceptedSymmetricToken of [false, true]) {
    const { updateSession, requests } = harness({ acceptedSymmetricToken });
    const response = await updateSession(request("/admin/auction", session(symmetricToken)));
    assert.equal(response.headers.get("x-middleware-next"), acceptedSymmetricToken ? "1" : null);
    assert.equal(requests.filter(({ url }) => url.endsWith("/user")).length, 1);
  }
});

test("a login redirect preserves refreshed cookies and private cache headers", async () => {
  const fresh = session(await token());
  const { updateSession, requests } = harness({ refreshedSession: fresh });
  const incoming = request("/admin/login", session(await token({ exp: now() - 60 }), now() - 60));
  const response = await updateSession(incoming);
  assert.equal(new URL(response.headers.get("location")).pathname, "/admin/dashboard");
  assert.ok(response.cookies.getAll().some(({ name, value }) => name.startsWith(cookieName) && value));
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.ok(requests.some(({ url }) => url.includes("grant_type=refresh_token")));
  assert.ok(incoming.cookies.getAll().some(({ name, value }) => name.startsWith(cookieName) && value));
});

test("a rejected refresh clears the cookie on the login redirect", async () => {
  const { updateSession } = harness();
  const response = await updateSession(request("/admin/auction", session(await token({ exp: now() - 60 }), now() - 60)));
  assert.equal(new URL(response.headers.get("location")).pathname, "/admin/login");
  assert.ok(response.cookies.getAll().some(({ name, value, maxAge }) => name.startsWith(cookieName) && value === "" && maxAge === 0));
  assert.match(response.headers.get("cache-control"), /private.*no-store/);
});

test("login destinations preserve admin links and reject redirects outside admin", () => {
  assert.equal(getAdminDestination("/admin/auction?pool=A#current"), "/admin/auction?pool=A#current");
  for (const value of [null, "", "https://outside.test", "//outside.test", "javascript:alert(1)", "/admin/../players", "/admin/%2e%2e/players", "/admin/login", "/admin/login/", "/admin/\\outside.test", "/admin/\nauction"]) {
    assert.equal(getAdminDestination(value), "/admin/dashboard");
  }
});
