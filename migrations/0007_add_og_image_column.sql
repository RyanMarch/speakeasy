-- The share-preview image (og:image for link unfurls) is rendered client-side
-- at share-creation time — the browser already has the real SVG, real fonts,
-- and no CPU-time limit, unlike a Cloudflare Workers Free plan invocation
-- (10ms/request cap, too tight for WASM-based server-side rasterization).
-- The server's job is just to store and serve the resulting PNG bytes.
ALTER TABLE shares ADD COLUMN og_image BLOB;
