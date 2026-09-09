# Third-party notices

Atlyn Pareto is maintained in a private repository with root package metadata `UNLICENSED`. The third-party permissions below apply to their respective components, **not to Atlyn Pareto as a whole**. This file makes no new product, sample, or artwork license grant.

The self-contained visual exposes **Third-party notices** in a collapsed, offline panel. Its checked-in `src/third-party-notices.json` preserves installed dependency license text and the vendored Globalize notice. `node scripts/generate-notices.mjs` regenerates it; packaging checks that it still matches installed dependencies. This is necessary because the official packager does not include webpack's separate `visual.js.LICENSE.txt` file in the archive.

The Globalize code vendored by the formatting utility identifies Software Freedom Conservancy, Inc. and offers MIT or GPL Version 2. This project selects MIT and retains the corresponding [upstream notice](https://github.com/globalizejs/globalize/blob/v0.1.1/LICENSE) in `licenses/globalize-MIT.txt` and inside the visual. This provenance identifies the license source, not a claim about the vendored code's exact release version.

## Dependency provenance

The following versions and license declarations were read from the installed package manifests and accompanying `LICENSE` files. The Microsoft packages below use MIT; `semver` uses ISC. The lockfile defines the complete dependency graph. Declaration as a runtime dependency does not mean every file in that package is shipped; inspect the actual archive and bundling output before distribution.

| Component | Version | Relationship | Upstream source | License file |
| --- | --- | --- | --- | --- |
| `powerbi-visuals-api` | 5.11.1 | Direct API/runtime declaration | [Microsoft/powerbi-visuals-api](https://github.com/microsoft/powerbi-visuals-api) | `node_modules\powerbi-visuals-api\LICENSE` |
| `powerbi-visuals-utils-formattingmodel` | 7.1.0 | Direct runtime declaration | [Microsoft/powerbi-visuals-utils-formattingmodel](https://github.com/microsoft/powerbi-visuals-utils-formattingmodel) | `node_modules\powerbi-visuals-utils-formattingmodel\LICENSE` |
| `powerbi-visuals-utils-formattingutils` | 7.0.0 | Direct runtime declaration | [Microsoft/powerbi-visuals-utils-formattingutils](https://github.com/microsoft/powerbi-visuals-utils-formattingutils) | `node_modules\powerbi-visuals-utils-formattingutils\LICENSE` |
| `powerbi-visuals-utils-dataviewutils` | 7.0.0 | Formatting utility transitive dependency | [Microsoft/powerbi-visuals-utils-dataviewutils](https://github.com/microsoft/powerbi-visuals-utils-dataviewutils) | `node_modules\powerbi-visuals-utils-dataviewutils\LICENSE` |
| `powerbi-visuals-utils-typeutils` | 7.0.0 | Formatting utility transitive dependency | [Microsoft/powerbi-visuals-utils-typeutils](https://github.com/microsoft/powerbi-visuals-utils-typeutils) | `node_modules\powerbi-visuals-utils-typeutils\LICENSE` |
| `semver` | 7.8.5 | API package transitive dependency; ISC | [npm/node-semver](https://github.com/npm/node-semver) | `node_modules\semver\LICENSE` |
| `powerbi-visuals-tools` | 7.2.1 | Development/packaging tool, not an intended runtime service | [Microsoft/PowerBI-visuals-tools](https://github.com/microsoft/PowerBI-visuals-tools) | `node_modules\powerbi-visuals-tools\LICENSE` |

Other development/test and transitive packages retain their own licenses. Run `npm run audit:licenses` after restoring the locked dependencies to produce `artifacts\dependency-licenses.json`; examine individual installed license/notice files and the exact distributed contents for any additional obligations. An inventory/allowlist pass is not legal approval and does not replace required notice retention. Platform-specific optional dependencies may not be installed on every build machine.

The exact installed inventory, not a fixed package count in this document, controls the development/runtime classification. In particular, the API package declares an ISC-licensed `semver` dependency; do not describe every runtime-declared transitive dependency as MIT. Optional platform packages and actual bundled modules must be considered separately.

## Development-tooling license scope

The coordinator reviewed installed license families including **MIT, Apache-2.0, ISC, BSD-3-Clause, BSD-2-Clause, Python-2.0** (`argparse`), **CC-BY-4.0** (`caniuse-lite` data), **BlueOak-1.0.0**, and **0BSD**, plus the expressions below. Current package versions, locations, and selected licenses are recorded by the installed inventory; family names or historical counts are not a substitute for that evidence.

| Tooling component | Installed version | Declared expression | Treatment |
| --- | --- | --- | --- |
| `jszip` | 3.10.1 | `(MIT OR GPL-3.0-or-later)` | Select **MIT**, as permitted by `node_modules\jszip\LICENSE.markdown`. Copyright (c) 2009–2016 Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso. |
| `opener` | 1.5.2 | `(WTFPL OR MIT)` | Select **MIT**, as permitted by `node_modules\opener\LICENSE.txt`. Copyright © 2012–2020 Domenic Denicola. |
| `pako` | 1.0.11 | `(MIT AND Zlib)` | Preserve **both** MIT and Zlib notices; this is not a choice between them. See the notices below and source headers under `node_modules\pako\lib\zlib`. |

The intended visual-only distribution does not redistribute the development `node_modules` tree or tooling source. Therefore this document does not reproduce every development dependency's license text. If tooling, dependency source, development bundles, or datasets are redistributed, retain the relevant upstream license/NOTICE files and satisfy their terms, including attribution where required. Choosing MIT for an `OR` expression does not remove MIT's notice requirement; the `AND` expression for pako requires both sets of terms.

## powerbi-visuals-api 5.11.1

```text
MIT License

Copyright (c) Microsoft Corporation. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE
```

## powerbi-visuals-utils-formattingmodel 7.1.0 and powerbi-visuals-tools 7.2.1

Both installed packages carry the following notice:

```text
MIT License

Copyright (c) Microsoft Corporation.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE
```

## Formatting, data-view, and type utilities 7.0.0

`powerbi-visuals-utils-formattingutils`, `powerbi-visuals-utils-dataviewutils`, and `powerbi-visuals-utils-typeutils` each carry the following notice:

```text
Power BI Visualizations

Copyright (c) Microsoft Corporation

All rights reserved.

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## semver 7.8.5

```text
The ISC License

Copyright (c) Isaac Z. Schlueter and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR
IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

## pako 1.0.11: MIT and Zlib

MIT notice from `node_modules\pako\LICENSE`:

```text
(The MIT License)

Copyright (C) 2014-2017 by Vitaly Puzrin and Andrei Tuputcyn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

Zlib notice retained from `node_modules\pako\lib\zlib\deflate.js` (source comment markers omitted):

```text
(C) 1995-2013 Jean-loup Gailly and Mark Adler
(C) 2014-2017 Vitaly Puzrin and Andrey Tupitsin

This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
  claim that you wrote the original software. If you use this software
  in a product, an acknowledgment in the product documentation would be
  appreciated but is not required.
2. Altered source versions must be plainly marked as such, and must not be
  misrepresented as being the original software.
3. This notice may not be removed or altered from any source distribution.
```

## Original materials and documentation

The icon geometry and its dependency-free rasterizer are original project assets; the sample categories and values are invented project examples. No third-party icon set, font, screenshot, or customer dataset is included in those materials.

Microsoft documentation/schema URLs in the sample and documentation identify the relevant file formats and requirements. They do not indicate Microsoft's endorsement, validation, or certification of this project.
