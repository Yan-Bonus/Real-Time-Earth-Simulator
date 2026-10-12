# Resource licenses

The root MIT license covers original application code, not third-party data, imagery or private media. Dependencies retain their own licenses; see package-lock.json and installed package notices.

## EOX imagery

public/imagery/eox-2024-global.png is an atlas assembled from 128 EOX Sentinel-2 cloudless 2024 tiles. © EOX · Contains modified Copernicus Sentinel data 2024. This imagery and the included EOX test fixtures remain CC BY-NC-SA 4.0 (non-commercial, attribution, share-alike), not MIT. Original provenance and assembly hashes remain in public/imagery/LICENSE.txt and global-manifest.json.

https://cloudless.eox.at/pricing
https://creativecommons.org/licenses/by-nc-sa/4.0/

## Natural Earth

Natural Earth populated-place source data is public domain. Source and snapshot digest: scripts/data/cities-source.json. https://www.naturalearthdata.com/about/terms-of-use/

## 826-city reference records

The reference package has separate per-source and per-record terms. Its README, source links, description attribution, image-license metadata and original manifests are preserved in scripts/data/user-cities-826. Wikipedia-derived descriptions and package-authored descriptions are CC BY-SA 4.0, not MIT; source_page links identify contribution history. Image URLs/metadata are included, not photo binaries. Four referenced external photos lack stated licensing: do not download or redistribute them assuming permission. Factual coordinates, names and UN/MCA source records must be assessed under their own listed source terms. Generated src/data/cities.json retains reference IDs and provenance; the code license does not relicense that dataset.

## NASA imagery

Legacy NASA files and NASA test fixtures retain their source attribution and media-use conditions. See public/textures/README.md and test-fixtures/README.md. No NASA endorsement is implied.

## Excluded private media

The supplied background music and application icon are not included. Public builds use Electron default branding and disable music until a locally licensed track is configured. Local private builds are unchanged.
