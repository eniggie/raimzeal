import { mkdirSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stubDir = resolve(workspaceRoot, 'node_modules/react-native-worklets');
const pluginDir = resolve(stubDir, 'plugin');

mkdirSync(pluginDir, { recursive: true });
writeFileSync(
  resolve(stubDir, 'package.json'),
  JSON.stringify({ name: 'react-native-worklets', version: '0.5.1', main: 'plugin/index.js' }),
);
writeFileSync(resolve(pluginDir, 'index.js'), 'module.exports = { visitor: {} };\n');
console.log('[postinstall] Created react-native-worklets stub (dev-server only)');
