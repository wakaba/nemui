all: deps

deps:

autoupdate:
	perl -e 'print time' > nemui
	git add nemui
