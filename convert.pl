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

my $start_time = time;
my $skipped = 0;
my $converted = 0;

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/images/}) {
    #
  } elsif (/\.jpg$/) {
    my $in_file = qq{local/data/$_};
    my $out_file = qq{imagedata/$_};
    $out_file =~ s{\.jpg$}{.png};
    if (-f $out_file) {
      $skipped++;
      warn "$skipped files skipped\n" if ($skipped % 1000) == 0;
      next;
    }

    my $elapsed = time - $start_time;
    if ($elapsed > 5*60) {
      warn "Elapsed: $elapsed s, terminated\n";
      warn "Converted: $converted, Skipped: $skipped\n";
      exit;
    }
    
    create_dir $out_file;

    run 'convert', $in_file, '-colors', 2, $out_file;
    $converted++;
    warn "$converted files converted\n" if ($converted % 100) == 0;

    run 'rm', $in_file;
    
  } elsif (/\S/) {
    my $in_file = qq{local/data/$_};
    if (-f $in_file) {
      my $out_file = qq{imagedata/$_};
      next if -f $out_file;
      
      create_dir $out_file;
      
      run 'mv', $in_file, $out_file;
    }
  }
}
