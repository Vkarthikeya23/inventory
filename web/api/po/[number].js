// Vercel Serverless Function - Purchase Order Viewer
//
// Mirrors web/api/invoice/[number].js. The PO HTML is rendered by the backend
// (supabase/functions/api/backend/src/routes/publicPo.js), which owns the
// database connection, so this function only proxies and never touches the DB.
//
// Why a proxy is needed at all: without it, /po/<number> matches the SPA
// catch-all rewrite ("/(.*)" -> "/index.html") in vercel.json. The browser gets
// the app shell, React Router finds no matching route, and the user silently
// lands on the dashboard instead of the PO. Routing PO links through
// /api/po/<number> gives them a real serverless function.
//
// Keeping the link on the Vercel domain matters: that domain stays reachable on
// networks (e.g. Jio) where the Supabase API host does not.

const BACKEND_URL = (
  process.env.BACKEND_URL || process.env.VITE_BASE_URL || 'http://localhost:4000'
).replace(/\/+$/, '');

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function notFoundPage(number) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head><meta charset="UTF-8"><title>Purchase Order Not Found</title></head>
    <body style="font-family: system-ui, sans-serif; padding: 40px; color: #2E2C27; background: #F7F5F0;">
      <h1>Purchase Order Not Found</h1>
      <p>The purchase order number "${escapeHtml(number)}" could not be found.</p>
    </body>
    </html>
  `;
}

export default async function handler(req, res) {
  const { number } = req.query;

  if (!number) {
    return res.status(400).send(notFoundPage('(missing)'));
  }

  try {
    // publicPoRoutes is mounted at "/" on the backend, not "/api".
    const upstream = await fetch(`${BACKEND_URL}/po/${encodeURIComponent(number)}`, {
      headers: { accept: 'text/html' }
    });

    if (upstream.status === 404) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(notFoundPage(number));
    }

    if (!upstream.ok) {
      throw new Error(`Backend responded ${upstream.status}`);
    }

    const html = await upstream.text();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head><meta charset="UTF-8"><title>Error</title></head>
      <body style="font-family: system-ui, sans-serif; padding: 40px; color: #2E2C27; background: #F7F5F0;">
        <h1>Server Error</h1>
        <p>${escapeHtml(err.message)}</p>
      </body>
      </html>
    `);
  }
}