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
my $DDSDPath = $ThisPath->child ('ddsd')->absolute;

my $ThisRev = 3;

sub escape ($) {
  my $s = shift;
  $s =~ s/([^0-9A-Za-z])/sprintf '_%02X', ord $1/ge;
  return $s;
} # escape

sub ddsd ($@) {
  my $args = shift;
  my $ret = {};
  my $cmd = Promised::Command->new ([
    $DDSDPath,
    '--insecure',
    @_,
  ]);
  $cmd->wd ($args->{wd});
  $cmd->stdout (\my $stdout);
  return $cmd->run->then (sub {
    return $cmd->wait;
  })->then (sub {
    my $result = $_[0];
    die $result if $result->exit_code != 0 and $result->exit_code != 12;
    $ret->{incomplete} = 1 if $result->exit_code == 12;
    if ($args->{jsonl}) {
      $ret->{jsonl} = [map { json_bytes2perl $_ } split /\x0A/, $stdout];
    } elsif ($args->{json}) {
      $ret->{json} = json_bytes2perl $stdout;
    }
    return $ret;
  });
} # ddsd

sub pull_remote_index ($$) {
  my ($site_name, $root_url) = @_;
  my $esite_name = escape $site_name;
  my $base_path = $DataRootPath;
  my $base_file = Promised::File->new_from_path ($base_path);
  return $base_file->mkpath->then (sub {
    return ddsd (
      {wd => $base_path},
      'add',
      $root_url,
      '--name', $esite_name,
    )->catch (sub { })->then (sub {
      return ddsd (
        {wd => $base_path},
        'pull',
      );
    });
  });
} # pull_remote_index

sub filter_legal ($);
sub filter_legal ($) {
  return [map {
    my $x = {%$_};
    delete $x->{timestamps};
    $x->{alt} = filter_legal $x->{alt} if defined $x->{alt};
    $x->{conditional} = filter_legal $x->{conditional}
        if defined $x->{conditional};
    $x;
  } @{$_[0]}];
} # filter_legal

sub add_to_local_index ($$$$$$$$) {
  my ($site_type, $site_name, $pack_name, $time, $files, $legal,
      $mirrorzip, $mirrorzip_name) = @_;
  my $esite_name = escape $site_name;
  my $epack_name = escape $pack_name;
  my $base_path = $DataRootPath;
  my $mirrorzip_path = $base_path->child ($mirrorzip_name);

  my $packs_path = $base_path->child ('config/ddsd/packages.json');
  my $packs_file = Promised::File->new_from_path ($packs_path);
  return $packs_file->read_byte_string->then (sub {
    return json_bytes2perl $_[0];
  }, sub {
    return {};
  })->then (sub {
    my $packs = $_[0];
    my $def = $packs->{sha256_hex "$esite_name--$epack_name"};

    my $ref = {type => 'packref', source => $def};
    #my $ref_json = perl2json_bytes_for_record $ref;
    #my $ref_key = sha256_hex $ref_json;
    my $shash = $files->[0]->{package_item}->{snapshot_hash};
    die "|$esite_name--$epack_name|: Bad |snapshot_hash| value |$shash|"
        unless $shash =~ m{\A[0-9a-f]+\z};

    my $pack_key = sha256_hex encode_web_utf8 $pack_name;
    my $pack_key_prefix = substr $pack_key, 0, 2;

    my $index_line = [
      $pack_name,
      $time,
      undef,
      {},
    ];
    if (defined $def) {
      for my $file_key (keys %{$def->{files}}) {
        my $file = $def->{files}->{$file_key};
        if ($file->{skip}) {
          $index_line->[3]->{broken} = 1;
        }
        if ($file->{sha256_insecure}) {
          $index_line->[3]->{insecure} = 1;
        }
      }
    } else {
      $index_line->[3]->{broken} = 1;
    }
    $index_line->[3]->{is_free} = $legal->{is_free} // 'unknown';
    my $is_free = $index_line->[3]->{is_free} eq 'free';
    my $mirror_set = $is_free ? 'free' : 'nonfree';
    my $ref_key = $index_line->[2] = sha256_hex join $;,
        $ThisRev,
        (encode_web_utf8 $shash),
        (encode_web_utf8 $index_line->[3]->{is_free}),
        $index_line->[3]->{insecure} ? 1 : 0;

    my $summary = {};
    {
      $summary->{broken} = 1 if $index_line->[3]->{broken};
      $summary->{insecure} = 1 if $index_line->[3]->{insecure};
      $summary->{mirrorzip} = {
        set => $mirror_set,
        length => $mirrorzip->{length},
        sha256 => $mirrorzip->{sha256},
      };

      $summary->{legal} = {%$legal, legal => filter_legal $legal->{legal}};
      
      my $pack_file = {};
      $pack_file = $files->[0]
          if @$files and $files->[0]->{type} eq 'package';
      my $meta_file = {};
      $meta_file = $files->[1]
          if @$files >= 2 and $files->[1]->{key} eq 'meta:ckan.json'; 
      {
        $summary->{package}->{title} = $pack_file->{package_item}->{title} // '';
        $summary->{package}->{desc} = $is_free ? $pack_file->{package_item}->{desc} // $meta_file->{ckan_package}->{notes} // '' : '';
        $summary->{package}->{author} = $pack_file->{package_item}->{author} // $meta_file->{ckan_package}->{author} // '';
        $summary->{package}->{org} = $pack_file->{package_item}->{org};
        $summary->{package}->{org} //= $meta_file->{ckan_package}->{organization}->{title}
            if defined $meta_file->{ckan_package}->{organization} and
               ref $meta_file->{ckan_package}->{organization} eq 'HASH';
        $summary->{package}->{org} //= '';
        $summary->{package}->{tags} = [];
        push @{$summary->{package}->{tags}}, grep { length }
            $summary->{package}->{author},
            $summary->{package}->{org};
        if (defined $meta_file->{ckan_package}->{groups} and
            ref $meta_file->{ckan_package}->{groups} eq 'ARRAY') {
          for (@{$meta_file->{ckan_package}->{groups}}) {
            if (defined $_ and ref $_ eq 'HASH' and defined $_->{title}) {
              push @{$summary->{package}->{tags}}, $_->{title};
            }
          }
        }
        if (defined $meta_file->{ckan_package}->{tags} and
            ref $meta_file->{ckan_package}->{tags} eq 'ARRAY') {
          for (@{$meta_file->{ckan_package}->{tags}}) {
            if (defined $_ and ref $_ eq 'HASH' and defined $_->{display_name}) {
              push @{$summary->{package}->{tags}}, $_->{display_name};
            }
          }
        }
        my $found = {};
        $summary->{package}->{tags} = [grep { not $found->{$_}++ } @{$summary->{package}->{tags}}];
        $summary->{package}->{time} = $meta_file->{package_item}->{file_time}
            if defined $meta_file->{package_item}->{file_time};
        for (qw(lang dir writing_mode)) {
          $summary->{package}->{$_} = $meta_file->{package_item}->{$_}
              if defined $meta_file->{package_item}->{$_};
        }
        for (qw(page_url ckan_api_url)) {
          $summary->{package}->{$_} = $pack_file->{package_item}->{$_}
              if defined $pack_file->{package_item}->{$_};
        }
      }
      
      $summary->{files} = {};
      $summary->{length} = 0;
      for my $file (@$files) {
        next if $file->{type} eq 'package';
        next if $file->{type} eq 'dataset';
        
        my $out = {};

        $out->{title} = $file->{package_item}->{title} // '';
        $out->{mime} = $file->{package_item}->{mime}
            if defined $file->{package_item}->{mime};
        $out->{time} = $file->{package_item}->{file_time}
            if defined $file->{package_item}->{file_time};
        if (defined $file->{rev}->{length}) {
          $out->{length} = $file->{rev}->{length};
          $summary->{length} += $out->{length};
        }
        $out->{url} = $file->{rev}->{url} if defined $file->{rev}->{url};
        $out->{sha256} = $file->{rev}->{sha256}
            if defined $file->{rev}->{sha256};
        $out->{insecure} = $file->{rev}->{insecure}
            if $file->{rev}->{insecure};
        my $name = $def->{files}->{$file->{key}}->{name};
        $out->{file_name} = $name if defined $name;
        $out->{desc} = $is_free ? $file->{package_item}->{desc} // $file->{ckan_resource}->{description} // '' : '';
        $summary->{files}->{$file->{key}} = $out;
      } # $file
    }

    my $ref_path = $base_path->child
        ("snapshots/$site_type/$esite_name/refs/$ref_key.json");
    my $esite_name = escape $site_name;
    my $index_path = $base_path->child
        ("snapshots/$site_type/$esite_name/index-$pack_key_prefix.jsonl");
    my $summary_path = $base_path->child
        ("snapshots/$site_type/$esite_name/summaries/$ref_key.json");
    my $out_mirrorzip_path = $base_path->child
        ("mirror/$mirror_set/$site_type/$esite_name/$ref_key.zip");
    my $ref_file = Promised::File->new_from_path ($ref_path);
    return $ref_file->is_file->then (sub {
      return if $_[0];
      return $ref_file->write_byte_string (perl2json_bytes_for_record $ref)->then (sub {
        return Promised::File->new_from_path ($summary_path)->write_byte_string (perl2json_bytes_for_record $summary);
      })->then (sub {
        return Promised::File->new_from_path ($index_path->parent)->mkpath;
      })->then (sub {
        my $file = Promised::File->new_from_path ($out_mirrorzip_path);
        return $file->remove_tree->then (sub {
          return Promised::File->new_from_path ($out_mirrorzip_path)->hardlink_from ($mirrorzip_path);
        });
      })->then (sub {
        my $index_file = $index_path->opena;
        print $index_file perl2json_bytes $index_line;
        print $index_file "\x0A";
      });
    });
  });
} # add_to_local_index

sub process_remote_index ($$$;%) {
  my ($site_type, $site_name, $root_url, %args) = @_;
  my $esite_name = escape $site_name;
  my $base_path = $DataRootPath;
  my $path = $base_path->child
      ('local/data', $esite_name, 'files/package_list.json');
  my $file = Promised::File->new_from_path ($path);
  return $file->read_byte_string->then (sub {
    my $json = json_bytes2perl $_[0];
    my $results;
    if ($site_type eq 'ckan') {
      if (defined $json and ref $json eq 'HASH' and
          defined $json->{result} and ref $json->{result} eq 'ARRAY') {
        $results = $json->{result};
        $results = [map { [$_, $root_url."dataset/$_"] } @$results];
      }
    } elsif ($site_type eq 'packref') {
      if (defined $json and ref $json eq 'ARRAY') {
        my $base_url = Web::URL->parse_string ($root_url);
        $results = [map {
          [$_, (Web::URL->parse_string ($_, $base_url) // die "Bad URL |$_| in <$root_url>")->stringify];
        } @$json];
      }
    }
    die "Bad JSON file |$path| (site_type |$site_type|)" unless defined $results;

    {
      my %result = map { $_ => $_ } @$results;
      $results = [values %result];
      $results = [@$results[0..$args{limit}]] if @$results > $args{limit};
    }
    
    return promised_for {
      my ($pack_name, $pack_url) = @{$_[0]};
      my $epack_name = escape $pack_name;
      my $key = sha256_hex "$esite_name--$epack_name";
      
      my $now = time;
      return ddsd (
        {wd => $base_path},
        'add',
        $pack_url,
        "--name", $key,
      )->catch (sub { })->then (sub {
        return ddsd (
          {wd => $base_path},
          'use',
          $key,
          '--all',
        );
      })->then (sub {
        return ddsd (
          {wd => $base_path},
          'freeze',
          $key,
        );
      })->then (sub {
        return Promise->all ([
          ddsd (
            {wd => $base_path, jsonl => 1},
            'ls',
            $key,
            '--jsonl',
            '--with-source-meta',
            '--with-file-meta',
          ),
          ddsd (
            {wd => $base_path, json => 1},
            'legal',
            $key,
            '--json',
          ),
          ddsd (
            {wd => $base_path, json => 1},
            'export',
            'mirrorzip',
            $key,
            "local/tmp/$key.mirrorzip.zip",
            '--json',
          ),
        ]);
      })->then (sub {
        return add_to_local_index ($site_type, $site_name, $pack_name, $now,
                                   $_[0]->[0]->{jsonl}, $_[0]->[1]->{json},
                                   $_[0]->[2]->{json},
                                   "local/tmp/$key.mirrorzip.zip");
      });
    } $results;
  })->then (sub {
    my $snapshot_index_path = $base_path->child
        ("snapshots/index.json");
    my $file = Promised::File->new_from_path ($snapshot_index_path);
    my $lock = AbortController->new;
    return $file->lock_new_file (signal => $lock->signal)->then (sub {
      return $file->read_byte_string;
    })->then (sub {
      my $json = length $_[0] ? json_bytes2perl $_[0] : {};
      die "Bad json" unless defined $json;
      $json->{$site_type}->{$esite_name}->{site_type} = $site_type;
      $json->{$site_type}->{$esite_name}->{site_name} = $site_name;
      $json->{$site_type}->{$esite_name}->{esite_name} = $esite_name;
      return $file->write_byte_string (perl2json_bytes_for_record $json);
    });
  });
} # process_remote_index

sub run ($$$) {
  my ($root_url, $site_type, $site_name) = @_;
  return Promise->resolve->then (sub {
    return pull_remote_index ($site_name, $root_url);
  })->then (sub {
    return process_remote_index ($site_type, $site_name, $root_url, limit => 10);
  });
} # run

sub main () {
  return Promise->resolve->then (sub {
    return pull_remote_index ("root", "https://raw.githubusercontent.com/wakaba/nemui/ddsdrun/ddsdrun/packref.json");
  })->then (sub {
    my $base_path = $DataRootPath;
    my $path = $base_path->child
        ('local/data/root/files/list.json');
    my $file = Promised::File->new_from_path ($path);
    return $file->read_byte_string->then (sub {
      my $json = json_bytes2perl $_[0];
      my $sites = $json->{items};
      return promised_for {
        my ($root_url, $site_type, $site_name) = @{$_[0]};
        return run ($root_url, $site_type, $site_name);
      } $sites;
    });
  });
} # main

main->to_cv->recv;
