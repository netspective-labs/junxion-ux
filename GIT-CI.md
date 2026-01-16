## GitCI (JunxionUX CI/CD Model)

GitCI is a local-first, Unix-style continuous integration approach used by JunxionUX to prepare, test, and publish browser bundles before code is pushed. Instead of relying on hosted CI runners, GitCI shifts responsibility to developers’ machines using Git hooks such as pre-commit and pre-push.

The goal is simple: browser bundles are built, validated, and proven locally before they ever reach the repository. For JunxionUX, this means browser-ready artifacts can be committed with confidence and served directly from GitHub, which we use as a lightweight CDN for now.

### What GitCI Is

GitCI performs the same role as GitHub Actions or other hosted CI systems, but without centralized infrastructure. Developers run the CI checks locally, using the same scripts and rules that define integration readiness. If the checks pass locally, the change is safe to push.

This model works well for small to medium projects, especially when contributors already build, lint, and test code locally. Reproducibility and isolation can be handled with existing tools like Nix, containers, or sandboxes, without baking those concerns into the CI system itself.

### Why JunxionUX Uses GitCI

For JunxionUX, GitCI is optimized around frontend delivery:

• Browser bundles are generated locally
• Bundles are tested in the same environment they are built
• Failures are caught before pushing
• GitHub hosts the resulting artifacts as a CDN

This keeps CI fast, deterministic, and developer-owned, while avoiding slow or opaque remote runners.

### Design Principles

GitCI is local-first. It behaves like Git itself: a tool you run on your own machine. Initializing CI is no heavier than initializing a repository. Servers and daemons are optional, not required.

CI rules live with the trusted base branch and define what a candidate change must satisfy. This prevents contributors from weakening or bypassing checks in their own changes.

The system is intentionally minimal and composable. CI logic can be written in any language or scripting environment and integrated with standard Unix tooling.

### Core Concepts

GitCI evaluates a candidate change against a known-good base, typically the main branch. The base defines the rules. The candidate is what gets validated.

A CI run consists of jobs and steps:

• Jobs are parallel units of work started dynamically
• Steps are named sections within a job, tracked independently
• Steps can fail strictly or be marked informational
• A run passes only if all jobs complete successfully

Everything is orchestrated through a single CLI, which acts as the API for CI execution.

### Developer Workflow

Developers run GitCI checks automatically through Git hooks such as pre-commit or pre-push. This ensures that:

• Browser bundles are built and verified locally
• Linting, formatting, and tests are enforced consistently
• Invalid or broken artifacts never reach the repository

Maintainers can optionally use a local merge-queue daemon to batch, validate, and merge changes without manual supervision, but this is not required for everyday development.
