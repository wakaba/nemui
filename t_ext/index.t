use strict;
use warnings;
use Test::More tests => 1;

my $origin = $ENV{XTEST_ORIGIN} or die "No |XTEST_ORIGIN|";

my $top = `curl -D - $origin/`;
like $top, qr{^HTTP/1.. 404 };
