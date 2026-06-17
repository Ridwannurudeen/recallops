const ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="8" fill="#0e0a06" />
  <path d="M18 18h28v28H18z" fill="none" stroke="#d4a85f" stroke-width="4" />
  <path d="M24 32h16M32 24v16" stroke="#fdfbf6" stroke-width="4" stroke-linecap="round" />
</svg>`;

export function GET() {
  return new Response(ICON, {
    headers: {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": "image/svg+xml",
    },
  });
}
