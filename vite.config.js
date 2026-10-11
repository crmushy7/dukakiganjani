import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Vivian MedicoHub",
        short_name: "Duka Kiganjani",
        description: "Medical store management system",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/vite.jpg",
            sizes: "192x192",
            type: "image/jpg"
          },
          {
            src: "/vite.jpg",
            sizes: "512x512",
            type: "image/jpg"
          }
        ]
      }
    })
  ]
});