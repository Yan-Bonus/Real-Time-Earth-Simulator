# V0.4 alpha.9 status — 2026-10-15

The current source retains the V0.4 feature scope: 1573 cities, Chinese sparse labels and administrative marker shapes, real imagery with permanent regional storage, UTC time exploration, approximate seasonal dates, day/night shading, atmosphere, music, and independently configurable space decorations. V0.5 has not started.

## Interaction changes

City single-click selects without flying; double-click or the Focus button flies. Drag paths exceeding the click threshold remain drags even if they return to their starting point. Closing city information restores focus; city markers use one Tab entry and arrow/Home/End navigation. Escape dismisses settings, cancels flight, clears selection, then exits fullscreen; input controls retain their editing behavior.

Observation mode retains date/time, pause/resume, direction and speed controls. Narrow windows use mutually exclusive tool/settings drawers. Display/group preferences persist, while each launch starts at real time with EOX highest quality. Date drafts have an explicit fill-current action. Resetting display does not reset music, time or stored imagery.

Attribution follows the imagery actually displayed during a source switch. Statistics errors clear on successful polling, independently from directory-open errors. Failed optional prefetch receives a per-source cooldown without blocking required target refinement. Bounded native-window and render-wakeup diagnostics aid investigation without a diagnostic timer.

## Validation boundaries

The development alpha.9 build passed npm run check, 65 domain tests, and packaged code/media consistency checks. Earlier alpha.9 desktop builds passed the primary interaction workflow, three narrow-window zoom layouts, time, music, cosmic toggles and interrupted gestures. Later targeted tests exposed and prompted fixes to drag-path and keyboard-entry handling.

Final integrated desktop verification was interrupted with the native window minimized. The maintainer requested postponing foreground tests because keeping the window visible was temporarily inconvenient. Final interaction, normal-configuration lifecycle recovery, statistics-failure injection, solar/imagery regression and performance reruns remain pending. Earlier successes do not certify the final package. No signed release or stable release tag is provided.

An intermediate alpha.9 build produced 16 nonempty foreground performance samples: CPU frame P95 1.6–4.4 ms and render-submission interval P95 6.7–8.0 ms, without >50 ms samples. These data predate the final drag/keyboard fixes. The alpha.8 comparison contained empty samples and roughly one-second intervals; it cannot establish a credible comprehensive speedup. Render submission is neither GPU completion nor display frame rate. No new public-network cold-HD timing is certified.

The historical 493-render anomaly and earlier unexpected native minimize events have not been uniquely explained. Bounded diagnostics improve evidence collection but do not prove those historical causes fixed. Minimized zero-draw samples do not establish foreground idle efficiency or long-term leak freedom. Visual and interaction acceptance remain the maintainer's responsibility. Windows is the validated development platform; macOS/Linux require platform-specific verification.

Source-export checks for this update are recorded in PUBLIC-EXPORT-VERIFICATION.md. Some diagnostic scripts require isolated real-imagery profiles or old build artifacts not included in this repository; they are not portable CI. The user's permanent imagery library is not published.
