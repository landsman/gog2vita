.DEFAULT_GOAL := help
SCRIPT := src/extract_for_vita.ts
INSTALLER ?=

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Extraction
.PHONY: extract
extract: node_modules ## extract game data, asks which installer in games-gog/ when there are several
	bun $(SCRIPT) $(if $(INSTALLER),"$(INSTALLER)")

.PHONY: clean
clean: ## delete the extracted game data
	rm -rf games-vita

##@ Setup
node_modules: package.json bun.lock
	bun install --frozen-lockfile
	@touch node_modules

.PHONY: tools
tools: ## list which extraction tools are on PATH
	@for t in bun innoextract 7z 7zz 7za unzip; do printf '%-12s %s\n' $$t "$$(command -v $$t || echo missing)"; done

.PHONY: deps
deps: ## install innoextract and 7-Zip with brew or apt
	@if command -v brew >/dev/null; then brew install innoextract p7zip; else sudo apt install -y innoextract p7zip-full; fi

##@ Quality assurance
.PHONY: lint
lint: node_modules ## check the types, the formatting and the lint rules
	bun check
	bun run lint

.PHONY: format
format: node_modules ## rewrite the files to the formatter's layout
	bun run format

.PHONY: test
test: node_modules ## run the tests against a fake installer layout
	bun test
