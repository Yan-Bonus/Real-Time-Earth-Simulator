# Public export verification — 2026-10-12

- Export: 0.4.0-alpha.8; original local development tree and private installed app preserved.
- Removed private MP3 and icon binaries; disabled public music source, retained playback controls; packaging uses default Electron branding.
- `npm run check`: passed (lint, TypeScript, global atlas hash and Vite build).
- 62 domain tests: passed with test temporary files inside the writable export directory.
- Fresh `npm ci`: blocked by local EPERM directory-creation failures, both at the initial and shorter export path. Existing installed dependencies were copied locally for validation and are ignored by Git. A clean install is therefore not certified by this run.
- Default `npm run pack`: download blocked by local TLS certificate-chain verification. TLS checking was not disabled.
- Diagnostic package using installed Electron runtime and `win.signAndEditExecutable=false`: passed. This is not a signed release or certification of the default download path.
- Automated packaged-app launch failed in this session; public runtime visual acceptance is not completed.
- Source snapshot checks: no original application icon, private audio, runtime library, test logs, node_modules, caches or private AGENTS/history are tracked.
- MIT applies to original code only; imagery/datasets keep separate licenses. See THIRD_PARTY_NOTICES.md.

This public source release does not claim all prior desktop tests were repeated on this export. Historical anomalies are described in docs/STATUS.md.

## Media inclusion update — 2026-10-13

The maintainer confirmed permission for public distribution of both supplied media assets. Music and PNG/ICO/ICNS icons are restored, music source and packaging configuration re-enabled. The earlier excluded-media verification above refers to the initial snapshot and is not a certification of this updated snapshot. Original development and desktop files remain unchanged.

Updated-export checks: npm run check passed. Desktop packaging passed using the installed Electron runtime, with executable icon/resource editing enabled and code signing disabled. Packaged MP3 and window PNG bytes match the supplied source files; supplied PNG/ICO/ICNS/MP3 hashes match the development originals. Existing packaged music regression passed: autoplay, default volume20%, loop boundary, on/off, full volume range and persisted preferences after reload; no page errors. This supersedes the initial export's disabled-music and failed-launch observation for the tested music workflow, without asserting complete desktop visual acceptance or a fresh dependency install.

## V0.4 alpha.9 source update — 2026-10-15

- Synchronized the approved interaction, display-preference, source-attribution, optional-prefetch and bounded-diagnostics changes from the development source, including the later drag-path and hidden-marker keyboard-entry fixes. Existing media, licenses and datasets remain included.
- This public export passed npm run check. The resulting JS/CSS asset names match the final development build.
- Domain-test first attempt with the environment's system temporary directory: 58 passed, 7 imagery-store cases failed. Repeating the full suite with TEMP/TMP inside the ignored test-results/export-temp-alpha9 directory: all 65 passed. This establishes a directory-dependent test-environment limitation; the first failures are retained locally, not silently deleted or reported as successful. The precise underlying system-temp failure was not diagnosed in this publication step.
- No new dependency installation was performed; existing installed dependencies were used. The earlier clean-install certification limitation remains.
- No desktop window was opened for this publication update. Final native interaction, performance and visual acceptance remain pending as described in STATUS.md; the maintainer requested postponing foreground tests. Source publication is not a stable or signed desktop release.
- Runtime imagery libraries, private AGENTS/development history, local screenshots/logs, node_modules, dist and packaged binaries are excluded from Git. A credential-pattern scan of the changed source/docs found no matches. Original music and icons retain the previously confirmed public-distribution permission and their separate media terms.
