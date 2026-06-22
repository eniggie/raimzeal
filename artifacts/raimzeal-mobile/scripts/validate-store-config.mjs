import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const projectRoot = new URL("../", import.meta.url);
const appConfig = JSON.parse(await readFile(new URL("app.json", projectRoot), "utf8")).expo;
const permissionsSource = await readFile(new URL("contexts/PermissionsContext.tsx", projectRoot), "utf8");
const shareCardSource = await readFile(new URL("lib/shareCard.ts", projectRoot), "utf8");

assert.equal(appConfig.ios?.bundleIdentifier, "app.replit.raimzeal");
assert.equal(appConfig.ios?.usesAppleSignIn, true);
assert.ok(Number(appConfig.ios?.buildNumber) >= 27, "iOS build number must remain monotonic");
assert.notEqual(appConfig.ios?.infoPlist?.NSAppTransportSecurity?.NSAllowsArbitraryLoads, true);

assert.equal(appConfig.android?.package, "com.econteur.raimzeal");
assert.ok(Number(appConfig.android?.versionCode) >= 26, "Android version code must remain monotonic");

const requested = new Set(appConfig.android?.permissions ?? []);
const blocked = new Set(appConfig.android?.blockedPermissions ?? []);
for (const permission of [
  "android.permission.READ_EXTERNAL_STORAGE",
  "android.permission.WRITE_EXTERNAL_STORAGE",
  "android.permission.READ_MEDIA_IMAGES",
  "android.permission.READ_MEDIA_AUDIO",
  "android.permission.READ_MEDIA_VIDEO",
  "android.permission.RECORD_AUDIO",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.USE_EXACT_ALARM",
]) {
  assert.equal(requested.has(permission), false, `${permission} must not be requested`);
  assert.equal(blocked.has(permission), true, `${permission} must remain blocked`);
}

assert.match(permissionsSource, /MediaLibrary\.getPermissionsAsync\(true,\s*\[\]\)/);
assert.match(permissionsSource, /MediaLibrary\.requestPermissionsAsync\(true,\s*\[\]\)/);
assert.match(shareCardSource, /MediaLibrary\.requestPermissionsAsync\(true,\s*\[\]\)/);

console.log("Store release configuration validation passed.");
