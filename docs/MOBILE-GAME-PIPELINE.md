# Mobile and Game Production Pipeline

FORGE supports project starters and guarded build adapters for Flutter, Godot,
Unity and native Gradle Android projects.

## Starters
- `forge scaffold flutter PATH`
- `forge scaffold godot PATH`
- `forge scaffold unity PATH`

These create minimal project structures, not complete games/apps. Unity requires
the Unity Editor and Android Build Support modules. Godot Android export requires
the Android export templates, SDK/JDK setup and an export preset. Flutter
requires the Flutter SDK and Android toolchain.

## Remote cloud builds

Godot and Unity support both 2D and 3D projects through the same engine pipeline; the project settings, renderer, scenes and assets determine whether a game is 2D or 3D. There is no separate 2D/3D build job. Web preview requires the selected project's features and plugins to support that engine's Web/WebGL export target.

The manual GitHub Actions workflow `forge-on-demand.yml` is available through the authenticated FORGE MCP controller. It accepts one engine and one output per run; it is never triggered by a normal file commit.

- Godot: `test`, `apk`, `aab`, `web`, `linux`. Use export preset names exactly `Android`, `Web`, and `Linux`. The Android APK is a debug/test package. AAB requires the Android preset to enable Gradle (`gradle_build/use_gradle_build=true`), set `gradle_build/export_format=1`, include `android/build/build.gradle`, and use the dedicated GitHub keystore secrets for release signing.
- Unity: `apk`, `aab`, `web`, `linux`. A valid `UNITY_LICENSE` secret is required. AAB requires `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASS`, `ANDROID_KEYALIAS_NAME`, and `ANDROID_KEYALIAS_PASS` GitHub secrets, plus Custom Keystore enabled in Unity Player Settings.
- Flutter: `test`, `apk`, `aab`; the existing pipeline is unchanged. Do not treat its current debug/unsigned test artifacts as store-ready releases.

Godot and Unity Web builds also publish an interactive browser preview to `https://majsjsj.github.io/FORGE-OS/game-preview/` using the same GitHub Pages site as the Studio. The preview deployment job runs only after the corresponding Web build artifact is created. In Claude, call `forge_game_preview_url` to confirm the latest published build; in Studio, use **OPEN LAST WEB GAME**. The preview is a browser/Web build, not an Android emulator.

These workflow changes are committed but have not yet been exercised by a new Godot/Unity Actions build. Builds remain gated by explicit user approval.

## Local Builds
- `forge build PATH apk`
- `forge build PATH aab`
- `forge build PATH godot-android-debug`
- `forge build PATH unity-android`

Builds run only if the matching local toolchain exists. The runner uses argument
arrays, no shell, a bounded timeout, and a project working directory. Native
toolchains may execute project build scripts; build untrusted projects only in
an isolated environment. Unity's Android target additionally requires a project
build method named `BuildScript.BuildAndroid`; FORGE does not fabricate a
production build script.

## Google Play preparation
`forge play-package PATH --name ... --package-id ... --short ... --description ...`
writes `play-store-listing.json` with metadata and a review checklist. It does
not sign, upload, submit, or guarantee policy compliance. You must verify current
Play Console requirements, signing, Data safety, content rating, target audience,
privacy policy, screenshots and testing tracks.

## Ads
`forge ads PATH --platform flutter --formats banner,interstitial,rewarded`
writes an AdMob configuration plan with placeholders. It does not insert an SDK
or real IDs. SDK setup is engine/version-specific and must follow Google's
current documentation. Use test ads, implement consent where applicable, and
disclose data collection accurately.

## Important limitations
FORGE does not bundle Unity, Godot, Flutter, Android SDK, JDK or emulator images.
It detects tools and invokes installed local toolchains. Google Play publishing
and AdMob account operations remain manual and require your credentials and
human review.


## Native build approval and artifact verification

MCP calls to `forge_build_mobile` are deliberately non-executing by default.
First inspect the project and its build scripts, then call the tool again with
`approved=true` only after the user explicitly authorizes running those scripts.
The tool uses fixed argument arrays (never a shell) and checks that a non-empty
APK/AAB exists at the expected output location before reporting success. A
successful process exit without an artifact is treated as a failed build.

This approval flag is an explicit per-call authorization gate, not an OS sandbox.
Do not build untrusted repositories on a machine containing secrets or signing
keys; use an isolated runner/container. FORGE does not sign, upload, or publish
the artifact automatically.
