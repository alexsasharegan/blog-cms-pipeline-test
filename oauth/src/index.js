// Decap CMS login for GitHub, as a Cloudflare Worker.
//   GET /auth      sends the editor to GitHub to approve (with a one-time state kept in a cookie).
//   GET /callback  GitHub returns here with a code; we trade it for a token and pass it to the editor window.
// The token goes only to env.ALLOWED_ORIGIN, through postMessage, and is never stored or logged.

const COOKIE = "oauth_state";

const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

function page(body, status = 200, extraHeaders = {}) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-robots-tag": "noindex",
      ...extraHeaders,
    },
  });
}

function auth(url, env) {
  const state = hex(crypto.getRandomValues(new Uint8Array(16)));
  const authorize = new URL("https://github.com/login/oauth/authorize");
  authorize.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorize.searchParams.set("redirect_uri", `${url.origin}/callback`);
  authorize.searchParams.set("scope", env.SCOPE || "public_repo");
  authorize.searchParams.set("state", state);
  return new Response(null, {
    status: 302,
    headers: {
      location: authorize.toString(),
      "set-cookie": `${COOKIE}=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
      "cache-control": "no-store",
    },
  });
}

// JSON placed inside a <script>: escape "<" so the data cannot close the tag.
const inScript = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

function handoff(env, ok, payload) {
  const message = ok
    ? `authorization:github:success:${JSON.stringify({ token: payload, provider: "github" })}`
    : `authorization:github:error:${JSON.stringify({ message: payload })}`;
  return page(
    `<!doctype html><meta charset="utf-8"><title>Signing in</title><p>Signing in…</p><script>
(function () {
  var target = ${inScript(env.ALLOWED_ORIGIN)};
  var message = ${inScript(message)};
  function receive(e) {
    if (e.origin !== target) return;
    window.opener.postMessage(message, target);
    window.removeEventListener("message", receive);
    window.close();
  }
  window.addEventListener("message", receive);
  window.opener.postMessage("authorizing:github", target);
})();
</script>`,
    ok ? 200 : 400,
    { "set-cookie": `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0` },
  );
}

async function callback(url, request, env) {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = (request.headers.get("cookie") || "")
    .split(/;\s*/)
    .find((c) => c.startsWith(`${COOKIE}=`));
  const expected = cookie ? cookie.slice(COOKIE.length + 1) : "";
  if (!code || !state || !expected || state !== expected) {
    return handoff(env, false, "The sign-in could not be verified. Close this window and try again.");
  }
  let data;
  try {
    const res = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "user-agent": "decap-login-worker" },
      body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
    });
    data = await res.json();
  } catch {
    return handoff(env, false, "GitHub could not be reached. Try again.");
  }
  if (!data || !data.access_token) {
    return handoff(env, false, "GitHub did not return a token" + (data && data.error ? ` (${data.error}).` : "."));
  }
  return handoff(env, true, data.access_token);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
      return page("The login is not set up yet: missing secrets.", 503);
    }
    if (url.pathname === "/auth") return auth(url, env);
    if (url.pathname === "/callback") return callback(url, request, env);
    return new Response("Not found", { status: 404 });
  },
};
