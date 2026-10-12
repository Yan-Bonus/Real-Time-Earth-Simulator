// Direct online sea/land RGB and zero offline substitution are checked by this suite.
const exe=process.argv[2]
process.argv=[process.argv[0],process.argv[1],'fixture',...(exe?[exe]:[])]
await import('./online-smoke.mjs')
