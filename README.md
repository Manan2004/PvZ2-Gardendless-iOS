# Plants vs. Zombies 2: Gardendless (iOS Port)
### 植保2: 花园无尽 — Native iOS & iPadOS Port (v0.16.1)

A native iOS and iPadOS port of the popular fan-made PC game **Plants vs. Zombies 2: Gardendless (植物大战僵尸2: 花园无尽)**, built with Capacitor and Cocos Creator.

[![Release](https://img.shields.io/github/v/release/Manan2004/PvZ2-Gardendless-iOS?color=green&label=Download%20IPA)](https://github.com/Manan2004/PvZ2-Gardendless-iOS/releases)
[![Platform](https://img.shields.io/badge/Platform-iOS%20%7C%20iPadOS-blue)](https://github.com/Manan2004/PvZ2-Gardendless-iOS)
[![Architecture](https://img.shields.io/badge/Arch-arm64-orange)](https://github.com/Manan2004/PvZ2-Gardendless-iOS)
[![Engine](https://img.shields.io/badge/Engine-Cocos%20Creator%203.x-lightgrey)](https://github.com/Manan2004/PvZ2-Gardendless-iOS)

---

## 📱 How to Install & Play

You do **not** need a Mac or Xcode to play! Download the pre-built `.ipa` binary from the [**Releases Tab**](https://github.com/Manan2004/PvZ2-Gardendless-iOS/releases).

### Installation Methods

#### Option A: TrollStore (Recommended — Permanent, No 7-day Revoke)
1. Download `PvZ2_Gardendless.ipa` on your device.
2. Open the file in **TrollStore** and tap **Install**.
3. Launch and enjoy!

#### Option B: AltStore / SideStore (Mac & PC)
1. Download `PvZ2_Gardendless.ipa`.
2. Open **AltStore** or **SideStore** on your device.
3. Go to **My Apps** &rarr; tap the **+** button in the top left &rarr; select `PvZ2_Gardendless.ipa`.

#### Option C: Sideloadly (Windows & macOS)
1. Connect your iPhone or iPad to your computer via USB.
2. Open **Sideloadly**, drag and drop `PvZ2_Gardendless.ipa` into the app.
3. Enter your Apple ID and click **Start** to install.

---

## ✨ Features & iOS Optimizations

### 🚀 Gameplay & Touch Enhancements
- **Universal Auto-Collection:**
  - Sun (from sky, Sunflowers, Twin Sunflowers, Sun-shrooms, and zombies) is **automatically collected** as soon as it drops.
  - Silver & gold coins, gems, minigame tickets, sprouts, and plant food (when slots are open) are automatically collected.
  - *Safety:* Far Future sun bombs remain protected and will not auto-explode.
- **HUD "Collect All" Tap (Simulated PC 'A' Key):**
  - Tapping the Sun Counter HUD at the top-left triggers a full lawn sweep to instantly collect all droppings.
- **Auto Fast-Forward on Level Start:**
  - Every level automatically starts in **Fast-Forward (2x speed)** mode.
  - Tap the fast-forward button at any time to toggle back to normal 1x speed on demand.
- **Touchscreen Controls & Layout Fixed:**
  - Patched Cocos camera coordinate projection preventing `NaN` coordinate bugs on iOS touch dragging.
  - Ergonomically spaced the fast-forward and shovel buttons to completely prevent accidental shovel presses on iPhones and iPads.

### 💾 Native iOS Save File Management
- **iOS Files App Integration:**
  - Enabled `UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`.
  - Your save files appear directly in the iOS **Files** app under `On My iPad` / `On My iPhone` &rarr; `PvZ2 Gardendless`.
- **Native iOS Share Sheet & Clipboard Fallback:**
  - Tapping **Export Save** opens the native iOS Share Sheet to AirDrop, save to iCloud Drive, or message your save file.
  - Also displays an in-game modal with an instant **Copy JSON to Clipboard** button.
  - Import works seamlessly via the native iOS Document Picker.

### ⚡ Performance & Battery Optimization
- **Low-End & iPad Pro Performance:**
  - Added dynamic multi-tier frame rate pacing (`60 FPS` baseline on A10X/A12/A13 chips like iPad Pro 2018; `120 FPS` ProMotion support on M-series chips).
  - WebKit compositing optimizations with zero memory-leak WebAudio node recycling.
  - In-game Quality / FPS selector accessible via the pause menu.

---

## 🛠️ Building from Source

If you want to customize or build the project yourself:

### Prerequisites
- macOS with **Xcode 15+** installed
- **Node.js 18+** and **npm**
- CocoaPods / Swift Package Manager (handled automatically by Capacitor)

### Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Manan2004/PvZ2-Gardendless-iOS.git
   cd PvZ2-Gardendless-iOS
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Sync web assets to the iOS project:**
   ```bash
   npx cap sync ios
   ```

4. **Build & Run via Xcode:**
   ```bash
   npx cap open ios
   ```
   Or build from command line:
   ```bash
   cd ios/App
   xcodebuild -scheme App -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
   ```

---

## 📜 Disclaimer & Credits

- **Original Fangame Creator:** 莱池_余垛 (Lai Chi / Yu Duo). All original game assets, art, design, and audio belong to their respective creators.
- **Plants vs. Zombies** is a registered trademark of **PopCap Games** and **Electronic Arts (EA)**.
- This project is a non-commercial, open-source fan port created strictly for preservation, personal use, and educational purposes.
