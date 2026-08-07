# RunLog on Android

This app ships as a **Capacitor** shell around the same Vite/React UI and pure
`src/core/` logic. There is no Kotlin rewrite of the trainer yet — the WebView
runs the web build from `dist/`.

**Data contract:** [`DATA.md`](./DATA.md)  
**Package id:** `app.runlog.local`  
**App name:** RunLog

---

## What you get

| Piece | Status on Android |
|--------|-------------------|
| UI, history, coach, weight, backup | Same as web |
| GPS outdoor tracking | Works (location permission) |
| Map tiles | Works (needs network) |
| HR strap / foot pod (Web Bluetooth) | **Unreliable in WebView** — see below |
| Step counter | Works after activity recognition permission |
| Installable Play Store shell | Via Android Studio / signed AAB |

---

## Prerequisites (your machine)

1. **Node 20+** (you have this)
2. **JDK 17 or 21** (required by modern Android Gradle — **not Java 8**)
   - Install [Temurin 17](https://adoptium.net/) or Android Studio’s bundled JDK
   - Point `JAVA_HOME` at JDK 17+
3. **Android Studio** (Ladybug / recent) with SDK 36 + platform tools
4. Android SDK already detected under `%LOCALAPPDATA%\Android\Sdk` is fine

Check:

```bash
java -version    # should report 17+ for Gradle builds
echo %JAVA_HOME%
```

---

## Day-to-day workflow

From the repo root:

```bash
# 1. Install JS deps (once)
npm install

# 2. Build the web app into dist/
npm run build

# 3. Copy dist → android assets + update plugins
npm run android:sync

# 4. Open in Android Studio
npm run android:open
```

Or one shot:

```bash
npm run android:studio
```

In Android Studio:

1. Wait for Gradle sync  
2. Pick a device / emulator  
3. **Run ▶**  

Debug on a **physical phone** for GPS and Bluetooth.

### After any web change

```bash
npm run build
npm run android:sync
```

Then re-run from Android Studio (or `npm run android:run` if SDK tools are on `PATH`).

---

## npm scripts

| Script | Does |
|--------|------|
| `npm run build` | Typecheck + Vite → `dist/` |
| `npm run android:sync` | `cap sync android` |
| `npm run android:open` | Open Android Studio project |
| `npm run android:studio` | `build` + `sync` + `open` |
| `npm run android:run` | `cap run android` (needs `adb` on PATH) |

---

## Permissions (declared)

See `android/app/src/main/AndroidManifest.xml`:

- Location (fine/coarse) — outdoor GPS  
- Bluetooth scan/connect — HR / foot pod  
- Activity recognition — steps  
- Wake lock / vibrate — live run cues  
- Internet — map tiles only  

The OS will prompt at runtime when a feature is used. **Deny location → outdoor GPS fails** (same idea as the browser).

---

## Bluetooth / heart rate

The APK uses **native BLE** via `@capacitor-community/bluetooth-le` (not Web Bluetooth in the WebView).

| Host | HR / foot pod |
|------|----------------|
| Capacitor APK (debug/release) | **Native BLE** — device chooser from the plugin |
| Chrome / PWA (browser) | Web Bluetooth |

**Testing tips**

1. Wear / wake the strap or pod (many only advertise while moving).  
2. Grant **Nearby devices** / Bluetooth when Android prompts.  
3. Tap **HR strap** or **Foot pod** on the Run screen (must be a real button press).  
4. Pick the device from the system / plugin list.  

If connect fails: forget the device in Android Bluetooth settings, toggle BT off/on, retry.

---

## Moving data from the phone browser

Storage is **per origin**. Chrome PWA data is **not** the Capacitor app’s IndexedDB.

1. In Chrome RunLog: **Settings → Export full backup**  
2. Install the Android app  
3. **Settings → Import backup** (share the JSON into the app / Downloads)

Same format as `docs/DATA.md`.

---

## Release / Play Store (outline)

1. Install **JDK 17+** and open the project in Android Studio  
2. **Build → Generate Signed Bundle / APK** → Android App Bundle  
3. Create a Play Console app (`app.runlog.local` or a new application id you own)  
4. Privacy policy: local-only storage, no account; location/Bluetooth only while using the app  
5. Data safety form: no data shared with third parties (map tiles are third-party **network** fetches — disclose)  

Change `applicationId` / `appId` before a public listing if you want a domain-based id (`com.yourname.runlog`).

---

## Project layout

```
capacitor.config.ts     # appId, webDir: dist
android/                # native shell (commit this)
dist/                   # web build output (gitignored; regenerated)
src/core/               # pure logic — keep shared forever
src/platform/           # Web APIs; replace per-feature with native if needed
docs/DATA.md            # backup + schema for migrate / dual clients
docs/ANDROID.md         # this file
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Gradle fails with Java 8 | Install JDK 17; set `JAVA_HOME` |
| Blank WebView | `npm run build && npm run android:sync` |
| No GPS | Grant location; test outdoors / emulator with mock location |
| No HR devices | Expected on WebView — use Chrome or plan native BLE |
| Map empty | Network + allow internet; Settings → Map style |
| `adb` not found | Install platform-tools; add to PATH, or only use Android Studio Run |

---

## Why not a full Kotlin rewrite yet?

- Product is feature-complete in TS (`core` is unit-tested)  
- Capacitor reuses UI immediately  
- Rewrite is right when you need background GPS + reliable BLE + Play policies that force native services  

When you do rewrite sensors, keep **`docs/DATA.md`** as the interchange layer so backups still load.
