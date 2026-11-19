"""Small, deterministic starter project scaffolds for FORGE studios."""
from pathlib import Path
from forge_os.core.safety import safe_path

TEMPLATES = {
 "web": {"index.html": "<!doctype html>\n<html lang=\"en\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>FORGE Web App</title><link rel=\"stylesheet\" href=\"style.css\"></head><body><main><h1>Built with FORGE</h1><p>Your web project starts here.</p></main><script src=\"app.js\"></script></body></html>\n",
         "style.css": "body{font-family:system-ui,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;background:#101827;color:#f8fafc}main{max-width:48rem;padding:3rem}\n",
         "app.js": "console.log('FORGE web studio ready');\n"},
 "api": {"main.py": "from fastapi import FastAPI\n\napp = FastAPI(title='FORGE API')\n\n@app.get('/health')\ndef health():\n    return {'status': 'ok'}\n",
         "requirements.txt": "fastapi>=0.110\nuvicorn[standard]>=0.27\n"},
 "saas": {"main.py": "from fastapi import FastAPI\n\napp = FastAPI(title='FORGE SaaS starter')\n\n@app.get('/health')\ndef health():\n    return {'status': 'ok'}\n\n# Add authentication, tenant isolation, billing and persistence before production.\n",
          "requirements.txt": "fastapi>=0.110\nuvicorn[standard]>=0.27\n"},
 "game": {"index.html": "<!doctype html><html lang=\"en\"><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>FORGE Game</title><canvas id=\"game\" width=\"800\" height=\"450\"></canvas><script src=\"game.js\"></script></html>\n",
          "game.js": "const canvas=document.querySelector('#game');const ctx=canvas.getContext('2d');function frame(){ctx.fillStyle='#101827';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#fff';ctx.font='28px system-ui';ctx.fillText('FORGE Game Studio',32,60);requestAnimationFrame(frame)}frame();\n"},
 "android": {"settings.gradle": "pluginManagement { repositories { google(); mavenCentral(); gradlePluginPortal() } }\ndependencyResolutionManagement { repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS); repositories { google(); mavenCentral() } }\nrootProject.name = 'ForgeAndroid'\ninclude ':app'\n",
              "build.gradle": "plugins { id 'com.android.application' version '8.5.2' apply false }\n",
              "app/build.gradle": "plugins { id 'com.android.application' }\nandroid { namespace 'com.forge.app'; compileSdk 35; defaultConfig { applicationId 'com.forge.app'; minSdk 23; targetSdk 35; versionCode 1; versionName '1.0' } }\n",
              "app/src/main/AndroidManifest.xml": "<manifest xmlns:android=\"http://schemas.android.com/apk/res/android\"><application android:theme=\"@android:style/Theme.Material.Light.NoActionBar\" android:label=\"FORGE App\"><activity android:name=\".MainActivity\" android:exported=\"true\"><intent-filter><action android:name=\"android.intent.action.MAIN\"/><category android:name=\"android.intent.category.LAUNCHER\"/></intent-filter></activity></application></manifest>\n",
              "app/src/main/java/com/forge/app/MainActivity.java": "package com.forge.app;\nimport android.app.Activity;import android.os.Bundle;import android.widget.TextView;\npublic class MainActivity extends Activity { @Override public void onCreate(Bundle b){super.onCreate(b);TextView v=new TextView(this);v.setText(\"FORGE Android Studio\");v.setTextSize(24);setContentView(v);} }\n"},
 "flutter": {"pubspec.yaml": "name: forge_flutter_app\ndescription: A starter app built with FORGE\npublish_to: 'none'\nversion: 1.0.0+1\nenvironment:\n  sdk: '>=3.3.0 <4.0.0'\ndependencies:\n  flutter:\n    sdk: flutter\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\nflutter:\n  uses-material-design: true\n",
             "lib/main.dart": "import 'package:flutter/material.dart';\n\nvoid main() => runApp(const ForgeApp());\n\nclass ForgeApp extends StatelessWidget {\n  const ForgeApp({super.key});\n  @override\n  Widget build(BuildContext context) => MaterialApp(title: 'FORGE App', theme: ThemeData(colorSchemeSeed: Colors.indigo), home: Scaffold(appBar: AppBar(title: const Text('FORGE App')), body: const Center(child: Text('Your Flutter app starts here.'))));\n}\n"},
 "godot": {"project.godot": "config_version=5\n\n[application]\nconfig/name=FORGE Godot Game\nrun/main_scene=\"res://Main.tscn\"\n\n[display]\nwindow/size/viewport_width=960\nwindow/size/viewport_height=540\n",
           "Main.tscn": "[gd_scene load_steps=2 format=3]\n\n[ext_resource type=\"Script\" path=\"res://main.gd\" id=1]\n[node name=\"Main\" type=\"Node2D\"]\nscript = ExtResource(\"1\")\n",
           "export_presets.cfg": "[preset.0]\nname=\"Android\"\nplatform=\"Android\"\nrunnable=true\nexport_filter=\"all_resources\"\ninclude_filter=\"\"\nexclude_filter=\"\"\nexport_path=\"build/android-debug.apk\"\n\n[preset.0.options]\ncustom_template/debug=\"\"\ncustom_template/release=\"\"\narchitectures/arm64-v8a=true\narchitectures/armeabi-v7a=false\npackage/unique_name=\"com.example.forgegame\"\n",
           "main.gd": "extends Node2D\n\nfunc _draw() -> void:\n    draw_rect(Rect2(Vector2.ZERO, Vector2(960, 540)), Color(0.06, 0.09, 0.15))\n    draw_string(ThemeDB.fallback_font, Vector2(40, 80), \"FORGE Godot Studio\", HORIZONTAL_ALIGNMENT_LEFT, -1, 32, Color.WHITE)\n"},
 "unity": {"Assets/Editor/BuildScript.cs": "using UnityEditor;\nusing UnityEditor.Build.Reporting;\nusing UnityEngine;\n\npublic static class BuildScript {\n    public static void BuildAndroid() {\n        var scenes = EditorBuildSettings.scenes;\n        if (scenes.Length == 0) throw new System.Exception(\"Add at least one scene to Build Settings before building.\");\n        var options = new BuildPlayerOptions { scenes = System.Array.ConvertAll(scenes, s => s.path), locationPathName = System.Environment.GetEnvironmentVariable(\"FORGE_BUILD_OUTPUT\") ?? \"Build/forge-android.apk\", target = BuildTarget.Android, options = BuildOptions.None };\n        BuildReport report = BuildPipeline.BuildPlayer(options);\n        if (report.summary.result != BuildResult.Succeeded) throw new System.Exception(\"Unity Android build failed: \" + report.summary.result);\n    }\n}\n",
           "Assets/Scenes/.gitkeep": ""}

}


def scaffold(root: str, studio: str, destination: str) -> dict:
    if studio not in TEMPLATES: raise ValueError("studio must be web, android, flutter, game, godot, unity, saas, or api")
    created=[]
    for relative, content in TEMPLATES[studio].items():
        path = safe_path(root, str(Path(destination) / relative), for_write=True)
        if path.exists(): raise FileExistsError(f"Refusing to overwrite existing file: {path}")
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        created.append(str(path.relative_to(Path(root).resolve())))
    return {"studio": studio, "created": created, "status": "scaffolded",
            "warning": "Starter scaffold only; add project-specific features and run the native build/test toolchain."}
