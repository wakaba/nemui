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
  if (m{/img/}) {
    #
  } elsif (/\S/) {
    my $in_file = qq{local/data/$_};
    if (-f $in_file) {
      my $out_file = qq{imagedata/$_};
      create_dir $out_file;

      if ($in_file =~ /\.xml$/) {
        open my $xml_file, '<', $in_file or die $in_file;
        my $img_out_dir;
        my $img_in_file;
        while (<$xml_file>) {
          if (m{<PAGE IMAGENAME="([^"]+)"}) {
            my $img_file_name = $1;
            $img_in_file = qq{local/data/mm-ocr-dataset-v1/img/$img_file_name};
            $img_out_dir = qq{imagedata/images/$img_file_name/};
            create_dir $img_out_dir;
          } elsif (m{X="([0-9]+)" Y="([0-9]+)" WIDTH="([0-9]+)" HEIGHT="([0-9]+)"}) {
            my ($x, $y, $w, $h) = ($1, $2, $3, $4);
            my $img_out_file = "$img_out_dir/$x-$y-$w-$h.png";
            
            run 'convert', $img_in_file, '-crop', $x . 'x' . $y . '+' . $w . '+' . $h, '-colors', 2, $img_out_file;
          }
        }
      }
      
      run 'mv', $in_file, $out_file;
    }
  }
}
