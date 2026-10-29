# One command checks everything: agents, people and CI run the same `make check`.
.PHONY: check lint typecheck test audit secrets

check: lint typecheck test audit secrets
	@echo "check: all passed"

lint:
	npx biome ci .

typecheck:
	npx tsc --noEmit

test:
	node --test

audit:
	npm audit --omit=dev --audit-level=high

# Scans the working tree and git history for committed secrets.
secrets:
	@command -v gitleaks >/dev/null || { echo "gitleaks not installed: https://github.com/gitleaks/gitleaks/releases"; exit 1; }
	gitleaks git --no-banner --redact .
	gitleaks dir --no-banner --redact --max-target-megabytes 1 src test public
