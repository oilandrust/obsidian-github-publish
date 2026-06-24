# GitHub Publish (Obsidian plugin)

Publish vault notes to GitHub Pages without local git.

## Build

From the repo root:

```bash
npm run build:plugin
```

Or from this directory (after `npm run sync:toolchain` from root):

```bash
npm install
npm run build
```

## Install for testing

1. Copy or symlink this `plugin/` folder to your vault:
   ```
   .obsidian/plugins/github-publish/
   ```
2. Ensure the folder contains: `manifest.json`, `main.js`, `styles.css`, `assets/toolchain/`
3. Enable the plugin in Obsidian → Settings → Community plugins
4. Create a [GitHub OAuth App](https://github.com/settings/developers) (no callback URL needed)
5. Enter the **Client ID** in Settings → GitHub Publish
6. Connect GitHub (device flow requests `repo` and `workflow` scopes — required because publish commits include `.github/workflows/deploy.yml`)
7. Run command palette → **GitHub Publish: Set up site**

If publish fails with an `UpdateRef` permissions error, disconnect and reconnect so your token includes the `workflow` scope.

## Debugging

Open Obsidian's developer console to see plugin logs:

- **macOS:** `Cmd + Option + I`
- **Windows / Linux:** `Ctrl + Shift + I`
- Or use the command palette → **Toggle developer tools**

Filter the console by `GitHub Publish` to see API calls, retries, and errors.

During upload, the progress modal shows live status (including repository readiness retries). Retries after a 409 can take up to ~2 minutes before initialization falls back to the Contents API.

## Prototype scope

- First-time setup wizard only
- Initial publish via **Git Database API** (single commit) + GraphQL `updateRef`
- GitHub Device Flow authentication
- Progress monitoring via GitHub Actions API

Re-publish with content diff is not implemented yet.
