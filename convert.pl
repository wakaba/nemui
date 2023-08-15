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

my $docker_current;
{
  open my $docker_current_file, '<', 'docker-current' or die $!;
  $docker_current = <$docker_current_file>;
  $docker_current =~ tr/\x0D\x0A//d;
}

my $df_name = q{Dockerfile};
open my $df_file, '>', $df_name or die "$df_name: $!";
printf $df_file q{
  FROM %s
}, $docker_current;

while (<>) {
  s/[\x0D\x0A]+$//g;
  if (m{/images/}) {
    #
  } elsif (/\.jpg$/) {
    my $in_file = qq{local/data/$_};
    my $out_file = qq{imagedata/$_};
    $out_file =~ s{\.jpg$}{.png};
    my $current_out_file = "local/" . $out_file;
    if (-f $current_out_file) {
      $skipped++;
      warn "$skipped files skipped\n" if ($skipped % 1000) == 0;
      next;
    }
    my $d_file = qq{/app/data/$_};

    my $elapsed = time - $start_time;
    if ($elapsed > 1*60) {
      warn "Elapsed: $elapsed s, terminated\n";
      warn "Converted: $converted, Skipped: $skipped\n";
      exit;
    }
    
    create_dir $out_file;

    run 'convert', $in_file, '-colors', 2, $out_file;
    $converted++;
    warn "$converted files converted (skipped: $skipped)\n" if ($converted % 100) == 0;
    print $df_file "ADD $out_file $d_file\n";

    run 'rm', $in_file;
    
  } elsif (/\S/) {
    my $in_file = qq{local/data/$_};
    if (-f $in_file) {
      my $out_file = qq{imagedata/$_};
      my $current_out_file = 'local/' . $out_file;
      next if -f $current_out_file;
      my $d_file = qq{/app/data/$_};
      
      create_dir $out_file;
      
      run 'mv', $in_file, $out_file;
      print $df_file "ADD $out_file $d_file\n";
    }
  }
}
