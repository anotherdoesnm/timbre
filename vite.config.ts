import { defineConfig, type Plugin } from 'vite';
import vue from '@vitejs/plugin-vue';

/**
 * Dev-only escape hatch for CORS.
 *
 * A browser client on localhost cannot read an instance's discovery endpoints: neither
 * `/config.json` nor `/api/federation/instance-info` sends Access-Control-Allow-Origin.
 * In production that is solved by Tauri (fetches go through Rust) or by a relay; in dev
 * this middleware forwards `/__instance/<host>/<path>` to `https://<host>/<path>` from
 * Node, so the UI can be exercised against a real instance today.
 */
function instanceProxy(): Plugin {
  return {
    name: 'timbre-instance-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__instance', async (req, res) => {
        // connect strips the mount path, so req.url here starts with "/<host>/<path>"
        const match = /^(?:\/__instance)?\/([^/]+)(\/.*)$/.exec(req.url ?? '');
        if (!match) {
          res.statusCode = 400;
          res.end('expected /__instance/<host>/<path>');
          return;
        }
        const [, host, path] = match;
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) {
          res.statusCode = 400;
          res.end('bad host');
          return;
        }
        try {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (!v) continue;
            if (['host', 'connection', 'content-length', 'accept-encoding'].includes(k)) continue;
            headers[k] = Array.isArray(v) ? v.join(', ') : v;
          }
          const upstream = await fetch(`https://${host}${path}`, {
            headers,
            signal: AbortSignal.timeout(15000),
          });
          const body = Buffer.from(await upstream.arrayBuffer());
          res.statusCode = upstream.status;
          res.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        } catch (e) {
          res.statusCode = 502;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [vue(), instanceProxy()],
  server: { port: 5173 },
});
