# V0.4 alpha.8 status

The development build implements time exploration, historical/future UTC input, approximate seasonal dates, day/night shading, atmosphere, configurable space decorations, permanent imagery reuse, city selection and camera focus. 1573 cities include all 826 supplied reference records. Administrative markers use double circles for capitals, hollow circles for regional centers, and filled circles for other cities. Distant views hide markers; closer views reveal dots and sparse Chinese labels.

The private Windows build passed 62 domain tests and 9 desktop test groups on 2026-10-11. Those results do not certify this public export. Public-export verification is recorded separately.

Known unresolved risks: the historical 493-render idle anomaly has not been uniquely explained; a reproducible lost-pointer-release gesture state leak was fixed. One 240-second offline reload wait had an inactive native window state; subsequent diagnostics passed, but the original cause remains unknown. Automated tests do not replace visual/interaction acceptance. V0.5 has not started.
