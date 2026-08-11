import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

// Standard TanStack Start + Vite setup. Nitro's default production preset is
// a standalone Node.js server ("node-server"), which is what the deploy
// targets in the README (Render/Railway) expect — no extra config needed.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      srcDirectory: "src",
      // src/server.ts wraps the default SSR handler to render a friendly
      // fallback page instead of a bare error on an unexpected crash.
      server: { entry: "./src/server.ts" },
    }),
    viteReact(),
    nitro(),
  ],
});
