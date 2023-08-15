use strict;
use warnings;

sub run (@) {
  print STDERR "Command: |@_|\n";
  (system @_) == 0 or die "Failed: $?";
}

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/U\+[0-9A-F]+_(\w+\.png)}) {
    my $in_file = $_;
    my $out_file = "local/data/tensho/$1";
    run 'mv', $in_file, $out_file;
  }
}
