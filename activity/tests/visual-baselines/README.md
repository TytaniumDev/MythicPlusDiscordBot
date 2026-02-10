# Playwright visual baselines

Baseline images for Playwright’s native screenshot comparison live here (or in subdirectories created by Playwright).

**Generate or update baselines** (from the `activity/` directory):

```bash
npx playwright test --update-snapshots
```

Commit any new or changed files under `activity/tests/visual-baselines/` so CI passes.

If you change the activity frontend in ways that affect how pages look (layout, styles, copy), run the command above and commit the updated baseline images in the same PR.
