# Git-based Shopify Theme Workflow

The right long-term setup: the **live theme is connected to the `main` branch** via
Shopify's GitHub integration. You never edit the live theme by hand. You work on
**feature branches**, merge the latest live state in *before* pushing so Git shows
you any conflicts, resolve them, then merge to `main` — which auto-deploys to the
live theme.

- **Repo:** `ramawaterfilter/phoenixwaterfilters_uk`
- **Live branch:** `main` (= live theme)
- **Theme tool:** Shopify GitHub integration + (optional) Shopify CLI for local preview

---

## Part 1 — One-time setup: connect the live theme to `main`

You only do this once per store.

### 1.1 Make sure the repo reflects the current live theme

Before connecting, the code in `main` should match what's live today, otherwise the
first sync will overwrite the live theme with whatever is in the repo.

**Safest path — pull the live theme down first using Shopify CLI:**

```bash
# Install Shopify CLI (one-time, needs Node 18+)
npm install -g @shopify/cli @shopify/theme

# Log in and list themes to find the live theme's ID
shopify theme list --store phoenixwaterfilters-uk.myshopify.com

# Pull the LIVE theme into the current folder (overwrites local files)
shopify theme pull --store phoenixwaterfilters-uk.myshopify.com --live

# Review what changed, then commit it so main == live theme
git status
git add -A
git commit -m "Sync main with current live theme before GitHub integration"
git push origin main
```

> Replace `phoenixwaterfilters-uk.myshopify.com` with your real `.myshopify.com` domain.

### 1.2 Install the Shopify GitHub integration

1. Shopify admin → **Online Store → Themes**.
2. Top-right **Add theme → Connect from GitHub** (or **... → GitHub** on an existing theme).
3. Authorize Shopify to access the `ramawaterfilter` GitHub account.
4. Select:
   - **Repository:** `phoenixwaterfilters_uk`
   - **Branch:** `main`
5. Shopify creates a theme that is now **linked to `main`**.

### 1.3 Make the linked theme the live theme

In **Online Store → Themes**, find the GitHub-connected theme and click
**Actions → Publish**. From now on:

- Any commit pushed to `main` → Shopify auto-pulls and updates the live theme.
- Any edit made in the Shopify theme editor → Shopify auto-commits back to `main`.

> ⚠️ Because the theme editor commits back to `main`, **`main` can change without you**.
> That is exactly why the workflow below always re-syncs `main` before you push.

---

## Part 2 — Daily workflow: feature branch → merge → push

### 2.1 Start from an up-to-date `main`

```bash
git checkout main
git pull origin main          # grab any theme-editor commits Shopify pushed
```

### 2.2 Create a feature branch

```bash
git checkout -b feature/ss-tap-template
```

Name it after the work, e.g. `feature/product-section`, `fix/cart-drawer`.

### 2.3 Do your work and commit

```bash
# ...edit sections / templates / assets...
git add -A
git commit -m "Build SS tap product template"
```

Commit in small, logical chunks — easier to review and to resolve conflicts later.

### 2.4 Re-sync the live state BEFORE pushing (the key step)

While you were working, the live theme (`main`) may have moved — a teammate pushed,
or someone edited content in the Shopify theme editor (which auto-commits to `main`).
Pull `main` into your branch so Git surfaces conflicts **locally**, not on the live site.

```bash
git fetch origin
git merge origin/main         # merge latest live state into your feature branch
```

> Prefer `merge` over `rebase` here. Shopify's theme-editor auto-commits live on
> `main`; rebasing rewrites history and fights those commits. Merge keeps both
> histories intact and makes conflicts explicit.

### 2.5 Resolve conflicts

If Git reports conflicts:

```bash
git status                    # see conflicted files (look for "both modified")
```

Open each conflicted file and resolve the `<<<<<<<` / `=======` / `>>>>>>>` markers.

**Shopify-specific conflict tips:**

- **`config/settings_data.json`** — this holds theme-editor settings and conflicts
  most often. Usually you want the **live** version (`origin/main`) unless your
  change deliberately added a new setting. When unsure, take theirs:
  ```bash
  git checkout --theirs config/settings_data.json
  git add config/settings_data.json
  ```
- **`templates/*.json`** — JSON section ordering. Merge by hand; keep valid JSON.
- **`locales/*.json`** — usually safe to combine both sides' keys.

Then finish the merge:

```bash
git add -A
git commit                    # completes the merge commit
```

### 2.6 (Optional) Preview locally before it goes live

```bash
# Serves your branch to a temporary preview theme — does NOT touch the live theme
shopify theme dev --store phoenixwaterfilters-uk.myshopify.com
```

Open the printed `http://127.0.0.1:9292` URL and verify your changes.

### 2.7 Push the merged result to live

Two options — pick one:

**Option A — Pull Request (recommended, gives review + history):**

```bash
git push origin feature/ss-tap-template
gh pr create --base main --head feature/ss-tap-template \
  --title "SS tap product template" \
  --body "Adds the stainless-steel tap product template and sections."
# After review:
gh pr merge --merge        # merging to main auto-deploys to the live theme
```

**Option B — Direct merge (solo / small change):**

```bash
git checkout main
git pull origin main          # last-second sync
git merge feature/ss-tap-template
git push origin main          # → Shopify auto-updates the live theme
```

### 2.8 Clean up

```bash
git branch -d feature/ss-tap-template
git push origin --delete feature/ss-tap-template
```

---

## Quick reference

```bash
# start
git checkout main && git pull origin main
git checkout -b feature/x

# work
git add -A && git commit -m "..."

# sync before push (surfaces conflicts locally)
git fetch origin && git merge origin/main
# ...resolve conflicts, then: git add -A && git commit

# ship
git push origin feature/x
gh pr create --base main --head feature/x
gh pr merge --merge        # → deploys to live theme
```

---

## Golden rules

1. **Never edit the live theme's code in the Shopify editor.** Content/settings are
   fine (they commit back to `main`); code changes belong in branches.
2. **Always `git merge origin/main` into your branch before pushing.** This is what
   makes conflicts show up in Git instead of breaking the live site.
3. **Treat `config/settings_data.json` as "owned by Shopify."** When in doubt during
   a conflict, take the live (`--theirs`) version.
4. **Keep `main` deployable at all times** — it *is* the live store.
