/**
 * Minimal Express-compatible router for Deno / Supabase Edge Functions.
 *
 * Express 4 does not run on Deno (its router relies on Node http internals, so
 * app(req,res) never dispatches a route or even its 404 handler). This
 * implements exactly the subset the TyreShop route files use, letting them run
 * unmodified:
 *
 *   express.Router()
 *   router.get/post/put/delete(path, ...middleware, handler)
 *   app.use(prefix, subRouter)
 *   req.params / req.query / req.body / req.headers / req.user
 *   res.status().json() / res.json() / res.send() / res.set()
 *
 * Note: no route file in this project uses router.use(), auth is applied
 * per-route as middleware arguments, which keeps the chain simple.
 */

export type Handler = (req: any, res: any, next?: (err?: unknown) => void) => unknown;

interface Route {
  method: string;
  path: string;
  handlers: Handler[];
}

interface Mount {
  prefix: string;
  router: Router;
}

export class Router {
  private routes: Route[] = [];
  private mounts: Mount[] = [];

  private add(method: string, path: string, handlers: Handler[]) {
    this.routes.push({ method, path, handlers });
    return this;
  }

  get(path: string, ...handlers: Handler[]) { return this.add('GET', path, handlers); }
  post(path: string, ...handlers: Handler[]) { return this.add('POST', path, handlers); }
  put(path: string, ...handlers: Handler[]) { return this.add('PUT', path, handlers); }
  delete(path: string, ...handlers: Handler[]) { return this.add('DELETE', path, handlers); }

  /** app.use(prefix, subRouter) */
  use(prefix: string, subRouter: Router) {
    this.mounts.push({ prefix, router: subRouter });
    return this;
  }

  /** Flatten nested routers into absolute routes, preserving registration order. */
  flatten(prefix = '/'): Route[] {
    const out: Route[] = [];

    for (const r of this.routes) {
      out.push({ ...r, path: joinPath(prefix, r.path) });
    }
    for (const m of this.mounts) {
      out.push(...m.router.flatten(joinPath(prefix, m.prefix)));
    }
    return out;
  }
}

function joinPath(prefix: string, p: string): string {
  if (!prefix || prefix === '/') return p || '/';
  if (!p || p === '/') return prefix;
  return (prefix.replace(/\/+$/, '') + '/' + p.replace(/^\/+/, '')).replace(/\/{2,}/g, '/');
}

const PARAM_RE = /:([A-Za-z_][A-Za-z0-9_]*)/g;

function compile(pattern: string) {
  const names: string[] = [];
  const escaped = pattern.replace(/[.+^${}()|[\]\\*?]/g, '\\$&');
  const source = escaped.replace(PARAM_RE, (_m, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  // Express matches "/x" and "/x/" alike, and a route path matches exactly.
  const re = new RegExp('^' + (source === '/' ? '/' : source) + '/?$');
  return { re, names };
}

export interface Resolved {
  route: Route;
  params: Record<string, string>;
}

/** First route matching method + path, or null. */
export function resolve(routes: Route[], method: string, path: string): Resolved | null {
  for (const route of routes) {
    if (route.method !== method) continue;
    const { re, names } = compile(route.path);
    const m = re.exec(path);
    if (!m) continue;

    const params: Record<string, string> = {};
    names.forEach((n, i) => {
      params[n] = safeDecode(m[i + 1]);
    });
    return { route, params };
  }
  return null;
}

function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/**
 * Run middleware + handler in order. A middleware that does not call next()
 * (e.g. after sending 401) ends the chain, exactly like Express.
 *
 * Two things make this non-obvious:
 *  1. Middleware calls next() WITHOUT awaiting it, so a single "current
 *     promise" reference is not enough.
 *  2. `await handler(...)` runs the handler SYNCHRONOUSLY up to its first
 *     await. A middleware that calls next() therefore schedules the rest of
 *     the chain *before* the outer promise variable is assigned - so a single
 *     variable gets overwritten and the inner work is never awaited.
 *
 * Collecting every scheduled promise and draining the list avoids both. The
 * list ends up innermost-first (the final handler is scheduled during the
 * synchronous part of the middleware above it), which is exactly the order we
 * need to await.
 */
export async function runChain(handlers: Handler[], req: any, res: any): Promise<void> {
  let i = 0;
  const scheduled: Promise<unknown>[] = [];

  const next = (err?: unknown): void => {
    if (err) {
      scheduled.push(Promise.reject(err));
      return;
    }
    if (i >= handlers.length) return;
    const handler = handlers[i++];
    scheduled.push(
      (async () => {
        await handler(req, res, next);
      })()
    );
  };

  next();

  for (let guard = 0; guard < scheduled.length; guard++) {
    await scheduled[guard];
  }
}

/* ---- express default-export shim -------------------------------------- */

const express: any = () => new Router();
express.Router = () => new Router();
express.json = () => async (_req: any, _res: any, next?: () => void) => next?.();
express.urlencoded = () => async (_req: any, _res: any, next?: () => void) => next?.();
express.static = () => async (_req: any, _res: any, next?: () => void) => next?.();

export default express;
