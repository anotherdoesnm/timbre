#!/usr/bin/env python3
"""Point the generated Gradle wrapper at GitHub's mirror of the distribution.

`services.gradle.org` is behind a CDN that has taken the nightly down twice: once with a ten
second connect timeout, once with a run of 504s lasting longer than the retries. GitHub's own
release of the same file is served from the same network as the runner, which is the whole point.

The version is not hardcoded: the wrapper file says which distribution it wants (Tauri pins it),
and only the host is rewritten. The original URL is written next to the file so the build step can
put it back if the mirror turns out to be the broken one — both hosts have been down at different
hours today, and a cache only helps if the URL it was filled with is the URL in use.

Runs after `tauri android init`, because `gen/android` is generated per platform.
"""

import pathlib
import re
import sys

WRAPPER = pathlib.Path("src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties")
# Where the build step looks when it wants the official URL back.
ORIGINAL = pathlib.Path("src-tauri/gen/android/.gradle-original-url")
MIRROR = "https://github.com/gradle/gradle-distributions/releases/download/v{version}/gradle-{version}-bin.zip"
LINE = re.compile(r"^(distributionUrl=)(.*)$", re.MULTILINE)
TIMEOUT = re.compile(r"^networkTimeout=[0-9]+$", re.MULTILINE)
# The wrapper ships with ten seconds; a download of 140 MB on a shared runner deserves more.
TIMEOUT_MS = 120000
DIST = re.compile(r"gradle-([0-9][0-9.]*)-bin\.zip")


def revert() -> int:
    """Puts the official URL back — called by the build step when the mirror will not answer."""
    if not (WRAPPER.is_file() and ORIGINAL.is_file()):
        print("nothing to revert to", file=sys.stderr)
        return 0
    original = ORIGINAL.read_text().strip()
    text = WRAPPER.read_text()
    WRAPPER.write_text(LINE.sub(lambda m: m.group(1) + original, text, count=1))
    print(f"back to {original}")
    return 0


def main() -> int:
    if "--revert" in sys.argv:
        return revert()
    if not WRAPPER.is_file():
        print(f"no {WRAPPER}, nothing to point anywhere", file=sys.stderr)
        return 0
    text = WRAPPER.read_text()
    match = LINE.search(text)
    if not match:
        print(f"no distributionUrl in {WRAPPER}; the wrapper template changed shape", file=sys.stderr)
        return 1
    current = match.group(2)
    version = DIST.search(current)
    if not version:
        print(f"cannot read a version out of {current!r}; leaving it alone", file=sys.stderr)
        return 0
    target = MIRROR.format(version=version.group(1))
    if current == target:
        print(f"already on the mirror: {version.group(1)}")
        return 0
    # No reachability probe: a HEAD that answers 504 says nothing about the GET that follows, and
    # the build step already knows how to fall back.
    ORIGINAL.write_text(current + "\n")
    updated = LINE.sub(lambda m: m.group(1) + target, text, count=1)
    if TIMEOUT.search(updated):
        updated = TIMEOUT.sub(f"networkTimeout={TIMEOUT_MS}", updated)
    WRAPPER.write_text(updated)
    print(f"distribution {version.group(1)} now comes from {target}, networkTimeout={TIMEOUT_MS}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
