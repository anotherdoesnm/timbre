#!/usr/bin/env python3
"""Wire a release signing config into the Android project Tauri generates.

`tauri android init` writes `app/build.gradle.kts` with a `buildTypes` block that has no
`signingConfigs` at all, so `tauri android build` without `--debug` produces an *unsigned* APK.
Gradle then has nothing to sign with, and a release pipeline that ships an unsigned artifact is
worse than one that fails.

The patch is deliberately loud: if the template ever changes shape, it exits non-zero instead of
quietly producing an unsigned APK. Credentials come from the environment:

    TIMBRE_KEYSTORE           path to the keystore file
    TIMBRE_KEYSTORE_PASSWORD  store password
    TIMBRE_KEY_ALIAS          key alias
    TIMBRE_KEY_PASSWORD       key password

Usage: python3 scripts/patch-android-signing.py [path/to/app/build.gradle.kts]
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

SIGNING_BLOCK = """    signingConfigs {
        create("release") {
            storeFile = file(System.getenv("TIMBRE_KEYSTORE") ?: "")
            storePassword = System.getenv("TIMBRE_KEYSTORE_PASSWORD")
            keyAlias = System.getenv("TIMBRE_KEY_ALIAS")
            keyPassword = System.getenv("TIMBRE_KEY_PASSWORD")
        }
    }
"""


def main(argv: list[str]) -> int:
    path = Path(argv[1] if len(argv) > 1 else "src-tauri/gen/android/app/build.gradle.kts")
    if not path.is_file():
        print(f"no gradle file at {path}: run `tauri android init` first", file=sys.stderr)
        return 2
    source = path.read_text()

    if "signingConfigs" in source:
        print("already patched")
        return 0

    anchor = "\n    buildTypes {"
    if anchor not in source:
        print("template changed: no `buildTypes` block to anchor the signing config on", file=sys.stderr)
        return 1
    source = source.replace(anchor, "\n" + SIGNING_BLOCK + "    buildTypes {", 1)

    patched, count = re.subn(
        r'(getByName\("release"\) \{)',
        r'\1\n            signingConfig = signingConfigs.getByName("release")',
        source,
        count=1,
    )
    if count != 1:
        print("template changed: no release build type to sign", file=sys.stderr)
        return 1

    path.write_text(patched)
    print(f"signing config wired into the release build type ({path})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
