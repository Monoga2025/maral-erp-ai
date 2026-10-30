# frontend

React 18 single-page app for MARAL OS, built with Vite 5 and TypeScript.

- `src/`: app code (pages, components, store, API client, PWA hooks). See `src/README.md`.
- `public/`: PWA manifest, service worker and icons. See `public/README.md`.
- `nginx.conf` and `Dockerfile`: production image. Nginx serves the build on port 80 and proxies `/api` and `/uploads` to the backend.
- `vite.config.ts`: dev server on port 5173, with `/api` proxied to `http://localhost:3001`.

Scripts: `dev`, `build` (`tsc && vite build`), `typecheck`, `preview`.
