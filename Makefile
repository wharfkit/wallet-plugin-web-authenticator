SHELL := /bin/bash
SRC_FILES := $(shell find src -name '*.ts')
TEST_FILES := $(shell find test/tests -name '*.ts')
BIN := ./node_modules/.bin
MOCHA_OPTS := -u tdd -r ts-node/register -r tsconfig-paths/register -r test/setup.ts --extension ts
NYC_OPTS := --temp-dir build/nyc_output --report-dir build/coverage

lib: ${SRC_FILES} package.json tsconfig.json node_modules rollup.config.js
	@${BIN}/rollup -c && touch lib

.PHONY: test
test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' MOCK_DIR='./test/data' \
		${BIN}/mocha ${MOCHA_OPTS} ${TEST_FILES} --grep '$(grep)'

build/coverage: ${SRC_FILES} ${TEST_FILES} node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' \
		${BIN}/nyc ${NYC_OPTS} --reporter=html \
		${BIN}/mocha ${MOCHA_OPTS} -R nyan ${TEST_FILES}

.PHONY: coverage
coverage: build/coverage
	@open build/coverage/index.html

.PHONY: ci-test
ci-test: node_modules
	@TS_NODE_PROJECT='./test/tsconfig.json' MOCK_DIR='./test/data' \
		${BIN}/nyc ${NYC_OPTS} --reporter=text \
		${BIN}/mocha ${MOCHA_OPTS} -R list ${TEST_FILES}

.PHONY: check
check: node_modules
	@${BIN}/eslint src --ext .ts --max-warnings 0 --format unix && echo "Ok"

.PHONY: format
format: node_modules
	@${BIN}/eslint src --ext .ts --fix

.PHONY: publish-base
publish-base: | distclean node_modules
	@git diff-index --quiet HEAD || (echo "Uncommitted changes, please commit first" && exit 1)
	@git fetch origin && git diff origin/master --quiet || (echo "Changes not pushed to origin, please push first" && exit 1)
	@yarn config set version-tag-prefix "" && yarn config set version-git-message "Version %s"

.PHONY: publish
publish: publish-base
	@yarn publish --access public && git push && git push --tags

.PHONY: publish-next
publish-next: | distclean node_modules
	@yarn config set version-tag-prefix "next" && yarn config set version-git-message "Next version %s"
	@yarn publish --tag next --access public && git push && git push --tags

.PHONY: docs
docs: build/docs
	@open build/docs/index.html

build/docs: $(SRC_FILES) node_modules
	@${BIN}/typedoc --out build/docs \
		--excludeInternal --excludePrivate --excludeProtected \
		--includeVersion --hideGenerator --readme none \
		src/index.ts

build/pages: build/docs test/browser.html
	@mkdir -p build/pages
	@cp -r build/docs/* build/pages/
	@cp test/browser.html build/pages/tests.html

.PHONY: deploy-pages
deploy-pages: | clean build/pages node_modules
	@${BIN}/gh-pages -d build/pages

test/browser.html: $(SRC_FILES) $(TEST_FILES) test/rollup.config.js node_modules
	@${BIN}/rollup -c test/rollup.config.js

.PHONY: browser-test
browser-test: test/browser.html
	@open test/browser.html

node_modules:
	yarn install --non-interactive --frozen-lockfile --ignore-scripts

.PHONY: clean
clean:
	rm -rf lib/ build/ test/browser.html

.PHONY: distclean
distclean: clean
	rm -rf node_modules/
