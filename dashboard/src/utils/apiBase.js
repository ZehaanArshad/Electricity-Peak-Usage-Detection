/**
 * Returns the base URL for all API requests.
 *
 * - In development (Vite proxy active):  empty string  →  calls go to /api/...
 *   and are proxied by Vite to http://localhost:3001
 * - In production (Vercel):              the full Render URL from VITE_API_URL
 *   so calls go to https://your-api.onrender.com/api/...
 */
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export default API_BASE;
