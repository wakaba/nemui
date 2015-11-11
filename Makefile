all:

WGET = wget
CURL = curl
GIT = git


updatenightly: local/bin/pmbp.pl
	$(CURL) -s -S -L https://gist.githubusercontent.com/wakaba/34a71d3137a52abb562d/raw/gistfile1.txt | sh
	$(GIT) add modules t_deps/modules
	perl local/bin/pmbp.pl --update
	$(GIT) add config

updatenightlywp:
	date > wp
	echo $(WP_DATA_DIR) >> wp
	$(GIT) add wp

## ------ Setup ------

deps: pmbp-install

PMBP_OPTIONS=

local/bin/pmbp.pl:
	mkdir -p local/bin
	$(CURL) -s -S -L https://raw.githubusercontent.com/wakaba/perl-setupenv/master/bin/pmbp.pl > $@
pmbp-upgrade: local/bin/pmbp.pl
	perl local/bin/pmbp.pl $(PMBP_OPTIONS) --update-pmbp-pl
pmbp-update: git-submodules pmbp-upgrade
	perl local/bin/pmbp.pl $(PMBP_OPTIONS) --update
pmbp-install: pmbp-upgrade
	#perl local/bin/pmbp.pl $(PMBP_OPTIONS) --install

## ------ Tests ------

PROVE = ./prove

test: test-deps test-main

test-deps: deps

test-main:
	#$(PROVE) t/*.t

external-test-or-rollback:
	$(MAKE) external-test || $(MAKE) heroku-rollback failed

external-test: test-deps external-test-main

HEROKU_APP_NAME=fuga1

external-test-main:
	XTEST_ORIGIN=https://$(HEROKU_APP_NAME).herokuapp.com $(PROVE) t_ext/*.t

heroku-save-current-release:
	mkdir -p local/lib/JSON
	curl -s -S -L https://raw.githubusercontent.com/wakaba/perl-json-ps/master/lib/JSON/PS.pm > local/lib/JSON/PS.pm
	perl -Ilocal/lib -MJSON::PS -e '$$json = `curl -f https://api.heroku.com/apps/$(HEROKU_APP_NAME)/dynos -H "Accept: application/vnd.heroku+json; version=3" --user ":$$ENV{HEROKU_API_KEY}"`; print [grep { $$_->{type} eq 'web' } @{json_bytes2perl ($$json)}]->[0]->{release}->{id} || die "Cannot get release.id";' > local/.heroku-current-release

heroku-rollback:
	perl -e '(system qq(curl -X POST -f https://api.heroku.com/apps/$(HEROKU_APP_NAME)/releases -H "Accept: application/vnd.heroku+json; version=3" --user ":$$ENV{HEROKU_API_KEY}" -H "Content-Type: application/json" -d "{\\\"release\\\":\\\"$$ARGV[0]\\\"}")) == 0 or die $$?' `cat local/.heroku-current-release`

failed:
	false
