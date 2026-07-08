# Quartz customization

The plugin ships with a pinned Quartz toolchain embedded in `main.js` (see
`assets/toolchain-quartz/`). This document describes how users customize that
toolchain per published site.

## Phase 1 — editable `quartz.config.yaml` (implemented)

Users can override `quartz.config.yaml` on a per-site basis. The embedded config
remains the default; an override, when present, wins for that site.

### Storage

Overrides live outside the vault content, in the plugin directory:

```
<vault>/<configDir>/plugins/github-publish/sites/<owner>_<repo>/quartz.config.yaml
```

Reads/writes go through Obsidian's `vault.adapter` (`exists`, `read`, `write`,
`mkdir`, `remove`) so no Node `fs` access is needed. See
[`src/publish/siteConfig.ts`](../src/publish/siteConfig.ts).

### Editing

The **Edit Quartz config** button on each published-site card opens
[`QuartzConfigModal`](../src/ui/QuartzConfigModal.ts):

- On open it loads the saved override, or seeds the editor with the embedded
  default resolved for that site (placeholders like `{{pageTitle}}` and
  `{{baseUrl}}` already substituted).
- **Save** writes the override. If the content is identical to the default, the
  override file is removed so the site falls back to the embedded config.
- **Reset to default** repopulates the editor with the default (removed on save).
- **Show in Finder** (macOS) / **Show in Explorer** (Windows) writes the current
  editor content to disk and reveals `quartz.config.yaml` in the system file
  manager so you can edit it in an external YAML editor (e.g. VS Code).
- Link to [Quartz configuration](https://quartz.jzhao.xyz/configuration) docs in
  the modal header.

### Publish integration

- `resolveDefaultQuartzConfig()` / `publishBundleContextFromSite()` in
  [`bundleToolchain.ts`](../src/publish/bundleToolchain.ts) produce the resolved
  default for a site; `loadPublishToolchainFiles(context, overrides)` accepts
  per-path overrides.
- Each `PublishedSite` stores `configHash` — the hash of the config last
  published. `getSiteConfigChange()` compares the current override against that
  baseline (falling back to the embedded default hash for legacy sites).
- `detectUnpublishedChanges()` reports `configChanged`, so the **Publish
  changes** button lights up even when only the config changed.
- `runPublishChanges()` adds `quartz.config.yaml` to the commit when the override
  differs, and updates `configHash` afterwards. Config is committed at the repo
  root and is **not** tracked in the content manifest (which only covers
  `content/`).

### What is intentionally not editable in Phase 1

`quartz.lock.json` (plugin version pins), `.github/workflows/deploy.yml`, and
`.gitignore` stay on embedded defaults. Editing them safely needs version-aware
upgrades and the `workflow` OAuth scope.

## Phase 2 — user static files (planned)

Goal: let users ship site-level static assets — most importantly a favicon
(`quartz/static/icon.png`), plus custom images/CSS. The bundled config already
enables the favicon plugin:

```yaml
- source: github:quartz-community/favicon
  enabled: true
```

but nothing uploads a user icon today, and CI never copies it.

### How it would work

1. **Local override folder.** Reuse the Phase 1 per-site directory and add a
   `quartz/static/` subtree:

   ```
   .../plugins/github-publish/sites/<owner>_<repo>/quartz/static/icon.png
   ```

   A settings action (“Open site folder” / “Add favicon…”) helps users drop files
   in. On desktop this can reveal the folder via the file manager, or accept a
   file picker and copy bytes through `vault.adapter`.

2. **Include static files in the upload set.** The toolchain manifest
   (`files.json`) is fixed and has no `quartz/static/**`. Extend the publish
   bundling to walk the per-site `quartz/` override directory and add every file
   as a `RepoFile` (binary files as `base64`, matching `readRepoFile`). These are
   committed at the repo root under `quartz/static/...`.

3. **Track and diff static files.** Add a second manifest on `PublishedSite`
   (e.g. `toolchainManifest: Record<string, string>`) hashing each override path,
   mirroring the existing content manifest. `detectUnpublishedChanges()` and
   `runPublishChanges()` include added/updated/deleted static files, so
   incremental publishes pick up favicon changes.

4. **CI overlay (required).** The deploy workflow currently copies only the
   config and lockfile onto the cloned engine:

   ```yaml
   - name: Overlay user site
     run: |
       rm -rf quartz-engine/content
       cp -r content quartz-engine/content
       cp quartz.config.yaml quartz.lock.json quartz-engine/
   ```

   It must also copy the `quartz/` overlay when present, e.g.:

   ```yaml
       cp quartz.config.yaml quartz.lock.json quartz-engine/
       [ -d quartz ] && cp -r quartz/. quartz-engine/quartz/
   ```

   This change ships in `assets/toolchain-quartz/.github/workflows/deploy.yml`,
   so existing sites only get it after their `deploy.yml` is re-published (a
   toolchain upgrade), not automatically.

### Open questions for Phase 2

- **Editing binary assets in-app** is awkward; a reveal-in-file-manager or file
  picker is likely better than an in-modal editor.
- **Workflow re-publish:** shipping the new `deploy.yml` overlay to already
  published sites needs an explicit “update site toolchain” action and the
  `workflow` scope.
- **Validation:** warn on oversized images and non-allowed extensions before
  uploading.
