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

build-netlify:
	mkdir -p local/data/tensho

	echo abc > local/data/abc.txt
	#https://clever-sprite-f9ae27.netlify.app/abc.txt

	wget https://wakaba.github.io/nemui/data.tar.gz
	mkdir -p local/tensho
	cd local/tensho && tar zxf ../../data.tar.gz
	find local/tensho > tensho-list.txt
	perl move-tensho.pl tensho-list.txt

	wget https://manakai.github.io/data-chars/generated.tar.gz
	mkdir -p local/chars
	cd local/chars && tar zxf ../../generated.tar.gz
	mv local/chars/local/generated local/data/chars

	cp _headers local/data/

	ls local/data/
	ls local/data/generated


#	wget http://codh.rois.ac.jp/tensho/dataset/v2/cc-by-sa-full.zip
#	cd local/dataa && unzip ../cc-by-sa-full.zip

#	cd local/data && wget "https://pipelines.actions.githubusercontent.com/serviceHosts/a2bd1344-e68a-4149-9369-cf1893231de6/_apis/pipelines/1/runs/26/signedartifactscontent?artifactName=tesmp1&urlExpires=2023-08-13T15%3A29%3A49.3206114Z&urlSigningMethod=HMACV2&urlSignature=mRNFB8id1Ct7wYZQaI%2B%2FmIAg6TNC9UDTblDtYKeNRLA%3D"

#	docker pull quay.io/wakaba/sandbox
#	docker run -v `pwd`/local:/local --user `id --user` quay.io/suikawiki/sandbox cp -R /app/files /local/data/

test1:
	echo xyz > $$CIRCLE_ARTIFACTS/abc.txt
	mkdir $$CIRCLE_ARTIFACTS/1
	mkdir $$CIRCLE_ARTIFACTS/2
	mkdir $$CIRCLE_ARTIFACTS/3
	cd $$CIRCLE_ARTIFACTS/1 && wget -r -l 2 https://fonts.suikawiki.org || true
	cd $$CIRCLE_ARTIFACTS/2 && wget -r -l 2 https://fonts.suikawiki.org || true
	cd $$CIRCLE_ARTIFACTS/3 && wget -r -l 2 https://fonts.suikawiki.org || true

build-for-docker:
	mkdir -p local/data
	echo abc > local/data/abc.txt
	# https://wakaba.github.io/nemui/local/data/abc.txt

#	wget http://codh.rois.ac.jp/char-shape/dataset/v2/full.zip
	wget http://codh.rois.ac.jp/modern-magazine/dataset/v1.zip
	mkdir files
#	cd files && unzip ../full.zip
#	mv full.zip files/
	mv v1.zip files/

#	wget http://codh.rois.ac.jp/tensho/dataset/v2/cc-by-sa-full.zip
#	mkdir files
#	cd files && unzip ../cc-by-sa-full.zip

	du -c -s -h files/*

	mv files local/data/

build-github-pages:
	mkdir -p local

	docker run -v `pwd`/local:/local --user `id --user` quay.io/wakaba/sandbox:kuzu-png-1 cp -R /app/data /local/kuzushiji
	tar -cf kuzushiji.tar local/kuzushiji
	gzip kuzushiji.tar

	rm -fr ./local

build-github-pages2:
	docker run -v `pwd`/local:/local --user `id --user` quay.io/wakaba/sandbox cp -R /app/data /local/dsanddata
	mv local/dsanddata/modmag-image.tar.gz ./

	#400MB
	docker run -v `pwd`/local:/local --user `id --user` quay.io/wakaba/sandbox:ten cp -R /app/data /local/tensho
	tar -cf tensho.tar local/tensho
	gzip tensho.tar
	#300MB
	docker run -v `pwd`/local:/local --user `id --user` quay.io/wakaba/sandbox:mmag-png cp -R /app/data /local/modmag
	tar -cf modmag.tar local/modmag
	gzip modmag.tar

	rm -fr ./local

xxbuild-github-pages:
	echo xyz > xyz.txt
	mkdir -p local

xdeps:  local/bin/pmbp.pl
	echo "make deps executed"
	perl local/bin/pmbp.pl --install-commands "mysqld wget"
	apt-cache search gnuplot
	sudo apt-get install -y gnuplot
#	$(MAKE) local/bin/pmbp.pl
#	perl local/bin/pmbp.pl --update-pmbp-pl-staging
#	perl local/bin/pmbp.pl --install-openssl

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

test: test-deps
	echo "FOO=$$FOO BAR=$$BAR"
	echo "make test executed!"
#test-1 test-main test-https

test-deps: test-deps-0 deps

test-deps-0:
	perl aaa.pl
	echo "FOO=$$FOO BAR=$$BAR"

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

create-commit-for-heroku: git-submodules
	git remote rm origin
	rm -fr deps/pmtar/.git deps/pmpp/.git modules/*/.git
	#git add -f deps/pmtar/* #deps/pmpp/*
	#rm -fr ./t_deps/modules
	#git rm -r t_deps/modules
	git rm .gitmodules
	git rm modules/* --cached
	git add -f modules/*/*
	git commit -m "for heroku"
