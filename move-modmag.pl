use strict;
use warnings;

my $i = 0;
sub run (@) {
  print STDERR "Command: |@_|\n" if ($i++ % 1000) == 0;
  (system @_) == 0 or die "Failed: $?";
}

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/[(a-z0-9-]+)\.jpg/([0-9-]+\.png)$}) {
    my $in_file = $_;
    my $out_file = "local/data/modmag/$1-$2";
    run 'mv', $in_file, $out_file;
  }
}
