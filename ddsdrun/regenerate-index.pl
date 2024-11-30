use strict;
use warnings;
use Path::Tiny;
use Time::HiRes qw(time);
use AbortController;
use JSON::PS;
use Promise;
use Promised::Command;
use Promised::File;
use Promised::Flow;
use Digest::SHA qw(sha256_hex);
use Web::URL;
use Web::Encoding;

my $ThisPath = path (__FILE__)->parent;
my $DataRootPath = $ThisPath->child ('ddsddata/data');

sub escape ($) {
  my $s = shift;
  $s =~ s/([^0-9A-Za-z])/sprintf '_%02X', ord $1/ge;
  return $s;
} # escape

sub open_tag_index ($$$) {
  my ($states, $base_path, $tag) = @_;
  return $states->{tag_files}->{$tag} ||= do {
    $tag = substr $tag, 0, 100 if 100 < length $tag;
    my $etag = escape $tag;
    my $path = $base_path->child ("indexes/tags/$etag.jsonl");
    $path->openw;
  };
} # open_tag_index

sub regenerate_computed_index ($$$$$$) {
  my ($states, $base_path, $site_type, $site_name, $site_opts,
      $touched_mirror_sets) = @_;
  my $esite_name = escape $site_name;
  my $index_parent_path = $base_path->child
      ("snapshots/$site_type/$esite_name");
  my $index_all_path = $base_path->child
      ("indexes/$site_type/$esite_name/all.jsonl");
  my $states_sets_path = $base_path->child ("states/sets.json");
  my $mirrorzip_files = {};
  my $get_mirrorzip_file = sub ($) {
    my $mirror_set = $_[0];
    return Promise->resolve ($mirrorzip_files->{$mirror_set})
        if defined $mirrorzip_files->{$mirror_set};
    my $mirrorzip_path = $base_path->child
        ("mirror/$mirror_set/index/mirror-$site_type-$esite_name.jsonl");
    return Promised::File->new_from_path ($mirrorzip_path->parent)->mkpath->then (sub {
      my $mirrorzip_file = $mirrorzip_path->openw;
      return $mirrorzip_files->{$mirror_set} = $mirrorzip_file;
    });
  }; # $get_mirrorzip_file
  return Promise->all ([
    Promised::File->new_from_path ($index_parent_path)->get_child_names,
    Promised::File->new_from_path ($states_sets_path)->read_byte_string,
    Promised::File->new_from_path ($base_path->child ("indexes/tags"))->mkpath,
    Promised::File->new_from_path ($index_all_path->parent)->mkpath,
  ])->then (sub {
    my $names = [grep { /^index-[0-9a-f]{2}\.jsonl$/ } @{$_[0]->[0]}];
    my $states_sets = json_bytes2perl $_[0]->[1];
    my $index_all_file = $index_all_path->openw;
    return promised_for {
      my $path = $index_parent_path->child ($_[0]);
      my $file = Promised::File->new_from_path ($path);
      my $any_packs = {};
      my $full_packs = {};
      my $packs = {};
      my $pack_vers = {};
      return $file->read_byte_string->then (sub {
        my $oldest = {};
        for (split /\x0A/, $_[0]) {
          my $json = json_bytes2perl $_;
          my $pack_name = $json->[0];
          my $flags = $json->[3];
          $any_packs->{$pack_name} = [$json->[1], $json->[2]];
          $full_packs->{$pack_name} = [$json->[1], $json->[2]]
              if not $flags->{broken} and $flags->{is_free} eq 'free';
          $packs->{$pack_name} = [$json->[1], $json->[2]]
              if not $flags->{broken} and not $flags->{insecure} and $flags->{is_free} eq 'free';
          push @{$pack_vers->{$pack_name} ||= []},
              [$json->[1], $json->[2], $json->[3]];
          $oldest->{$json->[2]} ||= $json->[1];
        }

        my %pack_name = (%$packs, %$full_packs, %$any_packs);
        return promised_for {
          my $pack_name = $_[0];
          my $current = $packs->{$pack_name} // $full_packs->{$pack_name} // $any_packs->{$pack_name};

          my $epack_name = escape $pack_name;
          my $pack_index_path = $base_path->child
              ("indexes/$site_type/$esite_name/packages/$epack_name.json");
          return Promised::File->new_from_path ($pack_index_path)->write_byte_string (perl2json_bytes [$current, $pack_vers->{$pack_name}])->then (sub {
            my $summary_path = $base_path->child
                ("snapshots/$site_type/$esite_name/summaries/$current->[1].json");
            return Promised::File->new_from_path
                ($summary_path)->read_byte_string;
          })->then (sub {
            my $summary = json_bytes2perl $_[0];
            {
              my $item = [
                $site_type, $site_name, $pack_name,
                $oldest->{$current->[1]}, # timestamp
                $current->[1], # sha
                $summary->{broken},
                $summary->{insecure},
                $summary->{length},
                $summary->{package}->{title},
                $summary->{package}->{author},
                $summary->{package}->{org},
                $summary->{legal}->{is_free},
              ];
              print $index_all_file perl2json_bytes $item;
              print $index_all_file "\x0A";
              my $tag = {};
              {
                $tag->{insecure} = 1 if $summary->{insecure};
                $tag->{broken} = 1 if $summary->{broken};
                $tag->{'non-free'} = 1 if $summary->{legal}->{is_free} eq 'non-free';
                $tag->{'license unknown'} = 1 if $summary->{legal}->{is_free} eq 'unknown';
                $tag->{$summary->{package}->{author}} = 1;
                $tag->{$summary->{package}->{org}} = 1;
                $tag->{$_} = 1 for @{$summary->{package}->{tags}};
                $tag->{new} = 1 if $oldest->{$current->[1]} > time-7*24*60*60;
                {
                  use utf8;
                  for (
                    ['児童' => '児童・生徒'],
                    ['生徒' => '児童・生徒'],
                    ['子育て' => '育児'],
                    ['避難場所' => '避難所'],
                    ['投票' => '選挙'],
                    ['病院' => '医療機関'],
                    ['医院' => '医療機関'],
                    ['診療所' => '医療機関'],
                    map { [$_] } qw(
                      防災 人口 広報 交通機関 選挙 イベント 介護 障害者
                      育児 公園 避難所 トイレ 観光 医療機関 AED
                      通学路 学校
                      新型コロナウイルス
                      API
                    ),
                  ) {
                    my ($pattern, $t) = @$_;
                    $t //= $pattern;
                    if ($summary->{package}->{title} =~ /$pattern/ or
                        $summary->{package}->{desc} =~ /$pattern/) {
                      $tag->{$t} = 1;
                    } else {
                      for my $file (values %{$summary->{files} or {}}) {
                        if ($file->{title} =~ /$pattern/ or
                            $file->{desc} =~ /$pattern/) {
                          $tag->{$t} = 1;
                          last;
                        }
                      }
                    }
                  }
                }
                #XXX tag by date
                for (@{$site_opts->{tags} or []}) {
                  $tag->{$_} = 1;
                }
                if ($summary->{length} > 10*1024*1024) {
                  if ($summary->{length} > 100*1024*1024) {
                    if ($summary->{length} > 1*1024*1024*1024) {
                      $tag->{'1GB+'} = 1;
                    }
                    $tag->{'100MB+'} = 1;
                  }
                  $tag->{'10MB+'} = 1;
                }
                for my $file (values %{$summary->{files} or {}}) {
                  if (defined $file->{set_type}) {
                    $tag->{$file->{set_type}} = 1;
                  }
                  if (defined $file->{mime}) {
                    my $mime = $file->{mime};
                    $mime =~ s/\s*;.*//;
                    $tag->{$mime} = 1;
                  }
                }
              }
              delete $tag->{''};
              for my $t (keys %$tag) {
                my $file = open_tag_index $states, $base_path, $t;
                print $file perl2json_bytes $item;
                print $file "\x0A";
              }
            }

            my $item = [
              $current->[1],
              "../$site_type/$esite_name/$current->[1].zip",
              $summary->{mirrorzip}->{sha256},
              $summary->{mirrorzip}->{length},
            ];

            my $mirror_set = $summary->{mirrorzip}->{set};
            return $get_mirrorzip_file->($mirror_set)->then (sub {
              my $mirrorzip_file = $_[0];
              print $mirrorzip_file perl2json_bytes $item;
              print $mirrorzip_file "\x0A";
              $touched_mirror_sets->{$mirror_set} = 1;
            });
          });
        } [keys %pack_name];
      });
    } $names;
  })->then (sub {
    return promised_for {
      my $mirror_set = $_[0];
      my $mirror_index_path = $base_path->child
          ("mirror/$mirror_set/index/packref.json");
      my $file = Promised::File->new_from_path ($mirror_index_path);
      my $lock = AbortController->new;
      return $file->lock_new_file (signal => $lock->signal)->then (sub {
        return $file->read_byte_string;
      })->then (sub {
        my $json = length $_[0] ? json_bytes2perl $_[0] : {};
        die "Bad json" unless defined $json;
        $json->{type} //= "packref";
        $json->{source}->{type} //= "files";
        $json->{source}->{files}->{"file:r:$site_type-$esite_name"}->{url} = "mirror-$site_type-$esite_name.jsonl";
        return $file->write_byte_string (perl2json_bytes_for_record $json);
      });
    } [keys %$mirrorzip_files];
  });
} # regenerate_computed_index

sub regenerate_computed () {
  my $base_path = $DataRootPath;
  my $states = {};
  my $snapshot_index_path = $base_path->child ("snapshots/index.json");
  my $touched_mirror_sets = {};
  my $file = Promised::File->new_from_path ($snapshot_index_path);
  return $file->read_byte_string->then (sub {
    my $json = json_bytes2perl $_[0];
    return promised_for {
      return promised_for {
        my $data = shift;
        return regenerate_computed_index
            ($states, $base_path, $data->{site_type}, $data->{site_name},
             $data->{site_opts}, $touched_mirror_sets);
      } [values %{$_[0]}];
    } [values %$json];
  })->then (sub {
    my $make_path = $ThisPath->child ('Makefile.reindextemp');
    my $make = sprintf "all:\n%s\n", join "", map {
      sprintf "\t\$(MAKE) build-mirror-image MIRROR_SET=%s\n", $_;
    } keys %$touched_mirror_sets;
    return Promised::File->new_from_path ($make_path)->write_byte_string ($make);
  });
} # regenerate_computed

regenerate_computed->to_cv->recv;
