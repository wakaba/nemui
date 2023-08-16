use strict;
use warnings;

my $created = {};
while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/U\+[0-9A-F]+_([\w-]+\.png)}) {
    my $in_file = $_;
    my $out_file = "local/data/kuzushiji/".(substr $1, 0, 2)."/$1";
    my $out_dir = $out_file;
    $out_dir =~ s{[^/]+$}{};
    mkdir $out_dir unless $created->{$out_dir}++;
    rename $in_file, $out_file;
  }
}
