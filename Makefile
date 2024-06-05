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

x-build-netlify:
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

x-build-for-docker:
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

x-build-github-pages:
	mkdir -p local

	docker run -v `pwd`/local:/local --user `id --user` quay.io/wakaba/sandbox:kuzu-png-1 cp -R /app/data /local/kuzushiji
	tar -cf kuzushiji.tar local/kuzushiji
	gzip kuzushiji.tar

	rm -fr ./local

x-build-github-pages2:
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

test-deps: deps

test-main:
