/**
 * TyreShop Pro API — Supabase Edge Function
 *
 * Runs the existing Express route handlers on Deno. Mounts match the former
 * backend/src/app.js exactly, so request/response behaviour is unchanged.
 *
 * Incoming path: /functions/v1/api/<path>  ->  stripped to /<path>
 */
import './globals.ts';

import express, { resolve, runChain, type Route } from './express-lite.ts';

import authRoutes from './backend/src/routes/auth.js';
import productsRoutes from './backend/src/routes/products.js';
import servicesRoutes from './backend/src/routes/services.js';
import salesRoutes from './backend/src/routes/sales.js';
import reportsRoutes from './backend/src/routes/reports.js';
import invoicesRoutes from './backend/src/routes/invoices.js';
import purchaseOrderRoutes from './backend/src/routes/purchaseOrders.js';
import publicInvoiceRoutes from './backend/src/routes/publicInvoice.js';
import publicPoRoutes from './backend/src/routes/publicPo.js';

const FUNCTION_PREFIX = '/functions/v1/api';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type,Authorization,apikey,x-client-info,x-supabase-api-version',
  'Access-Control-Max-Age': '86400',
};

const health = (express as any)();

// Liveness + which database this function is actually talking to.
health.get('/health', async (_req: any, res: any) => {
  try {
    const { get } = await import('./backend/src/db/db.js');
    const r = await get('SELECT count(*)::int AS n FROM sales');
    res.status(200).json({
      status: 'ok',
      db: 'supabase',
      runtime: 'deno-edge',
      sales: r?.n ?? null,
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: String(err).slice(0, 200) });
  }
});

// Mounts mirror backend/src/app.js
const root = (express as any)();
root.use('/', health);
root.use('/', publicInvoiceRoutes);      // public: /invoice/:invoice_number
root.use('/api', publicInvoiceRoutes);   // same page under /api for the Vercel proxy
root.use('/', publicPoRoutes);           // public: /po/:po_number
root.use('/auth', authRoutes);
root.use('/products', productsRoutes);
root.use('/services', servicesRoutes);
root.use('/sales', salesRoutes);
root.use('/reports', reportsRoutes);
root.use('/invoices', invoicesRoutes);
root.use('/purchase-orders', purchaseOrderRoutes);

const ROUTES: Route[] = root.flatten('/');

function makeRes(): any {
  const res: any = {
    statusCode: 200,
    headersSent: false,
    _headers: {} as Record<string, string>,
    setHeader(k: string, v: string) {
      this._headers[String(k).toLowerCase()] = v;
    },
    getHeader(k: string) {
      return this._headers[String(k).toLowerCase()];
    },
    removeHeader(k: string) {
      delete this._headers[String(k).toLowerCase()];
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    set(k: string, v: string) {
      this.setHeader(k, v);
      return this;
    },
    json(payload: unknown) {
      if (!this.getHeader('content-type')) this.setHeader('content-type', 'application/json');
      this._body = JSON.stringify(payload);
      this.headersSent = true;
      return this;
    },
    send(payload: unknown) {
      if (payload !== null && typeof payload === 'object') {
        if (!this.getHeader('content-type')) this.setHeader('content-type', 'application/json');
        this._body = JSON.stringify(payload);
      } else if (typeof payload === 'string' && !this.getHeader('content-type')) {
        this.setHeader('content-type', 'text/html; charset=utf-8');
        this._body = payload;
      } else {
        this._body = payload === undefined || payload === null ? '' : String(payload);
      }
      this.headersSent = true;
      return this;
    },
    end(payload?: unknown) {
      if (payload !== undefined && payload !== null) this._body = String(payload);
      this.headersSent = true;
      return this;
    },
    write(chunk: unknown) {
      this._body = (this._body ?? '') + String(chunk);
      return true;
    },
  };
  return res;
}

Deno.serve(async (request: Request) => {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Strip the Supabase function prefix so routes see their normal paths.
  let path = url.pathname.startsWith(FUNCTION_PREFIX)
    ? url.pathname.slice(FUNCTION_PREFIX.length)
    : url.pathname;
  if (!path.startsWith('/')) path = '/' + path;
  if (path.length > 1 && path.endsWith('/')) path = path.replace(/\/+$/, '');

  const res = makeRes();

  try {
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v;
    });

    let body: unknown;
    if (method !== 'GET' && method !== 'HEAD') {
      const raw = await request.text();
      if (raw) {
        const ct = headers['content-type'] ?? '';
        if (ct.includes('application/json')) {
          try {
            body = JSON.parse(raw);
          } catch {
            body = undefined;
          }
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          body = Object.fromEntries(new URLSearchParams(raw));
        } else {
          body = raw;
        }
      }
    }

    const req: any = {
      method,
      url: request.url,
      path,
      originalUrl: request.url,
      query: Object.fromEntries(url.searchParams),
      params: {},
      body,
      headers,
      get(name: string) {
        return headers[String(name).toLowerCase()];
      },
      on() {},
    };

    const match = resolve(ROUTES, method, path);

    if (!match) {
      res.status(404).json({ error: 'Not found' });
    } else {
      req.params = match.params;
      await runChain(match.route.handlers, req, res);
      if (!res.headersSent) res.status(res.statusCode).json({ error: 'No response sent' });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[api] handler error:', message);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }

  const headersOut: Record<string, string> = { ...CORS_HEADERS, ...res._headers };
  const payload = res._body ?? '';
  const bodyOut = typeof payload === 'string' ? payload : JSON.stringify(payload);

  return new Response(bodyOut, {
    status: res.statusCode,
    headers: headersOut,
  });
});
