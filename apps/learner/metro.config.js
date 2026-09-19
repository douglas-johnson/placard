// Metro only watches the project root, and the venue registry lives two levels up in
// data/venues/ (data/README.md). Watching that folder lets src/registry.ts import the
// JSON directly, so the phone and the corpus tools read the same file — no copy step
// that can silently go stale.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(__dirname, '../../data/venues'),
];

module.exports = config;
