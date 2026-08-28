// Anonymous session, no login: a cookie minted on first page load keys this
// visitor's copy of the seeded incident. The same named middleware guards
// capability dispatches, so page loads, browser-client calls, form posts, and
// WebMCP tool calls all resolve the same session.
import type { MiddlewareFn } from "@pracht/core";
import { SESSION_COOKIE, sessionIdFrom } from "../server/store.ts";
// Every request runs this middleware, so importing the audit sink here keeps
// it registered before any capability dispatch completes.
import "../server/audit.ts";

export const middleware: MiddlewareFn = async ({ request, context }, next) => {
  const existing = sessionIdFrom(request);
  const sessionId = existing ?? crypto.randomUUID();
  context.sessionId = sessionId;

  const isCapabilityDispatch = new URL(request.url).pathname.startsWith("/api/capabilities/");
  if (!existing && isCapabilityDispatch) {
    // Tool and client calls never mint sessions; the page does that. A
    // dispatch without one is a caller outside any session — refuse it.
    return new Response(
      JSON.stringify({ error: "no_session", message: "Load the page first so a session exists." }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const response = await next();
  if (existing) return response;

  const cookie = `${SESSION_COOKIE}=${sessionId}; Path=/; Max-Age=604800; SameSite=Lax; HttpOnly`;
  try {
    response.headers.append("set-cookie", cookie);
    return response;
  } catch {
    const patched = new Response(response.body, response);
    patched.headers.append("set-cookie", cookie);
    return patched;
  }
};
