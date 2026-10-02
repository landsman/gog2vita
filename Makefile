.DEFAULT_GOAL := help
PYTHON ?= python3
OUT := OpenMoHAA_Vita_GameData

.PHONY: help
help: ## show this help
	@awk 'BEGIN {FS = ":.*##"; print "usage: make <target>\n"} \
		/^##@/ { printf "\n\033[1m%s:\033[0m\n", substr($$0, 5); next } \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-22s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

##@ Extraction
.PHONY: extract
extract: ## extract game data: make extract INSTALLER=path/to/setup_medal_of_honor_*.exe
	@test -n "$(INSTALLER)" || { echo "set INSTALLER=path/to/setup_medal_of_honor_*.exe"; exit 1; }
	$(PYTHON) extract_mohaa_for_vita.py "$(INSTALLER)"

.PHONY: clean
clean: ## delete the extracted game data
	rm -rf $(OUT)

##@ Setup
.PHONY: tools
tools: ## list which extraction tools are on PATH
	@for t in innoextract 7z 7zz 7za unzip; do printf '%-12s %s\n' $$t "$$(command -v $$t || echo missing)"; done

.PHONY: deps
deps: ## install innoextract and 7-Zip with brew or apt
	@if command -v brew >/dev/null; then brew install innoextract p7zip; else sudo apt install -y innoextract p7zip-full; fi

##@ Quality assurance
.PHONY: lint
lint: ## check the script compiles
	$(PYTHON) -c "import ast; ast.parse(open('extract_mohaa_for_vita.py').read())"

.PHONY: test
test: ## run the tests against a fake installer layout
	PYTHONDONTWRITEBYTECODE=1 $(PYTHON) -m unittest -v test_extract_mohaa_for_vita
