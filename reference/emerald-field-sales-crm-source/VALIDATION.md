# Export validation — 2026-10-20

## Source and runtime

Verified title, business type, portfolio route, rewrite and original requirements identify Emerald Field Sales CRM, separately from AquaFleet. The selected original HTML, SVG, requirements and reference test match recorded Git HEAD. Packaging checks exported copies byte-for-byte against source. No source refactor or implementation was made.

Node.js syntax validation of extracted inline JavaScript exited 0. The temporary loopback-only Python server served the documented public root; HTML and favicon returned HTTP 200. No npm build, credentials or backend were needed.

Fresh Playwright/installed Microsoft Edge checks ran against the exported copy in an isolated browser context using only synthetic records. Passed: initial dashboard, five modules, 36 seeded shops; existing-shop search and eight-visit history; check-in without granted GPS permission; checkout with required notes and follow-up; ninth visit shown; dashboard visibility; new lead capture with immediate first check-in; checkout; persistence after browser reload; reset confirmation restoring 36 shops. All five modules were navigable without page-level horizontal overflow at 1440, 1024 and 390 px. No page exceptions or HTTP 4xx/5xx were observed. Observed page HTTP requests were only the local HTML and SVG favicon.

Confirmed source defect: selecting a different Viewing as option does not update stored identity because the listener is attached to #content, outside the selector's ancestor chain. Happy-path checks used initial Ahmed identity. No correct role switching, real authorization or multi-user behavior is claimed. Other source issues are documented in the inventory.

The original full-site acceptance script was preserved as reference and was not run unchanged; it assumes original portfolio pages, an environment-specific Playwright path/Edge and a fixed historical date. Fresh checks used current source labels and dynamic dates. Early local harness attempts had environment/selector mismatches; the final run passed the checks above without changing application source. Supporting raw test results are retained in the producing workspace as preview-validation.json.

## Packaging and secrets

The packaging script constructs an explicit 11-file allowlist ZIP and verifies exact member names, safe paths, ZIP CRC, staged-byte equality and every SHA256SUMS.txt hash. The manifest lists all other files and excludes itself. Its execution result is the authority for completion of these checks.

All archived text/source is scanned for private keys, AWS/GitHub/Google/Stripe/OpenAI-style keys or tokens, JWTs, literal credential assignments, credential-bearing URLs and bearer-token literals. The script aborts on any match. Filenames exclude .env*, .git, node_modules, .next, caches and private configuration directories. Only selected demo sources, its original requirements/reference test and new handoff documentation are allowed; unrelated client source/data and full-site backend/config files are excluded. This is a pattern-based export check, not a security audit or certification.

## Limits

This is a faithful demo baseline with known defects. Responsive checks are bounded smoke tests, not full visual/accessibility/device certification. GPS success/accuracy on real field devices, cross-device sync, auth/access, concurrent visits, UAE midnight behavior, production data/import, security, backups/restore, Zoho integration, deployment and client UAT are not validated. Read DEMO-INVENTORY.md and PROJECT-BACKGROUND.md for production decisions and follow-up work.