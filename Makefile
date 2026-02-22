## Makefile for Swir process

## --- Config ---
## These variables can be overridden from the command line.
## e.g., `make DOCKER_IMAGE=my/image DOCKER_USER=user DOCKER_PASS=pass`

## Docker image name prefix. (Default: my-docker-image)
DOCKER_IMAGE ?= my-docker-image

## Username for Docker registry. (Optional)
DOCKER_USER ?= 

## Password for Docker registry. (Optional)
DOCKER_PASS ?= 

## URL for bwaller notification. (Optional)
BWALLER_URL ?= 

## Define tools for consistency
CURL = curl
GIT = git

all:

updatenightly: ciconfig
ciconfig:
	$(CURL) -sSLf https://raw.githubusercontent.com/wakaba/ciconfig/master/ciconfig | RUN_GIT=1 REMOVE_UNUSED=1 perl

##
## --- Main Target ---
##
## This target orchestrates the entire batch process by calling an external script.
## It uses a clear, self-documenting interface with named options.
##
## make variables:
##   DOCKER_IMAGE: Docker image name prefix. (Default: my-docker-image)
##   DOCKER_USER:  Username for Docker registry. (Optional)
##   DOCKER_PASS:  Password for Docker registry. (Optional)
##   BWALLER_URL:  URL for bwaller notification. (Optional)
##
swir-batch: deps swir-batch.sh
	@echo "--- Handing off to swir-batch.sh script ---"
	@bash swir-batch.sh \
		-i "$(DOCKER_IMAGE)" \
		-u "$(DOCKER_USER)" \
		-p "$(DOCKER_PASS)" \
		-b "$(BWALLER_URL)"
	@echo "--- Script finished ---"

## ------ Setup ------
deps: git-submodules

git-submodules:
	$(GIT) submodule update --init


## ------ Tests ------
test:
	@echo "Tests not implemented."

.PHONY: all swir-batch deps git-submodules test updatenightly ciconfig

## License: Public Domain.
