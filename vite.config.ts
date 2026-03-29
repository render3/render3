import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import checker from "vite-plugin-checker";

export default defineConfig(({ mode }) => {
    return {
        build: {
            lib: {
                entry: fileURLToPath(new URL("src/index.ts", import.meta.url)),
                name: "render3",
                fileName: format =>
                    mode === "development"
                        ? "render3.js"
                        : `render3.${format}.js`,
            },
            sourcemap: true,
            rollupOptions: {
                output: {
                    exports: "named",
                },
            },
        },
        test: {
            globals: true,
            environment: "jsdom",
            setupFiles: "./vitest-setup.ts",
        },
        plugins: [checker({ typescript: true })],
    };
});
