use strict;
use warnings;

use File::Temp;

my (undef, $file_name) = tempfile;

warn $file_name;

my $dir_name = $file_name;
$dir_name =~ s{/[^/]*$}{};

warn $dir_name;

warn "ls";
system "ls $dir_name";

warn "echo";
system "echo a > $dir_name/a";

warn "ls";
system "ls $dir_name";
