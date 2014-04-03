all: deps

deps:

dataautoupdate:
	perl -e 'print time' > nemui
	git add nemui
