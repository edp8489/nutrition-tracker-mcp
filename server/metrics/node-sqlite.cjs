// Test-only shim: Vite 5's resolver predates node:sqlite, so vite-node
// cannot import it directly (vitest runs under Node). Load it via
// createRequire instead. The server itself imports node:sqlite normally
// (Bun supports it natively); this shim is wired up only through the
// vitest alias in vite.config.ts.
const { createRequire } = require('node:module')
module.exports = createRequire(__filename)('node:sqlite')
