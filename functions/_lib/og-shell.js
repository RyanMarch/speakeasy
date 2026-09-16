/**
 * Shared HTML shell for the crawler-visible /share/:id and /drink/:id
 * routes: a minimal document with per-recipe <title>/OG tags plus a
 * meta-refresh + JS redirect into the real SPA route. Both routes render an
 * identical shell around different data (a shared custom recipe vs. a
 * bundled seed recipe), so the markup itself lives here once.
 */
export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderShell({ appUrl, title, description, imageUrl, canonicalUrl }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta http-equiv="refresh" content="0; url=${escapeHtml(appUrl)}">
<link rel="canonical" href="${escapeHtml(canonicalUrl)}">

<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(description)}">
<meta property="og:url" content="${escapeHtml(canonicalUrl)}">
${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">` : ''}

<meta name="theme-color" content="#020f20">
<script>location.replace(${JSON.stringify(appUrl)});</script>
</head>
<body style="background:#020f20;color:#f0eae1;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
  <p>Redirecting to <a href="${escapeHtml(appUrl)}" style="color:#ebbc72;">${escapeHtml(title)}</a>&hellip;</p>
</body>
</html>`;
}

export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html;charset=utf-8' },
  });
}
