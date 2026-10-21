import {defineConfig} from 'vitest/config';
export default defineConfig({test:{include:['tests/**/*.test.ts','packages/maze-core/src/__tests__/**/*.test.ts'],testTimeout:30000}});
