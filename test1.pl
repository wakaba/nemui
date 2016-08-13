use strict;
use warnings;

my $x="a\360\200\200\240b.test";
$x =~ s/([^\x00-\x7F])/sprintf '%%%02X', ord $1/ge;

use Encode;
use Devel::Peek;

$x = encode "utf-8", $x;

Dump $x;

$x =~ s/%([0-9A-Fa-f]{2})/pack 'C', hex $1/ge;

Dump $x;

$x = decode "utf-8", $x;

Dump $x;

print "$x\n"
