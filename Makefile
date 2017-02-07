all:

deps:
	$(MAKE) local/bin/pmbp.pl
	perl local/bin/pmbp.pl --update-pmbp-pl-staging
	perl local/bin/pmbp.pl --install-openssl

CURL = curl

local/bin/pmbp.pl:
	mkdir -p local/bin
	$(CURL) -s -S -L https://raw.githubusercontent.com/wakaba/perl-setupenv/master/bin/pmbp.pl > $@
	
