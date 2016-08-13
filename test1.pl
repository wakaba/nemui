use strict;
use warnings;
use utf8;
use lib glob "modules/*/lib";
use Web::URL;
use Web::Encoding;
use Devel::Peek;

my $host = q<a%c1%80b.test>;

my $s = $host;
Dump $s;
  $s = encode_web_utf8 $s;
Dump $s;
  $s =~ s{%([0-9A-Fa-f]{2})}{pack 'C', hex $1}ge;
Dump $s;
  $s = decode_web_utf8 $s;
Dump $s;

warn "=====";

my $url = Web::URL->parse_string ("https://$host");
warn $url->stringify;
