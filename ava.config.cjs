module.exports = {
  extensions: { ts: 'module' },
  nodeArguments: ['--loader=ts-node/esm', '--no-warnings'],
  ignoredByWatcher: ['{coverage,dist,media}/**', '**/*.md', 'redisdata/**'],
  files: ['src/**/*.test.ts'],
}
