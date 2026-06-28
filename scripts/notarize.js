/**
 * Post-sign notarization hook for electron-builder (macOS).
 *
 * When APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID env vars are set,
 * this submits the signed app to Apple's notarization service.
 * In CI/dev builds without credentials, it exits cleanly as a no-op.
 *
 * Referenced in electron-builder.yml as: afterSign
 */

'use strict';

const { execSync } = require('node:child_process');
const { platform } = require('node:process');

module.exports = async function notarize({ appBundleId, appPath }) {
  if (platform !== 'darwin') return;

  const { APPLE_ID, APPLE_ID_PASSWORD, APPLE_TEAM_ID } = process.env;
  if (!APPLE_ID || !APPLE_ID_PASSWORD || !APPLE_TEAM_ID) {
    console.log('[notarize] Skipping — APPLE_ID / APPLE_ID_PASSWORD / APPLE_TEAM_ID not set.');
    return;
  }

  console.log(`[notarize] Submitting ${appBundleId} (${appPath}) for notarization…`);

  execSync(
    `xcrun notarytool submit "${appPath}" --apple-id "${APPLE_ID}" --password "${APPLE_ID_PASSWORD}" --team-id "${APPLE_TEAM_ID}" --wait`,
    { stdio: 'inherit' }
  );

  execSync(`xcrun stapler staple "${appPath}"`, { stdio: 'inherit' });
  console.log('[notarize] Done.');
};
