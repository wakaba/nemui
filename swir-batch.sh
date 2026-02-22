#!/bin/sh
## This script orchestrates the entire swir batch process.
## It receives configuration via standard command-line options.

set -e ## Exit immediately if a command exits with a non-zero status.

## --- Argument Parsing & Configuration ---
## Initialize variables
DOCKER_IMAGE=""
DOCKER_USER=""
DOCKER_PASS=""
BWALLER_URL=""

## Parse options using getopts for clarity and robustness
while getopts "i:u:p:b:" opt; do
  case $opt in
    i) DOCKER_IMAGE="$OPTARG" ;;
    u) DOCKER_USER="$OPTARG" ;;
    p) DOCKER_PASS="$OPTARG" ;;
    b) BWALLER_URL="$OPTARG" ;;
    \?) echo "Invalid option: -$OPTARG" >&2; exit 1;;
  esac
done

## --- Configuration Validation ---
if [ -z "$DOCKER_IMAGE" ]; then
  echo "Error: Docker image must be specified with -i <image>" >&2
  exit 1
fi

## --- Static Configuration ---
BASE_IMAGE="quay.io/wakaba/base:sid"
JS_RUNNER_IMAGE="${DOCKER_IMAGE}-js-runner"

## --- Main Logic ---
echo "--- Starting swir-batch process ---"
mkdir -p local
rm -f local/.image_pushed

echo "Recording pre-run remote state..."
if docker manifest inspect ${DOCKER_IMAGE}main >/dev/null 2>&1; then
  PRE_RUN_MAIN_DIGEST=$(docker manifest inspect ${DOCKER_IMAGE}main | grep 'Digest:' | awk '{print $2}')
else
  PRE_RUN_MAIN_DIGEST="nonexistent"
fi
echo "--> Pre-run main digest: ${PRE_RUN_MAIN_DIGEST}"

echo "Fetching main index..."
if [ "${PRE_RUN_MAIN_DIGEST}" != "nonexistent" ]; then
	docker pull ${DOCKER_IMAGE}main
	mkdir -p local/indexes
	ID=$(docker create ${DOCKER_IMAGE}main) && docker cp $ID:/app/indexes/. ./local/indexes && docker rm -v $ID
else
	echo "--> Main image not found. Starting fresh."
	mkdir -p local/indexes
fi

MIRROR_SET=$(cat local/indexes/set.txt 2>/dev/null || echo 1)
echo "Using MIRROR_SET: ${MIRROR_SET}. Fetching data..."
if docker manifest inspect ${DOCKER_IMAGE}${MIRROR_SET} >/dev/null 2>&1; then
	docker pull ${DOCKER_IMAGE}${MIRROR_SET}
	mkdir -p local/objects
	ID=$(docker create ${DOCKER_IMAGE}${MIRROR_SET}) && docker cp $ID:/app/objects/. ./local/objects && docker rm -v $ID
else
	echo "--> Data image not found. Starting fresh."
	mkdir -p local/objects
fi

echo "Capturing pre-run local state..."
find local/objects -type f -exec sha256sum {} + | sort -k 2 > local/.pre_run_data_state.txt
find local/indexes -type f -exec sha256sum {} + | sort -k 2 > local/.pre_run_index_state.txt

echo "Building and running the main script..."
docker build -t ${JS_RUNNER_IMAGE} -f js/Dockerfile.runner js/ > /dev/null
docker run --rm -v "$(pwd)/local:/app/local" ${JS_RUNNER_IMAGE} ${MIRROR_SET}

echo "Authenticating with Docker registry..."
if [ -n "$DOCKER_USER" ] && [ -n "$DOCKER_PASS" ]; then
    DOCKER_REGISTRY=$(echo "$DOCKER_IMAGE" | awk -F/ '{if (NF>1) print $1}')
	if [ -n "$DOCKER_REGISTRY" ]; then
		echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin $DOCKER_REGISTRY
	else
		echo "$DOCKER_PASS" | docker login -u "$DOCKER_USER" --password-stdin
	fi
else
	echo "--> Skipping Docker login."
fi

echo "Checking for remote changes before push..."
if docker manifest inspect ${DOCKER_IMAGE}main >/dev/null 2>&1; then
  POST_RUN_MAIN_DIGEST=$(docker manifest inspect ${DOCKER_IMAGE}main | grep 'Digest:' | awk '{print $2}')
else
  POST_RUN_MAIN_DIGEST="nonexistent"
fi
echo "--> Post-run main digest: ${POST_RUN_MAIN_DIGEST}"
if [ "${PRE_RUN_MAIN_DIGEST}" != "${POST_RUN_MAIN_DIGEST}" ]; then
	echo "ERROR: Concurrent modification detected. Remote 'main' image changed during process. Aborting to prevent inconsistency." >&2
	exit 1
fi

echo "No concurrent modification detected. Proceeding with potential push."

echo "Checking for data changes..."
find local/objects -type f -exec sha256sum {} + | sort -k 2 > local/.post_run_data_state.txt
if ! diff -q local/.pre_run_data_state.txt local/.post_run_data_state.txt >/dev/null 2>&1; then
	echo "--> Data changes detected. Pushing data image..."
	NEW_MIRROR_SET=$(cat local/indexes/set.txt 2>/dev/null || echo $MIRROR_SET)
	printf "FROM ${BASE_IMAGE}\nCOPY objects /app/objects" | docker build -f - -t ${DOCKER_IMAGE}${NEW_MIRROR_SET} local
	docker push ${DOCKER_IMAGE}${NEW_MIRROR_SET} || { echo "ERROR: Failed to push data image. Aborting." >&2; exit 1; }
	touch local/.image_pushed
fi

echo "Checking for index changes..."
find local/indexes -type f -exec sha256sum {} + | sort -k 2 > local/.post_run_index_state.txt
if ! diff -q local/.pre_run_index_state.txt local/.post_run_index_state.txt >/dev/null 2>&1; then
	echo "--> Index changes detected. Pushing main image..."
	printf "FROM ${BASE_IMAGE}\nCOPY indexes /app/indexes" | docker build -f - -t ${DOCKER_IMAGE}main local
	docker push ${DOCKER_IMAGE}main || { echo "ERROR: Failed to push main image. Data image might be orphaned." >&2; exit 1; }
	touch local/.image_pushed
fi

echo "Finalizing process..."
rm -f local/.pre_run_data_state.txt local/.post_run_data_state.txt local/.pre_run_index_state.txt local/.post_run_index_state.txt
if [ -f local/.image_pushed ]; then
	echo "--> Notifying bwaller..."
    if [ -n "$BWALLER_URL" ]; then
	    bash -o pipefail -c "curl -sSf $BWALLER_URL | BWALL_GROUP=docker BWALL_NAME='${DOCKER_IMAGE}' bash"
    fi
	rm -f local/.image_pushed
fi

echo "--- Swir-batch process finished ---"

## License: Public Domain.
