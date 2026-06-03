import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Dev: proxy /api to the FastAPI backend. Prod: the backend serves the built
// bundle from dist/, so the same relative /api calls work with no CORS.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5180,
        proxy: {
            "/api": "http://127.0.0.1:8077",
        },
    },
    build: { outDir: "dist" },
});
