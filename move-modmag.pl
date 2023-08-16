use strict;
use warnings;

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/([a-z0-9-]+)\.jpg/([0-9-]+\.png)$}) {
    my $in_file = $_;
    my $out_file = "local/data/modmag/$1-$2";
    rename $in_file, $out_file;
  }
}
