# Bundled report fonts

Unmodified Noto Sans Regular/Bold, Noto Sans Arabic Regular and Noto Sans Malayalam Regular. All four files are distributed under the included SIL Open Font License 1.1 (`OFL.txt`). Copyright remains with the Noto Project Authors. These are application assets, not Windows system fonts.

`manifest.json` records each official notofonts/noto-fonts source URL pinned to commit `ffebf8c1ee449e544955a7e813c54f9b73848eac` and its SHA-256 checksum. Tests verify these bytes and the license. Upstream license: https://github.com/notofonts/noto-fonts/blob/ffebf8c1ee449e544955a7e813c54f9b73848eac/LICENSE . Noto guidance: https://github.com/notofonts/noto-docs/blob/main/docs/website/use.md .

PDF preparation embeds font subsets through Chromium. Browser text layout performs script shaping, bidirectional ordering and fallback. No network font requests or machine-installed fonts are required for supported report text. Latin (including accented names), Arabic and Malayalam are exercised in acceptance; this is not a claim to support every Unicode script or emoji. A glyph coverage check returns an understandable error and offers Excel if an additional font is needed. Additional client languages require representative-text review and licensed fonts before acceptance.
