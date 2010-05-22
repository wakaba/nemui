#!/usr/bin/perl
use strict;
use warnings;
use CGI::Carp qw(fatalsToBrowser);
use Time::Local qw(timegm_nocheck);
use Data::Dumper;

sub percent_decode_b ($) {
  my $s = shift;
  $s =~ s/%([0-9A-Fa-f]{2})/pack 'C', hex $1/ge;
  return $s;
} # percent_decode_c

sub htescape ($) {
  my $s = shift;
  $s =~ s/&/&amp;/g;
  $s =~ s/</&lt;/g;
  $s =~ s/>/&gt;/g;
  $s =~ s/\x22/&quot;/g;
  return $s;
} # htescape

my $re_ccontent;
$re_ccontent = qr/(?>[^()\\]|\\.|\((??{$re_ccontent})\))+/so;
my $re_comment = qr/\($re_ccontent\)/o;
sub tokenize ($) {
  my $s = shift;
  my $tokens = [];
  while ($s =~ s/^\s*($re_comment|[0-9A-Za-z_-]+|[^\s0-9A-Za-z_-])//o) {
    push @$tokens, $1;
  }
  return $tokens;
} # tokenize

sub join_tokens ($) {
  my $tokens = shift;
  my $r = '';
  while (@$tokens) {
    my $token = shift @$tokens;
    if ($r =~ /[)]$/) {
      $r .= ' ';
    } elsif ($r =~ /[0-9A-Za-z_-]$/ and $token =~ /^[0-9A-Za-z_-]/) {
      $r .= ' ';
    } elsif ($r =~ /./ and $token =~ /^[+-]$/) {
      $r .= ' ';
    }
    $r .= $token;
    if ($token eq ',') {
      $r .= ' ';
    }
  }
  return $r;
} # join_tokens

sub parse_date_time ($) {
  my $s = shift;
  if ($s =~ /([0-9]+) ([A-Za-z]+) ([0-9]+) ([0-9]+):([0-9]+)(?::([0-9]+))? ([+-][0-9]{2})([0-9]{2})/) {
    my $y = $3;
    my $m = ({
      jan => 1,
      feb => 2,
      mar => 3,
      apr => 4,
      may => 5,
      jun => 6,
      jul => 7,
      aug => 8,
      sep => 9,
      oct => 10,
      nov => 11,
      dec => 12
    }->{lc $2} || 1) - 1;
    my $d = $1;
    my $h = $4 - $7;
    my $min = $5 - $8;
    my $s = $6 || 0;
    return timegm_nocheck $s, $min, $h, $d, $m, $y;
  } else {
    return undef;
  }
} # parse_date_time

sub parse_received ($) {
  my $tokens = tokenize shift;

  my $fields = {};
  my $field_name = '';
  my $prev_token = 'no token';
  while (@$tokens) {
    my $token = shift @$tokens;
    my $push_token = 1;
    if ($token eq ';') {
      $field_name = 'date-time';
      $push_token = 0;
    } elsif (
      {
        '.' => 1,
        '<' => 1,
        '>' => 1,
        '@' => 1,
      }->{$prev_token} or
      $field_name eq 'date-time' or
      $prev_token eq $field_name
    ) {
      
    } elsif ($token =~ /^[A-Za-z]+$/) {
      $token =~ tr/A-Z/a-z/;
      $field_name = $token;
      $push_token = 0;
    }
    push @{$fields->{$field_name . ($token =~ /^\(/ ? '_comment' : '')} ||= []}, $token if $push_token;

    $prev_token = $token;
  }

  for (keys %$fields) {
    $fields->{$_} = join_tokens $fields->{$_};
  }

  if ($fields->{with}) {
    $fields->{with} =~ tr/A-Z/a-z/;
  }

  if ($fields->{from_comment}) {
    if ($fields->{from_comment} =~ /^\(([0-9A-Za-z_.-]+)\s*\[([0-9.]+)\]\)$/) {
      $fields->{from_domain} = $1;
      $fields->{from_ipaddr} = $2;
      delete $fields->{from_comment};
    } elsif ($fields->{from_comment} =~ /^\(\[([0-9.]+)\]\)$/) {
      $fields->{from_ipaddr} = $1;
      delete $fields->{from_comment};
    }
  }

  if ($fields->{'date-time_comment'}) {
    if ($fields->{'date-time_comment'} =~ /^\(.[DS]T\)$/) {
      delete $fields->{'date-time_comment'};
    }
  }

  if ($fields->{by_comment}) {
    if ($fields->{by_comment} =~ /^\((Postfix|.*?\brelay)\)$/) {
      $fields->{by_agent} = $1;
      delete $fields->{by_comment};
    } elsif ($fields->{by_comment} =~ /^\(Postfix, from userid (\d+)\)$/) {
      $fields->{by_agent} = 'Postfix';
      $fields->{by_userid} = $1;
      delete $fields->{by_comment};
    }
  }

  if ($fields->{'date-time'}) {
    $fields->{'date-time'} = parse_date_time $fields->{'date-time'};
    delete $fields->{'date-time'} unless $fields->{'date-time'};
  }

  return $fields;
} # parse_received

sub process_chunk ($) {
  my $chunk = shift;
  my $processed = {};
  for my $field (@$chunk) {
    if ($field->[0] eq 'received') {
      $processed->{received} = $field->[2] = parse_received $field->[1];
    } elsif ($field->[0] eq 'date') {
      $processed->{date} = parse_date_time $field->[1];
    }
  }

  $processed->{date} = $processed->{received}->{'date-time'} || $processed->{date};

  return $processed;
} # process_chunk

my %input = map { tr/+/ /; percent_decode_b $_ } map { split /=/, $_, 2 } split /[&;]/, $ENV{QUERY_STRING} // '';

print "Content-Type: text/html\n\n<!DOCTYPE HTML><link rel=stylesheet href='/www/style/html/xhtml'><style>

  .chunk {
    margin: 1em;
    border: 1px blue dashed;
  }

  .chunk p {
    text-indent: 0;
  }

  textarea {
    height: 10em;
  }
</style>";

if (defined $input{mail}) {
  print "<h1>Parsed</h1>";

  my $fields = [''];
  for my $line (split /\x0D?\x0A/, $input{mail} // '') {
    last if $line eq '';

    if ($line =~ /^\s/) {
      $fields->[-1] .= $line;
    } else {
      push @$fields, $line;
    }
  }
  shift @$fields if $fields->[0] eq '';

  my $chunks = [];
  my $last_chunk = [];
  my $last_field = '';
  for my $field (@$fields) {
    my $field_name = '';
    if ($field =~ s/^([^:\s]+)\s*:\s*//) {
      $field_name = $1;
      $field_name =~ tr/A-Z/a-z/;
    }

    my $end_chunk_before;
    my $end_chunk_after;
    if ({
      'received' => 1,
      'received-spf' => 1,
    }->{$last_field}) {
      if ({
        'received-spf' => 1,
        'authentication-results' => 1,
      }->{$field_name}) {
        #
      } else {
        $end_chunk_before = 1;
      }
    } elsif ({
      'authentication-results' => 1,
    }->{$last_field}) {
      if ($field_name eq 'received') {
        $end_chunk_before = 1;
      }
    }

    if ($end_chunk_before and @$last_chunk) {
      push @$chunks, $last_chunk;
      $last_chunk = [];
    }

    push @$last_chunk, [$field_name => $field];

    if ($end_chunk_after) {
      push @$chunks, $last_chunk;
      $last_chunk = [];
    }

    $last_field = $field_name;
  }
  push @$chunks, $last_chunk if @$last_chunk;

  my $prev_date;
  for my $chunk (@$chunks) {
    print "<div class=chunk>";
    my $processed = process_chunk $chunk;
    if ($processed->{date}) {
      print "<p>Date: ", htescape localtime $processed->{date};
      if ($prev_date) {
        print ' (delta = ' . ($prev_date - $processed->{date}) . ' seconds)';
      }
      $prev_date = $processed->{date};
    }
    print "<pre>", htescape Dumper $processed;
    print "</pre>";
    for my $field (@$chunk) {
      print "<p><code>", htescape $field->[0], "</code>: <code>", htescape $field->[1], "</code>";
    }
    print "</div>";
  }
}

print qq[
<h1>Input</h1>

<form action method=get>
  <textarea name=mail>${\htescape ($input{mail} // '')}</textarea>
  <input type=submit>
</form>
];
