import path from 'path';
import {defineConfig} from 'vite';
import legacy from '@vitejs/plugin-legacy';

export default defineConfig(() => {
  return {
    plugins: [
      legacy({
        targets: ['firefox 48'],
      }),
      {
        name: 'strip-simulator',
        transformIndexHtml(html) {
          if (process.env.NODE_ENV === 'production') {
            // Remove elements with data-simulator attribute
            return html.replace(/<[^>]*data-simulator[^>]*>([\s\S]*?)<\/[^>]*>/g, '')
                       .replace(/<[^>]*data-simulator[^>]*\/>/g, '');
          }
          return html;
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        external: ['phaser'],
        output: {
          globals: {
            phaser: 'Phaser'
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
