# Gradle merge notes (after `npx cap add android`)

Apply these to `android/app/build.gradle` (Groovy) or `build.gradle.kts`.

## Plugins

```groovy
plugins {
    id 'com.android.application'
    id 'org.jetbrains.kotlin.android'
    id 'com.google.devtools.ksp'
}
```

Root `android/settings.gradle` / `build.gradle` must resolve the KSP plugin
(version aligned with your Kotlin — e.g. KSP 2.0.x for Kotlin 2.0).

## android { }

```groovy
android {
    namespace "app.gymfolio.android"
    compileSdk 36

    defaultConfig {
        applicationId "app.gymfolio.android"
        minSdk 26
        targetSdk 36
    }
}
```

`minSdk 26` is fine for Capacitor; **AppFunctions only run on API 36+** devices.

## Dependencies

```groovy
dependencies {
    implementation "androidx.appfunctions:appfunctions:1.0.0-alpha13"
    ksp "androidx.appfunctions:appfunctions-compiler:1.0.0-alpha13"
    implementation "org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0"
}
```

```groovy
ksp {
    arg("appfunctions:aggregateAppFunctions", "true")
}
```

## Manifest / sources

Copy from `android-src/`:

- `app/src/main/java/app/gymfolio/android/**`
- `app/src/main/AndroidManifest.xml` (merge with Capacitor’s — keep Cap provider + file paths)
- `app/src/main/res/xml/app_metadata.xml`
- `app/src/main/res/values/strings.xml` (merge string keys)

Replace Capacitor’s default `MainActivity` with ours (`BridgeActivity` + WebMcp bridge);
delete `MainActivity.java` if both exist. Set `android:name=".GymfolioApplication"` on
`<application>`.

AppFunctions: abstract entry is `BaseGymfolioAppFunctionService`; KSP emits concrete
`GymfolioAppFunctionService` referenced from the manifest.
