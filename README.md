# Plants vs. Zombies 2: Gardendless (iOS Port)

An iOS and iPadOS port of the fan-made PC game **Plants vs. Zombies 2: Gardendless** (v0.16.1), packaged using Capacitor and Cocos Creator.

## Download & Installation

Pre-built IPA files are available on the [Releases](https://github.com/Manan2004/PvZ2-Gardendless-iOS/releases) page.

You can install the IPA using any standard sideloading tool:
- **TrollStore** (recommended if your iOS version supports it): Open `PvZ2_Gardendless.ipa` directly in TrollStore and install.
- **AltStore / SideStore**: Add the downloaded IPA through the **+** button in the My Apps tab.
- **Sideloadly**: Connect your device to your computer, drag the IPA into Sideloadly, and start installation.

## iOS Features & Changes

This port includes several touch-specific quality-of-life adjustments over the original PC version:

- **In-Game Settings Menu**: Tap the gear icon in the bottom-left corner (or 3-finger tap anywhere) to open the settings menu. From here you can toggle:
  - **Auto-Collect**: Automatically collects dropped sun, coins, gems, sprouts, tickets, and plant food (when slots are open). Default is ON.
  - **Auto Fast-Forward**: Automatically starts each level at 2x speed. Default is ON.
  - **Resolution & FPS**: Switch between 30 FPS and 60 FPS, or adjust rendering scale for older devices. **YOU HAVE TO RESTART THE GAME FOR CHANGES TO APPLY**.

<p align="center">
  <img src="screenshots/settings-menu.jpg" width="360" alt="iOS Settings and Performance Menu" />
</p>
- **Tap Sun Bank to Collect All**: Tapping the sun counter at the top-left triggers a full-screen sweep to collect all items (equivalent to pressing the 'A' key on PC). This works even if Auto-Collect is turned off.
- **Touch Controls & Layout**:
  - Fixed touch dragging coordinate bugs on WebKit.
  - Spaced out the fast-forward and shovel buttons so they don't accidentally overlap on smaller screens.
- **Save Import & Export**:
  - Save files are stored directly in the app's Documents folder and can be accessed in the native iOS **Files** app (`On My iPad / iPhone -> PvZ2 Gardendless`).
  - Tapping Export Save in the settings menu opens the native iOS Share Sheet (AirDrop, Save to Files, etc.) with a clipboard copy option.
  - Import works through the standard iOS document picker.
- **Performance**: Paced frame rates for smoother gameplay on older devices (like the 2018 iPad Pro) while supporting up to 120Hz on ProMotion screens.

## Building from Source

### Prerequisites
- macOS with Xcode 15 or later
- Node.js 18+ and npm

### Build Instructions

1. Clone the repo:
   ```bash
   git clone https://github.com/Manan2004/PvZ2-Gardendless-iOS.git
   cd PvZ2-Gardendless-iOS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Sync web assets to the iOS project:
   ```bash
   npx cap sync ios
   ```

4. Build or run the Xcode project:
   ```bash
   npx cap open ios
   ```
   Or build from the terminal:
   ```bash
   cd ios/App
   xcodebuild -scheme App -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO build
   ```

## Credits & Disclaimer

- Original fangame created by Lai Chi / Yu Duo.
- Plants vs. Zombies is a trademark of PopCap Games and Electronic Arts.
- This is a non-commercial fan port made for personal and educational use.
