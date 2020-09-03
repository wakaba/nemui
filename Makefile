all: deps

deps:

updatenightly: dataautoupdate

dataautoupdate:
	perl -e 'print time' > nemui
	git add nemui

deps-circleci:
