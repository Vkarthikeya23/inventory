/**
 * Mobile app endpoints.
 *
 * These were previously two copies of a hardcoded LAN address
 * (http://192.168.1.100:4000) pointing at the old Node backend, which no longer
 * exists. Both are defined once here so they cannot drift apart again.
 */

// Backend API — Supabase Edge Function (Deno). Not the same host as the web app.
export const API_BASE_URL =
  'https://covfkgjpufbsbcxagkgm.supabase.co/functions/v1/api';

// Public web app, on Vercel. Customer-facing invoice links deliberately point
// here rather than at the API host: invoice pages have to stay reachable on
// networks (e.g. Jio) that block Supabase.
export const PUBLIC_WEB_URL = 'https://inventory-green-eight.vercel.app';

export const INVOICE_URL_BASE = `${PUBLIC_WEB_URL}/api/invoice`;