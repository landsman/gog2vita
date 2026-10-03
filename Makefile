.DEFAULT_GOAL := help
PYTHON ?= python3
SCRIPT := extract_for_vita.py
INSTALLER ?=

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Extraction
.PHONY: extract
extract: ## extract game data, asks which installer in gog/ when there are several
	$(PYTHON) $(SCRIPT) $(if $(INSTALLER),"$(INSTALLER)")

.PHONY: clean
clean: ## delete the extracted game data
	rm -rf openmohaa devilutionx

##@ Setup
.PHONY: tools
tools: ## list which extraction tools are on PATH
	@for t in innoextract 7z 7zz 7za unzip; do printf '%-12s %s\n' $$t "$$(command -v $$t || echo missing)"; done

.PHONY: deps
deps: ## install innoextract and 7-Zip with brew or apt
	@if command -v brew >/dev/null; then brew install innoextract p7zip; else sudo apt install -y innoextract p7zip-full; fi

##@ Quality assurance
.PHONY: lint
lint: ## check the scripts compile
	$(PYTHON) -m py_compile $(SCRIPT) games/*.py

.PHONY: test
test: ## run the tests against a fake installer layout
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) extract_for_vita.test.py -v
