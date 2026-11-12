# blog-cms-pipeline-test

A scratch repository. It tests a Git-based blog editor in front of a Hugo site that is served by a Cloudflare Worker, with a preview per pull request. Everything here is made up: the company, the pages and the posts. Nothing in it is real or secret.

## Shape

- `content/` holds the "custom" pages (home, about, services). `content/blog/` is the one folder a blog editor may touch.
- `scripts/build.sh` builds the site (`public/`), or `scripts/build.sh preview` (`.preview/`, with a noindex header).
- Workflows: **Deploy Prod** (push to `main`), **Preview Branch** (every pull request, address posted on it), **Preview Cleanup** (when the pull request closes).
- Needs the Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## What is being tested

Whether a new post made in a CMS opens a branch and a pull request, whether each save starts the preview, and whether a branch rule can let a blog-only change publish while anything else needs an approval. The questions and results are kept outside this repository.
