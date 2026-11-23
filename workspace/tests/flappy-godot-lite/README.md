# Flappy Lite (Godot 4.4.1) - size experiment

Same game as `workspace/tests/flappy-godot` (main.gd, main.tscn, icon.svg are byte-identical).
Only export/import settings differ. Baseline is left untouched.

- ARM32 only (armeabi-v7a)
- Uses the official `android_release.apk` template via `custom_template/debug` (smaller engine library than the debug template)
- `icon.svg` excluded from the exported pack (the launcher icon is generated at export time)
- S3TC/BPTC import disabled (not needed on Android)
- Android-only preset; no Web preset
- Distinct package id: `com.forgeos.flappytest.lite`
