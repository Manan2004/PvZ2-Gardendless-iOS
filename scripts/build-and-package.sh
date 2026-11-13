#!/usr/bin/env bash
set -e

# ==============================================================================
# Build & Package Script for PvZ2: Gardendless iOS
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist"
IPA_PATH="$DIST_DIR/PvZ2_Gardendless.ipa"

echo "=== Building PvZ2: Gardendless iOS ==="

# 1. Sync web assets with Capacitor
echo "[1/4] Synchronizing Capacitor assets..."
cd "$ROOT_DIR"
npx cap sync ios

# 2. Build Xcode project
echo "[2/4] Building Xcode Release binary..."
cd "$ROOT_DIR/ios/App"
xcodebuild -project App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  build

# Find build product
DERIVED_APP="$(find ~/Library/Developer/Xcode/DerivedData/App-*/Build/Products/Release-iphoneos/App.app -maxdepth 0 2>/dev/null | head -n 1)"
if [ -z "$DERIVED_APP" ] || [ ! -d "$DERIVED_APP" ]; then
  echo "Error: Could not locate built App.app in DerivedData!"
  exit 1
fi
echo "  Found built App.app at: $DERIVED_APP"

# 3. Package IPA
echo "[3/4] Packaging IPA..."
mkdir -p "$DIST_DIR"
rm -rf /tmp/Payload
mkdir -p /tmp/Payload
cp -R "$DERIVED_APP" /tmp/Payload/
(cd /tmp && zip -r9 -q "$IPA_PATH" Payload)
rm -rf /tmp/Payload

FILE_SIZE=$(stat -f%z "$IPA_PATH")
echo "  IPA successfully packaged: $IPA_PATH"
echo "  Size: $FILE_SIZE bytes ($(ls -lh "$IPA_PATH" | awk '{print $5}'))"

# 4. Update apps.json with new size
echo "[4/4] Updating apps.json..."
node -e '
const fs = require("fs");
const path = require("path");
const appsPath = path.join(process.argv[1], "apps.json");
const pkg = JSON.parse(fs.readFileSync(path.join(process.argv[1], "package.json"), "utf8"));
const apps = JSON.parse(fs.readFileSync(appsPath, "utf8"));
const newSize = parseInt(process.argv[2], 10);
const curVer = pkg.version;
const buildNum = parseInt(curVer.replace(/\./g, ""), 10) || 1626;

const appEntry = apps.apps && apps.apps[0];
if (appEntry && appEntry.versions) {
  let existing = appEntry.versions.find(v => v.version === curVer);
  if (existing) {
    existing.size = newSize;
    existing.buildVersion = String(buildNum);
    existing.date = new Date().toISOString().split("T")[0];
  } else {
    appEntry.versions.unshift({
      version: curVer,
      buildVersion: String(buildNum),
      date: new Date().toISOString().split("T")[0],
      size: newSize,
      downloadURL: `https://github.com/Manan2004/PvZ2-Gardendless-iOS/releases/download/v${curVer}/PvZ2_Gardendless.ipa`,
      localizedDescription: `• Synchronized with PC version ${curVer}.\n• Complete touch controls, 120 FPS ProMotion, Auto-Collect, and Auto Fast-Forward.\n• Stability & crash protections for all plants and zombies.`,
      minOSVersion: "15.0"
    });
  }
}

// Update news if needed
if (apps.news && apps.news[0]) {
  apps.news[0].title = `PvZ2 Gardendless v${curVer} Released!`;
  apps.news[0].identifier = `pvz2-gardendless-${curVer.replace(/\./g, "-")}`;
  apps.news[0].caption = `Updated to PC version ${curVer} with Buduh Boom, crash fixes, and new audio files.`;
  apps.news[0].date = new Date().toISOString().split("T")[0];
}

fs.writeFileSync(appsPath, JSON.stringify(apps, null, 2) + "\n", "utf8");
console.log(`  Updated apps.json with version ${curVer}, size ${newSize} bytes.`);
' "$ROOT_DIR" "$FILE_SIZE"

echo ""
echo "======================================================"
echo " Build & packaging complete!"
echo " IPA: $IPA_PATH ($FILE_SIZE bytes)"
echo " To release: gh release create v$(node -p "require('$ROOT_DIR/package.json').version") dist/PvZ2_Gardendless.ipa"
echo "======================================================"
