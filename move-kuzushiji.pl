use strict;
use warnings;

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/U\+[0-9A-F]+_([\w-]+\.png)}) {
    my $in_file = $_;
    my $out_file = "local/data/kuzushiji/$1";
    rename $in_file, $out_file;
  }
}
