#!/usr/bin/env node
/**
 * Copy android-src overlays into the Capacitor-generated android/ tree.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const src = join(root, "android-src")
const dst = join(root, "android")

if (!existsSync(join(dst, "app"))) {
  console.error("Missing apps/android/android — run: pnpm --filter android exec npx cap add android")
  process.exit(1)
}

const javaDst = join(dst, "app/src/main/java")
mkdirSync(javaDst, { recursive: true })
cpSync(join(src, "app/src/main/java"), javaDst, { recursive: true })
// Capacitor scaffolds a Java MainActivity — prefer our Kotlin host.
const javaMain = join(javaDst, "app/gymfolio/android/MainActivity.java")
if (existsSync(javaMain)) unlinkSync(javaMain)

mkdirSync(join(dst, "app/src/main/res/xml"), { recursive: true })
cpSync(join(src, "app/src/main/res/xml"), join(dst, "app/src/main/res/xml"), { recursive: true })

const stringsSrc = join(src, "app/src/main/res/values/strings.xml")
const stringsDst = join(dst, "app/src/main/res/values/strings.xml")
if (existsSync(stringsDst)) {
  let existing = readFileSync(stringsDst, "utf8")
  if (!existing.includes("app_function_user_description")) {
    existing = existing.replace(
      "</resources>",
      `    <string name="app_function_user_description">Gymfolio — log workouts, hydration, and daily training status via on-device AI.</string>\n</resources>`,
    )
    writeFileSync(stringsDst, existing)
  }
} else {
  mkdirSync(dirname(stringsDst), { recursive: true })
  cpSync(stringsSrc, stringsDst)
}

// Merge manifest carefully: write ours alongside note — Cap may overwrite on sync.
// Prefer copying our Application/service bits into Cap manifest via marker replace.
const manSrc = readFileSync(join(src, "app/src/main/AndroidManifest.xml"), "utf8")
const manDstPath = join(dst, "app/src/main/AndroidManifest.xml")
let manDst = readFileSync(manDstPath, "utf8")

if (!manDst.includes("GymfolioApplication")) {
  manDst = manDst.replace(/<application([^>]*)>/, `<application android:name=".GymfolioApplication"$1>`)
}
if (!manDst.includes("BIND_APP_FUNCTION_SERVICE")) {
  manDst = manDst.replace(
    "</application>",
    `
        <service
            android:name=".appfunctions.GymfolioAppFunctionService"
            android:exported="true"
            android:permission="android.permission.BIND_APP_FUNCTION_SERVICE"
            tools:targetApi="36">
            <property
                android:name="android.app.appfunctions.v2"
                android:value="gymfolio_app_functions.xml" />
            <intent-filter>
                <action android:name="android.app.appfunctions.AppFunctionService" />
            </intent-filter>
        </service>
        <property
            android:name="android.app.appfunctions.app_metadata"
            android:resource="@xml/app_metadata" />
    </application>`,
  )
  if (!manDst.includes("xmlns:tools")) {
    manDst = manDst.replace(
      "<manifest ",
      '<manifest xmlns:tools="http://schemas.android.com/tools" ',
    )
  }
}
// Prefer our MainActivity package
manDst = manDst.replace(
  /android:name="[^"]*MainActivity"/,
  'android:name=".MainActivity"',
)

writeFileSync(manDstPath, manDst)
writeFileSync(join(dst, "app/src/main/AndroidManifest.gymfolio-reference.xml"), manSrc)

console.log("Merged android-src → android/")
