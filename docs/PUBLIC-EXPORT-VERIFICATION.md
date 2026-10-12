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
