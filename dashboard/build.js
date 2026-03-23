const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/dashboard.js'],
  bundle:      true,
  outfile:     'public/bundle.js',
  platform:    'browser',
  target:      ['es2020'],
  minify:      false,
  sourcemap:   false,
}).then(() => {
  console.log('Build OK → public/bundle.js');
}).catch(err => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
