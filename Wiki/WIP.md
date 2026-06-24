Yes — single-commit upload is doable. Contents API was a workaround; it isn’t the long-term design. Here’s how to think about it given what we’ve learned in Obsidian.

## What actually broke

|Step|API|Status in Obsidian|
|---|---|---|
|Create blobs|`POST /git/blobs`|Works|
|Create trees|`POST /git/trees`|Works|
|Create commit|`POST /git/commits`|Works|
|Move `main` to that commit|`PATCH /git/refs/heads/main`|404 every time|
|Contents API|`PUT /contents/{path}`|Works (but 1 commit/file)|

So the Git Database API path is ~95% there. The blocker is updating the branch ref, not building the commit.

GraphQL `updateRef` returned HTTP 200 in your logs — we never fully confirmed the branch moved. That path may still work, but it wasn’t validated end-to-end.

---

## Option A: Fix ref update only (smallest change)

Keep: blobs → hierarchical trees → commit (with parent = current `main`).

Replace PATCH with one of:

1. `fetch()` instead of `requestUrl` for PATCH  
    Obsidian’s `requestUrl` may mishandle PATCH; desktop Electron often has native `fetch`. One PATCH to update `main` — if that works, the existing Git DB flow is done.
    
2. GraphQL `updateRef` (POST only)  
    Already attempted. Worth a focused test: after mutation, `GET ref/heads/main` and confirm SHA matches.
    
3. GraphQL `createCommitOnBranch`  
    Creates the commit and moves the branch in one mutation — no separate ref update. Can take `fileChanges.additions[]` with path + base64 content for all files, or combine with pre-built trees depending on API shape.
    

Best first experiment: native `fetch` PATCH — smallest diff if it works.

---

## Option B: Single GraphQL mutation with all file contents

`createCommitOnBranch` accepts multiple `additions` in one call:

mutation {

createCommitOnBranch(input: {

branch: { repositoryNameWithOwner: "oilandrust/publish", branchName: "main" }

message: { headline: "Initial publish from Obsidian" }

fileChanges: {

additions: [

{ path: "content/foo.md", contents: "base64..." }

# ... all 28 files

]

}

expectedHeadOid: "current-head-sha" # if branch exists

}) { commit { oid } }

}

Pros: One POST, one commit, no PATCH, no per-file Contents API.  
Cons: Entire payload in one JSON body. Fine for ~28 toolchain + 5 markdown files; won’t scale to large vaults with images/`package-lock.json` megabytes.

Hybrid: small publishes via GraphQL `fileChanges`; large ones via REST blobs/trees + GraphQL commit/branch update.

---

## Option C: REST for objects, GraphQL only for “land commit on branch”

1. `POST` blobs (N times — unavoidable for large/binary unless using GraphQL per-file)
2. `POST` trees (hierarchical — already works)
3. One GraphQL mutation to create commit on branch from that tree, or `createCommit` + `updateRef` via GraphQL only

All ref-moving traffic stays on `POST https://api.github.com/graphql`, which works in Obsidian.

This matches the architecture doc’s Git Database API model, with GraphQL substituting for broken REST PATCH.

---

## Option D: Real git push in the plugin (heavier)

Use isomorphic-git (or similar): build tree + commit in memory, `git.push` over HTTPS with the OAuth token.

Pros: Standard git semantics, one push = one commit, scales well.  
Cons: Large bundle, more code, auth/credential plumbing — conflicts with “no git binaries” unless the JS library is acceptable.

---

## Option E: Out-of-process publish (last resort)

A small Node script (or Cursor automation) runs outside Obsidian with full `fetch`/git. Plugin triggers it or user runs `npm run publish`. Defeats “one-click in Obsidian” but trivially gets one commit.

---

## Recommended path (when you implement)

Small under ~2MBLarge404200Scan vault + bundle toolchainTotal payload size?GraphQL createCommitOnBranch with all additionsREST: blobs + hierarchical treeLand commit on mainTry fetch PATCH refGraphQL createCommitOnBranch or updateRefDone - triggers Actions

Priority order:

1. `fetch` PATCH — 10-line experiment; completes current pipeline if it works.
2. `createCommitOnBranch` — best single-request story for prototype-sized publishes.
3. REST blobs/trees + GraphQL branch update — scales to larger vaults.
4. isomorphic-git — if GitHub REST+GraphQL ref updates stay unreliable in Obsidian.

---

## What to drop

- Contents API for full publish — good for probing, not for production (28+ commits, slow, noisy history, `.github/` path quirks).
- `.github-publish-init` bootstrap — only needed for empty-repo Git API; Contents init or `auto_init` goes away once ref update works.

---

## Open question to settle before coding

Run one deliberate test on `oilandrust/publish`:

1. Build blobs + tree + commit via REST (already works).
2. Update `main` with `fetch` PATCH vs GraphQL `createCommitOnBranch` vs `updateRef`.
3. Verify with `GET ref/heads/main`.

Whichever lands the commit on `main` in one shot becomes the primary path; the others are fallbacks.

I’d start with `fetch` PATCH and `createCommitOnBranch` in parallel — one of them should give you single-commit upload without abandoning the Git Database API model.