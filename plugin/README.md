# GitHub Publish (Obsidian plugin)

Publish vault notes to GitHub Pages without local git.

## Build

From the repo root:

```bash
npm run build:plugin
```

This runs `sync:toolchain` (refreshes toolchain manifests and Quartz bundle) then compiles the plugin.

Or from this directory (after `npm run sync:toolchain` from the repo root):

```bash
npm install
npm run build
```

## Install for testing

1. Copy or symlink this `plugin/` folder to your vault:
   ```
   .obsidian/plugins/github-publish/
   ```
2. Ensure the folder contains: `manifest.json`, `main.js`, `styles.css`, `assets/toolchain-inhouse/`, `assets/toolchain-quartz/`
3. Enable the plugin in Obsidian → Settings → Community plugins
4. Open Settings → GitHub Publish and click **Connect to GitHub**
5. Run command palette → **GitHub Publish: Set up site**

If publish fails with an `UpdateRef` permissions error, disconnect and reconnect so your token includes the `workflow` scope.

## Template engines

Default engine is **Quartz** (Obsidian-flavored markdown, graph, backlinks).

To test the built-in Vite template locally, build with advanced settings enabled:

```bash
npm run build:plugin:advanced
```

This shows template engine and Quartz version controls in plugin settings.

## Debugging

Open Obsidian's developer console to see plugin logs:

- **macOS:** `Cmd + Option + I`
- **Windows / Linux:** `Ctrl + Shift + I`
- Or use the command palette → **Toggle developer tools**

Filter the console by `GitHub Publish` to see API calls, retries, and errors.

During upload, the progress modal shows live status (including repository readiness retries). Retries after a 409 can take up to ~2 minutes before initialization falls back to the Contents API.

## Scope

- Initial publish via **Git Database API** (single commit) + GraphQL `updateRef`
- Incremental publish (content diff only)
- GitHub Device Flow authentication
- Progress monitoring via GitHub Actions API
- Quartz or built-in template engine
