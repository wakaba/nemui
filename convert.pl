use strict;
use warnings;

sub run (@) {
  print STDERR "Command: |@_|\n";
  (system @_) == 0 or die "Failed: $?";
}

my $Created = {};
sub create_dir ($) {
  my $s = shift;
  $s =~ s{/[^/]+$}{};
  return if $Created->{$s}++;
  run 'mkdir', '-p', $s;
}

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/images/}) {
    #
  } elsif (/\.jpg$/) {
    my $in_file = qq{local/data/$_};
    my $out_file = qq{imagedata/$_};
    $out_file =~ s{\.jpg$}{.png};
    create_dir $out_file;

    run 'convert', $in_file, '-colors', 2, $out_file;
  } elsif (/\S/) {
    my $in_file = qq{local/data/$_};
    if (-f $in_file) {
      my $out_file = qq{imagedata/$_};
      create_dir $out_file;
      
      run 'cp', $in_file, $out_file;
    }
  }
}
