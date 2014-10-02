#!/usr/bin/perl
use strict;
use warnings;
use Path::Class;
use lib glob file (__FILE__)->dir->parent->subdir ('modules/wanage/modules/*/lib');
use Wanage::HTTP;
use Warabe::App;
use Data::Dumper;

$Wanage::HTTP::UseXForwardedScheme = 1;
$Wanage::HTTP::UseXForwardedHost = 1;

return sub {
  my $env = $_[0];
  my $http = Wanage::HTTP->new_from_psgi_env ($env);
  my $app = Warabe::App->new_from_http ($http);
  return $http->send_response (onready => sub {
    if ($app->path_segments->[0] eq 'die') {
      die "/die";
    } else {
      $app->execute (sub {
        my $path = $app->path_segments;
        $app->http->set_status (404);
        $app->send_plain_text (Dumper $env);
        return $app->throw;
      });
    }
  });
};
