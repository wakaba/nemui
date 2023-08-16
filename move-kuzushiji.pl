use strict;
use warnings;

my $i = 0;
sub run (@) {
  print STDERR "Command: |@_|\n" if ($i++ % 1000) == 0;
  (system @_) == 0 or die "Failed: $?";
}

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/U\+[0-9A-F]+_([\w-]+\.png)}) {
    my $in_file = $_;
    my $out_file = "local/data/kuzushiji/$1";
    run 'mv', $in_file, $out_file;
  }
}
