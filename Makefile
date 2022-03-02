all: deps

deps:

docker:
	mkdir -p ~/.docker/machine/cache
	curl -Lo ~/.docker/machine/cache/boot2docker.iso https://github.com/boot2docker/boot2docker/releases/download/v19.03.12/boot2docker.iso
	brew install docker docker-machine virtualbox
	docker-machine create --driver virtualbox default
	docker-machine env default

updatenightly: dataautoupdate

dataautoupdate:
	perl -e 'print time' > nemui
	git add nemui

test:
	echo "nemui"
