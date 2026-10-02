// Vercel Serverless Function - Invoice Viewer
//
// The invoice HTML is rendered by the backend (backend/src/routes/publicInvoice.js),
// which owns the database connection. This function deliberately does NOT talk
// to the database directly:
//
//   * Vercel's function runtime (us-east-1) has its TCP connection to
//     Supabase (ap-northeast-2) reset - ECONNRESET on every attempt.
//   * Vercel -> Railway Postgres has always worked, so the backend is the
//     reachable path.
//   * Keeping invoice links on the Vercel domain matters: that domain stays
//     reachable on networks (e.g. Jio) where the API host does not.
//
// This also removes a 500-line duplicate of the invoice template that had to
// be kept in sync with the backend by hand.

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
    <head><meta charset="UTF-8"><title>Invoice Not Found</title></head>
    <body style="font-family: system-ui, sans-serif; padding: 40px; color: #2E2C27; background: #F7F5F0;">
      <h1>Invoice Not Found</h1>
      <p>The invoice number "${escapeHtml(number)}" could not be found.</p>
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
    const upstream = await fetch(`${BACKEND_URL}/api/invoice/${encodeURIComponent(number)}`, {
      headers: { accept: 'text/html' }
    });

    if (upstream.status === 404) {
      return res.status(404).type('html').send(notFoundPage(number));
    }

    if (!upstream.ok) {
      throw new Error(`Backend responded ${upstream.status}`);
    }

    const html = await upstream.text();
    return res.status(200).type('html').send(html);
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