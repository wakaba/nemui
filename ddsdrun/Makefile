# -*- Makefile -*-

all:

CURL = curl

updatenightly:
	$(CURL) -sSLf https://raw.githubusercontent.com/wakaba/ciconfig/master/ciconfig | RUN_GIT=1 REMOVE_UNUSED=1 perl

deps:

DOCKER_IMAGE = $${DDSDRUN_DOCKER_IMAGE}
DOCKER_REGISTRY := $(shell echo $$DDSDRUN_DOCKER_IMAGE | awk -F/ '{print $$1}')

ddsd-batch: batch

batch:
	mkdir -p local
	docker run -v `pwd`/local:/local --user `id --user` $(DOCKER_IMAGE)main cp -R /app/data /local/ddsddata-data
	mkdir -p local/ddsddata-data
	git clone $$DDSDDATA_GIT -b master ddsddata
	rm -fr ddsddata/data 
	mv local/ddsddata-data ddsddata/data
	mkdir -p ddsddata/data/states/mirrorsets
	touch ddsddata/data/states/mirrorsets/free_set.txt
	touch ddsddata/data/states/mirrorsets/free_large_set.txt
	touch ddsddata/data/states/mirrorsets/nonfree_set.txt
	touch ddsddata/data/states/mirrorsets/nonfree_large_set.txt
	mkdir -p ddsddata/data/mirror/
	#XXX
	-docker run -v `pwd`/ddsddata:/ddsddata --user `id --user` $(DOCKER_IMAGE)`cat ddsddata/data/states/mirrorsets/free_set.txt` cp -R /app/data/mirror/`cat ddsddata/data/states/mirrorsets/free_set.txt` /ddsddata/data/mirror/
	-docker run -v `pwd`/ddsddata:/ddsddata --user `id --user` $(DOCKER_IMAGE)`cat ddsddata/data/states/mirrorsets/free_large_set.txt` cp -R /app/data/mirror/`cat ddsddata/data/states/mirrorsets/free_large_set.txt` /ddsddata/data/mirror/
	-docker run -v `pwd`/ddsddata:/ddsddata --user `id --user` $(DOCKER_IMAGE)`cat ddsddata/data/states/mirrorsets/nonfree_set.txt` cp -R /app/data/mirror/`cat ddsddata/data/states/mirrorsets/nonfree_set.txt` /ddsddata/data/mirror/
	-docker run -v `pwd`/ddsddata:/ddsddata --user `id --user` $(DOCKER_IMAGE)`cat ddsddata/data/states/mirrorsets/nonfree_large_set.txt` cp -R /app/data/mirror/`cat ddsddata/data/states/mirrorsets/nonfree_large_set.txt` /ddsddata/data/mirror/
	# XXXX
	ls -lR ddsddata
	$(MAKE) build-ddsd build-main
	-chmod ugo+r -R ddsddata/data
	docker login -u $$DOCKER_USER -p $$DOCKER_PASS $(DOCKER_REGISTRY)
	# XXXX
	ls -lR ddsddata
	$(MAKE) -f Makefile.reindextemp
	mv ddsddata/data/mirror ./
	docker build -t $(DOCKER_IMAGE)main .
	docker push $(DOCKER_IMAGE)main
	#bash -o pipefail -c '$(CURL) -sSf $$BWALLER_URL | BWALL_GROUP=docker BWALL_NAME=$$DDSDRUN_DOCKER_IMAGE bash'

MIRROR_SET=...

#MIRROR_SET
build-mirror-image:
	mkdir -p local/mirror-image/$(MIRROR_SET)
	cat Dockerfile.ddsdmirror | sed -e s%@@MIRROR_SET@@%$(MIRROR_SET)%g \
	> local/mirror-image/$(MIRROR_SET)/Dockerfile
	mv ddsddata/data/mirror/$(MIRROR_SET) \
	local/mirror-image/$(MIRROR_SET)/mirrordata
	cd local/mirror-image/$(MIRROR_SET) && \
	docker build -t $(DOCKER_IMAGE)$(MIRROR_SET) .
	docker push $(DOCKER_IMAGE)$(MIRROR_SET)
	mv local/mirror-image/$(MIRROR_SET)/mirrordata \
	ddsddata/data/mirror/$(MIRROR_SET)

DDSDRUN_BUILD_MAIN ?= build-main-dev
build-main: $(DDSDRUN_BUILD_MAIN)

build-main-live:
	cd ddsddata && LIVE=1 ../local/ddsd/app/perl ../indexing.pl
	rm -fr ddsddata/data/local ddsddata/data/config ddsddata/data/indexes
	mv ddsddata/data/mirror mirror
	mv ddsddata/data/states states
	#
	git config --global user.email "ci@test"
	git config --global user.name "Auto"
	cd ddsddata && git add data && git commit -m current && git push
	#
	mv mirror ddsddata/data/mirror
	mv states ddsddata/data/states
	cd ddsddata && ../local/ddsd/app/perl ../regenerate-index.pl
build-main-dev:
	cd ddsddata && ../local/ddsd/app/perl ../indexing.pl
	cd ddsddata && ../local/ddsd/app/perl ../regenerate-index.pl
	rm -fr ddsddata/data/local ddsddata/data/config
	rm -fr ddsddata/data/mirror-index
	#
	mkdir -p ddsddata/data/mirror-index
	for dir in $(wildcard ddsddata/data/mirror/*); do \
	  if [ -d "$$dir" ]; then \
	    name=$$(basename "$$dir"); \
	    if [ -e "$$dir/index" ]; then \
	      echo mv "$$dir/index" "ddsddata/data/mirror-index/$$name"; \
	      mv "$$dir/index" "ddsddata/data/mirror-index/$$name"; \
	      echo $$?; \
	    fi; \
	  fi; \
	done
	mv ddsddata/data/mirror mirror
	#
	git config --global user.email "ci@test"
	git config --global user.name "Auto"
	cd ddsddata && git add data && git commit -m current && git push
	#
	mv mirror ddsddata/data/mirror
	for dir in $(shell ls -d ddsddata/data/mirror-index/*); do \
	  if [ -d "$$dir" ]; then \
	    name=$$(basename "$$dir"); \
	    echo mv "$$dir" "ddsddata/data/mirror/$$name/index"; \
	    mv "$$dir" "ddsddata/data/mirror/$$name/index"; \
	    echo $$?; \
	  fi; \
	done

build-ddsd:
	$(CURL) -f https://raw.githubusercontent.com/geocol/ddsd/staging/bin/booter.staging | bash

build-github-pages:
	mkdir -p local
	docker run -v `pwd`/local:/local --user `id --user` $$DDSDRUN_DOCKER_IMAGE cp -R /app/data /local/ddsddata-data
	mv local/ddsddata-data/snapshots ./
	mv local/ddsddata-data/indexes ./
	rm -fr local

test:

## =head1 LICENSE
## 
## Copyright 2024 Wakaba <wakaba@suikawiki.org>.
## 
## This library is free software; you can redistribute it and/or modify
## it under the same terms as Perl itself.
## 
## =cut
