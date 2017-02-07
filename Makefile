all:

deps:
	$(MAKE) local/bin/pmbp.pl
	perl local/bin/pmbp.pl --update-pmbp-pl-staging
	perl local/bin/pmbp.pl --install-openssl
