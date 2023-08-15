use strict;
use warnings;

sub process_file ($) {
  my $file_name = shift;
  open my $file, '<', $file_name;
  my $image_name;
  while (<$file>) {
    if (m{<LINE STRING="([^"]+)" X="([0-9]+)" Y="([0-9]+)" WIDTH="([0-9]+)" HEIGHT="([0-9]+)" />}) {
      my $item_name = join '-', $2, $3, $4, $5;
      print $file_name, " ", $item_name, " ", $1, "\n";
    } elsif (m{<PAGE IMAGENAME="([0-9a-z-]+)\.jpg"}) {
      $image_name = $1;
    }
  }
}

while (glob '*.xml') {
  process_file $_;
}
