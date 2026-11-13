#!/usr/bin/env node
/**
 * Automated Upstream Updater for PvZ2: Gardendless iOS
 * 
 * Usage:
 *   node scripts/update-from-upstream.js [releaseHash]
 * 
 * If releaseHash is omitted, it auto-detects the latest release from play.pvzge.com
 * and version info from https://pvzge.com/jsons/gameinfo.json.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const WWW_DIR = path.join(ROOT_DIR, 'www');

// Cocos Creator UUID decoder
const ed = "0123456789abcdef".split("");
const id = ["", "", "", ""];
const nd = id.concat(id, "-", id, "-", id, "-", id, "-", id, id, id);
const rd = nd.map((t, e) => ("-" === t ? NaN : e)).filter(Number.isFinite);
const Ge = [];
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
for (let i = 0; i < BASE64.length; i++) Ge[BASE64.charCodeAt(i)] = i;

function decodeUuid(t) {
  const e = t.split("@")[0];
  if (22 !== e.length) return t;
  nd[0] = t[0]; nd[1] = t[1];
  for (let i = 2, n = 2; i < 22; i += 2) {
    const r = Ge[t.charCodeAt(i)], s = Ge[t.charCodeAt(i + 1)];
    nd[rd[n++]] = ed[r >> 2];
    nd[rd[n++]] = ed[(3 & r) << 2 | s >> 4];
    nd[rd[n++]] = ed[15 & s];
  }
  return t.replace(e, nd.join(""));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchText(res.headers.location));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadBinary(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadBinary(res.headers.location, destPath));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', reject);
  });
}

async function runPool(items, concurrency, fn) {
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i], i);
    }
  }
  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
}

async function main() {
  console.log('=== PvZ2: Gardendless Upstream Updater ===\n');

  // 1. Determine upstream version and release hash
  console.log('[1/8] Fetching upstream release metadata...');
  let version = '0.16.26';
  let gameInfo = null;
  try {
    const rawInfo = await fetchText('https://pvzge.com/jsons/gameinfo.json');
    gameInfo = JSON.parse(rawInfo);
    version = gameInfo.InsideVersion || gameInfo.Version?.replace(/^v/, '') || version;
    console.log(`  Upstream Game Version: ${version} (${gameInfo.Name || ''})`);
  } catch (e) {
    console.warn('  Warning: Could not fetch gameinfo.json, defaulting to:', version);
  }

  let releaseHash = process.argv[2];
  if (!releaseHash) {
    const homeHtml = await fetchText('https://play.pvzge.com/');
    const baseMatch = homeHtml.match(/<base\s+href="\/releases\/([a-f0-9]+)\/?"/i);
    if (!baseMatch) {
      throw new Error('Could not parse release hash from play.pvzge.com');
    }
    releaseHash = baseMatch[1];
  }
  console.log(`  Target Release Hash: ${releaseHash}`);
  const baseUrl = `https://play.pvzge.com/releases/${releaseHash}/`;
  console.log(`  Base URL: ${baseUrl}\n`);

  // 2. Fetch upstream configs
  console.log('[2/8] Fetching upstream configuration files...');
  const [rawResourcesConfig, rawAudioManifest, rawMainConfig, rawInternalConfig, rawIndexJs] = await Promise.all([
    fetchText(`${baseUrl}assets/resources/config.json`),
    fetchText(`${baseUrl}audio/manifest.json`),
    fetchText(`${baseUrl}assets/main/config.json`),
    fetchText(`${baseUrl}assets/internal/config.json`),
    fetchText(`${baseUrl}assets/main/index.js`)
  ]);

  const upResourcesConfig = JSON.parse(rawResourcesConfig);
  const upAudioManifest = JSON.parse(rawAudioManifest);
  const upMainConfig = JSON.parse(rawMainConfig);
  const upInternalConfig = JSON.parse(rawInternalConfig);

  // 3. Compare with local files to find missing assets
  console.log('[3/8] Scanning for missing packs, standalone files, and audio...');
  const localImport = path.join(WWW_DIR, 'assets/resources/import');
  const localNative = path.join(WWW_DIR, 'assets/resources/native');
  const localAudio = path.join(WWW_DIR, 'audio');

  const packs = new Set(Object.keys(upResourcesConfig.packs || {}));
  const missingPacks = [];
  for (const p of packs) {
    const pPath = path.join(localImport, p.slice(0, 2), `${p}.json`);
    if (!fs.existsSync(pPath)) {
      missingPacks.push(p);
    }
  }

  const packedIndices = new Set();
  for (const list of Object.values(upResourcesConfig.packs || {})) {
    for (const idx of list) packedIndices.add(idx);
  }

  const missingStandalone = [];
  for (let i = 0; i < (upResourcesConfig.uuids || []).length; i++) {
    if (packedIndices.has(i)) continue;
    const raw = upResourcesConfig.uuids[i];
    if (packs.has(raw)) continue;
    const decoded = decodeUuid(raw);
    const pJson = path.join(localImport, decoded.slice(0, 2), `${decoded}.json`);
    const pCconb = path.join(localImport, decoded.slice(0, 2), `${decoded}.cconb`);
    if (!fs.existsSync(pJson) && !fs.existsSync(pCconb)) {
      missingStandalone.push({ raw, decoded });
    }
  }

  // Audio files
  let localAudioManifest = {};
  try {
    localAudioManifest = JSON.parse(fs.readFileSync(path.join(localAudio, 'manifest.json'), 'utf8'));
  } catch (_) {}

  const missingAudio = [];
  for (const [k, relPath] of Object.entries(upAudioManifest)) {
    const audioPath = path.join(localAudio, relPath);
    if (!fs.existsSync(audioPath) || !localAudioManifest[k]) {
      missingAudio.push(relPath);
    }
  }

  console.log(`  Missing packs: ${missingPacks.length}`);
  console.log(`  Missing standalone files: ${missingStandalone.length}`);
  console.log(`  Missing / updated audio files: ${missingAudio.length}\n`);

  // 4. Download missing assets concurrently
  console.log('[4/8] Downloading missing assets from upstream CDN...');
  if (missingPacks.length > 0) {
    process.stdout.write(`  Downloading ${missingPacks.length} packs: `);
    await runPool(missingPacks, 6, async (p) => {
      const rel = `assets/resources/import/${p.slice(0, 2)}/${p}.json`;
      await downloadBinary(baseUrl + rel, path.join(WWW_DIR, rel));
      process.stdout.write('.');
    });
    console.log(' Done.');
  }

  if (missingStandalone.length > 0) {
    process.stdout.write(`  Downloading ${missingStandalone.length} standalone files: `);
    await runPool(missingStandalone, 6, async (s) => {
      const rel = `assets/resources/import/${s.decoded.slice(0, 2)}/${s.decoded}.json`;
      await downloadBinary(baseUrl + rel, path.join(WWW_DIR, rel));
      process.stdout.write('.');
    });
    console.log(' Done.');
  }

  if (missingAudio.length > 0) {
    process.stdout.write(`  Downloading ${missingAudio.length} audio clips: `);
    await runPool(missingAudio, 6, async (a) => {
      const rel = `audio/${a}`;
      await downloadBinary(baseUrl + rel, path.join(WWW_DIR, rel));
      process.stdout.write('.');
    });
    console.log(' Done.');
  }

  // Save new configs
  fs.writeFileSync(path.join(localAudio, 'manifest.json'), rawAudioManifest, 'utf8');
  fs.writeFileSync(path.join(WWW_DIR, 'assets/resources/config.json'), rawResourcesConfig, 'utf8');
  fs.writeFileSync(path.join(WWW_DIR, 'assets/main/config.json'), rawMainConfig, 'utf8');
  fs.writeFileSync(path.join(WWW_DIR, 'assets/internal/config.json'), rawInternalConfig, 'utf8');
  console.log('  Updated manifest.json and bundle config.jsons.\n');

  // 5. Audio compatibility pass (.m4a -> .mp3 in pack JSONs)
  console.log('[5/8] Running audio extension compatibility pass (.m4a -> .mp3)...');
  let filesPatched = 0;
  let totalReplaced = 0;
  function patchM4aDir(dir) {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory()) {
        patchM4aDir(p);
      } else if (f.endsWith('.json')) {
        let content = fs.readFileSync(p, 'utf8');
        if (content.includes('.m4a')) {
          const count = (content.match(/\.m4a/g) || []).length;
          content = content.replace(/\.m4a/g, '.mp3');
          fs.writeFileSync(p, content, 'utf8');
          filesPatched++;
          totalReplaced += count;
        }
      }
    }
  }
  patchM4aDir(localImport);
  console.log(`  Patched ${filesPatched} files (total ${totalReplaced} .m4a references changed to .mp3).\n`);

  // 6. Apply iOS adaptations to assets/main/index.js
  console.log('[6/8] Applying iOS engine adaptations to assets/main/index.js...');
  let patchedJs = rawIndexJs;

  // A. Splash scene SFX loading error guard (prevents startup freeze)
  const splashTarget = 'b.load("resouce_prefabs/SoundsRP",w,(function(t,n){n?e(n):r(t)}))';
  const splashReplacement = 'b.load("resouce_prefabs/SoundsRP",w,(function(t,n){n?e(n):(console.warn("[Loading] Warning:",t),e(null))}))';
  if (patchedJs.includes(splashTarget)) {
    patchedJs = patchedJs.replace(splashTarget, splashReplacement);
    console.log('  [+] Applied splashScene loadSFXs error guard.');
  } else {
    console.warn('  [-] splashScene loadSFXs target not found.');
  }

  // B. Auto-Collect in dropping.ts
  const dropTarget1 = 'b.AutoCollectList.includes(this.DroppingType)&&this.collect()';
  const dropReplacement1 = '((window.__autoCollectEnabled!==false&&this.collect()),b.AutoCollectList.includes(this.DroppingType))&&this.collect()';
  if (patchedJs.includes(dropTarget1)) {
    patchedJs = patchedJs.replace(dropTarget1, dropReplacement1);
    console.log('  [+] Applied Auto-Collect to dropping.ts.');
  }

  // C. Auto-Collect list in levelController.ts
  const levelTarget = '{key:"AutoCollectList",get:function(){return this.component?this.component.AutoCollectList:[]}}';
  const levelReplacement = '{key:"AutoCollectList",get:function(){return window.__autoCollectEnabled!==false?(this.component&&this.component.AutoCollectList&&this.component.AutoCollectList.length?this.component.AutoCollectList:["sun","coin","gem","sprout","ticket","plantfood"]):(this.component?this.component.AutoCollectList:[])}}';
  if (patchedJs.includes(levelTarget)) {
    patchedJs = patchedJs.replace(levelTarget, levelReplacement);
    console.log('  [+] Applied universal AutoCollectList to levelController.ts.');
  }

  // D. Auto Fast-Forward in UI.ts
  const uiTarget = 'this.s2xButton.node.on(h.EventType.MOUSE_DOWN,(function(e){t.paused||t.speedUp()}))';
  const uiReplacement = 'this.s2xButton.node.on(h.EventType.MOUSE_DOWN,(function(e){t.paused||t.speedUp()})),window.__autoFastForwardEnabled!==false&&1==Wt&&this.speedUp(!1)';
  if (patchedJs.includes(uiTarget)) {
    patchedJs = patchedJs.replace(uiTarget, uiReplacement);
    console.log('  [+] Applied Auto Fast-Forward to UI.ts.');
  }

  // E. Plant crash guards for ThreePeater, FirePeashooter, ElectricPeashooter, ColdSnapDragon
  // ThreePeater UpperLane / LowerLane null check
  const threepeaterTarget = 'this.inLane.zombiePool().concat(this.inLane.UpperLane.zombiePool(),this.inLane.LowerLane.zombiePool())';
  const threepeaterReplacement = '(this.inLane.zombiePool()).concat((this.inLane.UpperLane&&this.inLane.UpperLane.zombiePool)?this.inLane.UpperLane.zombiePool():[],(this.inLane.LowerLane&&this.inLane.LowerLane.zombiePool)?this.inLane.LowerLane.zombiePool():[])';
  if (patchedJs.includes(threepeaterTarget)) {
    patchedJs = patchedJs.replace(threepeaterTarget, threepeaterReplacement);
    console.log('  [+] Applied lane row bounds check to ThreePeater.');
  }

  // ElectricPeashooter UpperLane / LowerLane null check
  const electricTarget = 'this.inLane.UpperLane.zombiePool().concat(this.inLane.LowerLane.zombiePool())';
  const electricReplacement = '((this.inLane&&this.inLane.UpperLane&&this.inLane.UpperLane.zombiePool)?this.inLane.UpperLane.zombiePool():[]).concat((this.inLane&&this.inLane.LowerLane&&this.inLane.LowerLane.zombiePool)?this.inLane.LowerLane.zombiePool():[])';
  if (patchedJs.includes(electricTarget)) {
    patchedJs = patchedJs.replace(electricTarget, electricReplacement);
    console.log('  [+] Applied lane row bounds check to ElectricPeashooter.');
  }

  // FirePeashooter tntPool null check
  const fireTarget = 'this.inLane.tntPool().concat(this.inLane.UpperLane.tntPool(),this.inLane.LowerLane.tntPool())';
  const fireReplacement = '(this.inLane&&this.inLane.tntPool?this.inLane.tntPool():[]).concat((this.inLane&&this.inLane.UpperLane&&this.inLane.UpperLane.tntPool)?this.inLane.UpperLane.tntPool():[],(this.inLane&&this.inLane.LowerLane&&this.inLane.LowerLane.tntPool)?this.inLane.LowerLane.tntPool():[])';
  if (patchedJs.includes(fireTarget)) {
    patchedJs = patchedJs.replace(fireTarget, fireReplacement);
    console.log('  [+] Applied lane row bounds check to FirePeashooter.');
  }

  // ColdSnapDragon iceTiles null check
  const coldTarget = 'this.inLane.iceTiles.some((function(n){var t;return!n.lnc||(null==(t=n.lnc)?void 0:t.cIndex)>o.cIndex}))';
  const coldReplacement = 'Boolean(this.inLane&&Array.isArray(this.inLane.iceTiles)&&this.inLane.iceTiles.some((function(n){var t;return n&&(!n.lnc||(null==(t=n.lnc)?void 0:t.cIndex)>o.cIndex)})))';
  if (patchedJs.includes(coldTarget)) {
    patchedJs = patchedJs.replace(coldTarget, coldReplacement);
    console.log('  [+] Applied iceTiles safe check to ColdSnapDragon.');
  }

  fs.writeFileSync(path.join(WWW_DIR, 'assets/main/index.js'), patchedJs, 'utf8');
  console.log('  Saved updated and patched assets/main/index.js.\n');

  // 7. Update version numbers across files
  console.log('[7/8] Bumping version numbers...');
  const buildNum = parseInt(version.replace(/\./g, '')) || 1626;

  // package.json
  const pkgPath = path.join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  console.log(`  Updated package.json -> ${version}`);

  // Info.plist
  const plistPath = path.join(ROOT_DIR, 'ios/App/App/Info.plist');
  if (fs.existsSync(plistPath)) {
    let plist = fs.readFileSync(plistPath, 'utf8');
    plist = plist.replace(/<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/, `<key>CFBundleShortVersionString<\/key>\n\t<string>${version}<\/string>`);
    plist = plist.replace(/<key>CFBundleVersion<\/key>\s*<string>[^<]+<\/string>/, `<key>CFBundleVersion<\/key>\n\t<string>${buildNum}<\/string>`);
    fs.writeFileSync(plistPath, plist, 'utf8');
    console.log(`  Updated Info.plist -> ${version} (${buildNum})`);
  }

  // index.html title
  const htmlPath = path.join(WWW_DIR, 'index.html');
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, 'utf8');
    html = html.replace(/<title>PvZ2 Gardendless Online \| [^<]+<\/title>/, `<title>PvZ2 Gardendless Online | ${version}</title>`);
    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`  Updated index.html title -> ${version}`);
  }

  // tmpPatch.js version string
  const tmpPatchPath = path.join(WWW_DIR, 'tmpPatch.js');
  if (fs.existsSync(tmpPatchPath)) {
    let tmpPatch = fs.readFileSync(tmpPatchPath, 'utf8');
    tmpPatch = tmpPatch.replace(/Version:\s*"v[^"]+"/, `Version: "v${version}"`);
    tmpPatch = tmpPatch.replace(/InsideVersion:\s*"[^"]+"/, `InsideVersion: "${version}"`);
    fs.writeFileSync(tmpPatchPath, tmpPatch, 'utf8');
    console.log(`  Updated tmpPatch.js version -> ${version}`);
  }

  // 8. Capacitor sync
  console.log('\n[8/8] Syncing Capacitor iOS project...');
  execSync('npx cap sync ios', { cwd: ROOT_DIR, stdio: 'inherit' });

  console.log('\n======================================================');
  console.log(` Upstream upgrade to v${version} completed successfully!`);
  console.log(' Next step: run ./scripts/build-and-package.sh to build IPA.');
  console.log('======================================================\n');
}

main().catch(err => {
  console.error('\nUpdate failed with error:', err);
  process.exit(1);
});
