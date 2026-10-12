// Online-only suite includes V0.1 time, guide, camera and window regressions.
const exe=process.argv[2]
process.argv=[process.argv[0],process.argv[1],'fixture',...(exe?[exe]:[])]
await import('./online-smoke.mjs')
