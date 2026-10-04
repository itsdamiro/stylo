import { copyFile, readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

/**
 * Dev-only endpoint so the playground loads and saves a real file instead of an
 * inlined string. `GET /api/doc` returns `playground/content/sample.md` (seeded
 * from `sample.template.md` on first run); `PUT` overwrites it. The scratch file
 * is gitignored, so playtesting never dirties the tree. Not part of the built
 * library.
 */
function playgroundDocApi(): Plugin {
  const dir = resolve(import.meta.dirname, "playground/content")
  const file = resolve(dir, "sample.md")
  const template = resolve(dir, "sample.template.md")
  const readDoc = async () => {
    try {
      return await readFile(file, "utf8")
    } catch {
      await copyFile(template, file)
      return readFile(file, "utf8")
    }
  }
  return {
    name: "playground-doc-api",
    configureServer(server) {
      server.middlewares.use("/api/doc", (req, res) => {
        void (async () => {
          try {
            if (req.method === "GET") {
              res.setHeader("Content-Type", "text/markdown; charset=utf-8")
              res.end(await readDoc())
            } else if (req.method === "PUT") {
              const body: Buffer[] = []
              for await (const chunk of req) body.push(chunk as Buffer)
              await writeFile(file, Buffer.concat(body).toString("utf8"))
              res.statusCode = 204
              res.end()
            } else {
              res.statusCode = 405
              res.end()
            }
          } catch (err) {
            res.statusCode = 500
            res.end(String(err))
          }
        })()
      })
    },
  }
}

// `vite` / `vite dev` serves the playground; `vite build` builds the library bundle.
export default defineConfig(({ command }) => ({
  plugins: [react(), playgroundDocApi()],
  root: command === "build" ? import.meta.dirname : resolve(import.meta.dirname, "playground"),
  build: {
    lib: {
      // Two entry points: the editor, and the opt-in toolbar customizer. The
      // output files take the object keys — `dist/stylo.js`,
      // `dist/toolbar-settings.js` — so `package.json` `exports` stay stable.
      entry: {
        stylo: resolve(import.meta.dirname, "src/index.ts"),
        "toolbar-settings": resolve(import.meta.dirname, "src/toolbar-settings/index.ts"),
      },
      formats: ["es"],
    },
    cssCodeSplit: false,
    sourcemap: true,
    // Single stylesheet, stable name: consumers import "@damiro/stylo/styles.css".
    rollupOptions: {
      // CodeMirror and Lezer are peer dependencies (ADR-008) — the host
      // installs one copy and Stylo shares it, so a single `@codemirror/state`
      // instance backs both. Keeping them out of the bundle is what makes that
      // real; `react` is external for the same reason.
      external: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        /^@codemirror\//,
        /^@lezer\//,
        /^@dnd-kit\//,
      ],
      output: {
        assetFileNames: "styles.css",
        // Name the vendor chunks honestly. Without this, Rollup names a shared
        // chunk after an arbitrary module inside it (the remark pipeline landed
        // on `callout`). Only the preview-side libraries are bundled now.
        manualChunks(id) {
          if (!id.includes("node_modules")) return
          if (/[\\/]katex[\\/]/.test(id)) return "katex"
          return "markdown"
        },
      },
    },
  },
}))
