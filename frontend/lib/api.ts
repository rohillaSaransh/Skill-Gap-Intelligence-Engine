/**
 * Backend API base URL.
 * - Production (Netlify): set NEXT_PUBLIC_API_URL to your backend (e.g. Railway/Render).
 * - Local: defaults to http://localhost:3001.
 * No secrets—this is safe to expose to the browser.
 */
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
export default API_BASE;
