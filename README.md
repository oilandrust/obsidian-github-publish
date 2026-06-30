# Obsidian GitHub Publish

An [Obsidian](https://obsidian.md) plugin that publishes vault notes to **GitHub Pages** for free—no local git required.

Pick a folder in your vault, connect GitHub, and the plugin creates a repository, pushes your notes, and configures GitHub Actions to build and deploy a static site. Updates are a single **Publish changes** click.

![Published site example (dark theme)](Wiki/publish-example-dark.png)

## Features

- **One-click setup** — choose a content folder, site name, and repository; the plugin handles the rest
- **No system git** — commits are created via the GitHub Git Database API over HTTPS
- **Quartz by default** — Obsidian-flavored markdown, backlinks, and graph view out of the box
- **Incremental publishes** — only changed notes are uploaded after the initial publish
- **Multi-site** — publish several folders from one vault to separate repositories
- **Progress tracking** — monitors GitHub Actions until the site is live

## How it works

1. You authenticate with GitHub (device flow OAuth).
2. On first publish, the plugin creates a repo containing your notes under `content/`, a pinned [Quartz](https://quartz.jzhao.xyz/) toolchain, and a deploy workflow.
3. A commit to `main` triggers GitHub Actions, which builds `dist/` and deploys to GitHub Pages.
4. Later publishes diff your vault folder against a stored manifest and push only what changed.

See [Wiki/Publish Architecture.md](Wiki/Publish%20Architecture.md) for the full design.

## Install

This plugin is not yet on the Obsidian Community Plugins store. Install manually:

### From a release (recommended)

1. Download the latest release assets (or build locally—see below).
2. Copy or symlink the `plugin/` folder into your vault:

   ```
   <vault>/.obsidian/plugins/github-publish/
   ```

3. Enable **GitHub Publish** under Settings → Community plugins.
4. Open Settings → **GitHub Publish** → **Connect to GitHub**.
5. Run the command palette → **GitHub Publish: Set up site**.

### Symlink for development

```bash
ln -s /path/to/obsidian-github-publish/plugin \
  ~/path/to/vault/.obsidian/plugins/github-publish
```

After changing plugin code, rebuild and reload Obsidian (or use the **Reload app without saving** command).

## Usage

| Command | Description |
|---------|-------------|
| **GitHub Publish: Set up site** | Wizard for a new published site |
| **GitHub Publish: Publish changes** | Push note updates (picks a site if you have several) |
| **GitHub Publish: Continue publish** | Resume an interrupted first publish |

Published sites appear as cards in the plugin settings, each with its own **Publish changes** button and live status.

If publish fails with an `UpdateRef` permissions error, disconnect and reconnect GitHub so your token includes the `workflow` scope.

## Development

Requirements: Node.js 20+ and npm.

```bash
git clone https://github.com/oilandrust/obsidian-github-publish.git
cd obsidian-github-publish
npm run build:plugin
```

| Script | Purpose |
|--------|---------|
| `npm run build:plugin` | Sync toolchains and build the plugin |
| `npm run build:plugin:advanced` | Build with extra settings (template engine, Quartz version) |
| `npm run sync:toolchain` | Refresh bundled Quartz and in-house toolchains |
| `npm run build` | Plugin only (assumes toolchains already synced) |

More detail: [plugin/README.md](plugin/README.md).

### Repository layout

```
plugin/          Obsidian plugin (manifest, main.ts, bundled toolchains)
  assets/
    toolchain-quartz/   Default static site generator (Quartz)
    toolchain-inhouse/  Alternative Vite + React template
scripts/         Build and toolchain sync helpers
template/        Standalone in-house site template (local dev)
Wiki/            Design notes and specifications
```

## Status

Early prototype (v0.1.0). Expect rough edges. Desktop only.

## License

[MIT](LICENSE) © [oilandrust](https://github.com/oilandrust)
