import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	plugins: [sveltekit()],
	// Remult declares entities with legacy TypeScript decorators. Vite 8 transforms
	// with Oxc rather than esbuild, which does not read `experimentalDecorators` from
	// tsconfig.json — it has to be turned on here or `@Entity` fails to parse.
	oxc: {
		decorator: { legacy: true }
	},
	resolve: {
		alias: {
			// Declared explicitly so `vite-node scripts/ingest.ts` resolves $lib the
			// same way the app does, without relying on SvelteKit's generated tsconfig.
			$lib: fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	}
	// Vitest reads this config for the $lib alias and the decorator transform; its
	// default test glob already covers src/**/*.test.ts, so it needs no `test` block.
});
