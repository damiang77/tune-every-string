# Cloudflare Workers Static Assets deployment — issue #15

The existing application is hosted at
[the temporary Worker URL](https://tune-every-string.damiangarbera.workers.dev).
The Worker name is `tune-every-string`; the account's workers.dev subdomain is
`damiangarbera`. The supplied URL replaces the Pages hosting assumption in #15.
This implementation serves static assets through Workers, with no application
Worker script, server function, backend, service worker or custom domain.

`wrangler.json` publishes only `dist`, including the generated `_headers` rules.
HTML handling removes trailing slashes and serves each route's own directory
index. Unknown routes return 404 rather than falling back to English HTML.
The deployment job depends on the complete quality job, including browser checks.

## Account setup

1. Use the existing Worker in the account owning `damiangarbera.workers.dev`.
   Disable any automatic Workers Builds production deployment that could bypass
   GitHub quality checks or the release approval gate. Do not create a Pages project.
2. In GitHub repository Settings → Environments, create `preview` and `production`.
   Restrict `production` to `main`, require a maintainer review, and prevent
   self-review. Keep production disabled until the approvals in #27 are recorded
   for the release commit. If required reviewers are unavailable for this repository,
   keep production disabled and resolve that release gate before enabling it.
3. Add environment secrets `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` to
   each environment. Use a token with Workers Scripts Edit and Account Settings Read
   permissions, restricted to the intended account. Keep credentials out of source
   and chat. A Pages-only token cannot deploy this Worker.
4. Set repository variable `CLOUDFLARE_DEPLOYMENTS_ENABLED=true` to enable uploads.
   Leave `PRODUCTION_RELEASE_APPROVED` unset while #27 is blocked.
5. Require the `Quality checks` status check before merging to `main`.

Cloudflare documents [static asset configuration](https://developers.cloudflare.com/workers/static-assets/),
[HTML routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
and [version preview URLs](https://developers.cloudflare.com/workers/configuration/previews/).
Wrangler is pinned to 4.151.2 in CI. Account credentials, GitHub protection and
existing Cloudflare build triggers still need account-side verification.

## Preview and release flow

After quality checks pass, same-repository pull requests run
`wrangler versions upload --preview-alias=pr-N`. This uploads an undeployed version
of the existing Worker, without changing the live production version. The preview
is `https://pr-N-tune-every-string.damiangarbera.workers.dev`. Version preview URLs
are enabled in `wrangler.json`. Fork PRs run quality checks without credentials
or upload; move reviewed changes to a repository branch to preview them.

Generated canonical/alternate metadata uses the target URL, and deployed smoke
checks run against that same URL. The workflow environment and summary link to
the candidate, privacy pages, repository copyright and release approvals.

After #27 has evidence for the exact release commit, a maintainer may set
`PRODUCTION_RELEASE_APPROVED=true`. Successful `main` push runs can then reach the
protected production environment and wait for approval. Review the commit and
quality results before approving each deployment; the variable alone is not a
release approval. Production runs `wrangler deploy` to update the existing URL.
Disable the variable again when production should be paused.

A failed deployed smoke test does not roll back an upload. For a production
failure, restore the previous approved Worker deployment in Cloudflare before
retrying. Version previews remain available until removed or superseded; they
are not automatically deleted when a PR closes.

## Deployed checks and evidence

```bash
DEPLOYED_ORIGIN=https://pr-N-tune-every-string.damiangarbera.workers.dev \
  npx playwright test --project=chromium
```

The deployed origin must be HTTPS without a trailing slash. Without
`DEPLOYED_ORIGIN`, the suite builds and serves locally as before. Protected
previews need a separately configured access mechanism before CI can test them.

The suite checks direct localized HTML, refresh, canonical metadata, security
headers, accessibility, settings persistence, capture failure recovery and injected
microphone teardown through the real pitch worker. Both languages and Reference
Tone modes exercise same-origin requests and CSP console checks. The repeatable
local CDP performance budget is skipped remotely because network conditions differ.
Browser reports and traces are retained for seven days in GitHub Actions.
Injected audio does not establish real microphone behavior; complete the physical
hardware and manual checks in [release readiness](release-readiness.md).

Record the deployment URL, commit SHA, CI run and smoke report in #15. Keep #15
open until deployed evidence and the Workers hosting change have been accepted.

## Existing deployment observation — 2026-10-19

The supplied root URL returned HTTP 200 with the Vite HTML title `Browser tuner`.
The response lacked the generated Content-Security-Policy, Permissions-Policy,
Referrer-Policy and X-Content-Type-Options headers. The root HTML also lacked
built production canonical/alternate links. This confirms a reachable deployment,
but does not certify the release build, localized routes or runtime behavior.
The workflow builds with the real HTTPS origin before upload to address this.

## Local preparation evidence — 2026-10-19

Before the Workers hosting adjustment, Node 24.15.0 / npm 11.12.1 passed 103 source
tests and 53 production browser tests, with three expected non-Chromium CDP skips.
Formatting, lint, strict type checking, bilingual checks, production build and
bundle budget passed. JavaScript including the worker measured 111,549 gzip bytes.
These are local server results; actual uploads and deployed smoke checks remain
unverified until account setup and release gates permit them.

After the Workers adjustment, the actual-origin production build, Wrangler 4.151.2
`deploy --dry-run`, formatting, lint, type checking and bundle check passed.
Wrangler's local static runtime returned 200 for all four localized routes with
the correct language, canonical URL and all four expected security headers.
`/pl/` redirected to `/pl` with 307; an unknown route returned 404.
The GitHub account inspection found no repository variables or repository secrets,
and only a `copilot` environment, with no protection rules. The `preview` and
`production` environments and deployment credentials therefore still need setup.
No version was uploaded and the existing live deployment was not modified.
