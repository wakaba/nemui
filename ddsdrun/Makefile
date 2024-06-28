# -*- Makefile -*-

all:

CURL = curl

build: build-for-docker-from-old build-ddsd
	git clone $$DDSDDATA_GIT -b master ddsddata
	rm -fr ddsddata/data
	mv local/ddsddata-data ddsddata/data
	cd ddsddata && ../local/ddsd/app/perl ../indexing.pl
	cd ddsddata && ../local/ddsd/app/perl ../regenerate-index.pl
	rm -fr ddsddata/data/local ddsddata/data/config
	#
	mv ddsddata/data/mirror/free/index ddsddata/data/mirror-free-index
	mv ddsddata/data/mirror/nonfree/index ddsddata/data/mirror-nonfree-index
	mv ddsddata/data/mirror mirror
	#
	cd ddsddata && git add data && git commit -m current && git push
	#
	mv mirror ddsddata/data/mirror
	mv ddsddata/data/mirror-free-index ddsddata/data/mirror/free/index
	mv ddsddata/data/mirror-nonfree-index ddsddata/data/mirror/nonfree/index

build-for-docker: 
	-chmod ugo+r -R ddsddata/data

build-for-docker-from-old:
	mkdir -p local
#XXX	docker run -v `pwd`/local:/local --user `id --user` $$DDSDRUN_DOCKER_IMAGE cp -R /app/data /local/ddsddata-data
        mkdir -p local/ddsddata-data

build-ddsd:
        $(CURL) -f https://raw.githubusercontent.com/geocol/ddsd/staging/bin/booter.staging | bash

test:
