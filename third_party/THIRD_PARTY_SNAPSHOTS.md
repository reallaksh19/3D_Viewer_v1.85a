# Third-party snapshots

- libtess2
  - Source: https://github.com/memononen/libtess2
  - Commit: 8dbd6483e920311a58c9af10a10beb278efebc36

- rapidjson
  - Source: https://github.com/Tencent/rapidjson
  - Commit: 24b5e7a8b27f42fa16b96fc70aade9106cf7102f

- pipe-component-data
  - Source: https://github.com/reallaksh19/PipeComponentData
  - Snapshot: PipeComponentData-main.zip archived in this repo at commit 1a33ec0
  - Applied patches: fromUxmlXml-plain-attr-header.patch (see VENDOR-MANIFEST.json)
  - Integrity: pipe-component-data/VENDOR-MANIFEST.json (sha256 per file + tree),
    verified by viewer/tests/pipe-component-data-vendor.test.js
  - Vendored files are read-only downstream: fix upstream, re-vendor, refresh manifest.

These are vendored source snapshots for conversion-module dependency parity.
