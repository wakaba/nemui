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


ciconfig:
	$(CURL) -sSLf https://raw.githubusercontent.com/wakaba/ciconfig/master/ciconfig | RUN_GIT=1 REMOVE_UNUSED=1 perl

## ------ Setup ------

deps:
	$(MAKE) local/bin/pmbp.pl
	perl local/bin/pmbp.pl --update-pmbp-pl-staging
	perl local/bin/pmbp.pl --install-openssl

a:
	which sed
	brew uninstall libtool && brew install libtool 
	$(MAKE) local/bin/pmbp.pl
	perl local/bin/pmbp.pl --install-openssl
	$(MAKE) pmbp-install
	readlink -f . || (brew install coreutils && greadlink -f .)

PMBP_OPTIONS=

local/bin/pmbp.pl:
	mkdir -p local/bin
	$(CURL) -s -S -L https://raw.githubusercontent.com/wakaba/perl-setupenv/master/bin/pmbp.pl > $@
pmbp-upgrade: local/bin/pmbp.pl
	perl local/bin/pmbp.pl $(PMBP_OPTIONS) --update-pmbp-pl
pmbp-update: git-submodules pmbp-upgrade
	perl local/bin/pmbp.pl $(PMBP_OPTIONS) --update
pmbp-install: git-submodules pmbp-upgrade
	perl local/bin/pmbp.pl $(PMBP_OPTIONS) \
	    --install \
	    --install-module Encode~2.86 \
	    --create-perl-command-shortcut perl
#	    --install-perl --perl-version 5.24.0 \

git-submodules:
	git submodule update --init

## ------ Tests ------

PROVE = ./prove

test: test-deps test-1 test-main test-https

test-deps: deps

test-1:
	./perl test1.pl

test-main:
	#$(PROVE) t/*.t
	which sed
	diff --help

test-https:
	curl https://gist.githubusercontent.com/wakaba/f89aa0ba4042d2a227f1/raw/checkhttps.pl > check.pl
	perl check.pl > check.html
	perl -e 'print int rand 10000000' > a.txt
	cat a.txt
	wget https://raw.githubusercontent.com/wakaba/perl-setupenv/staging/bin/pmbp.pl
	perl pmbp.pl --install-openssl-if-mac

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
