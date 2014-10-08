#!/usr/bin/perl
use strict;
use warnings;
use Path::Class;
use lib glob file (__FILE__)->dir->parent->subdir ('modules/wanage/modules/*/lib');
use Wanage::HTTP;
use Warabe::App;
use Data::Dumper;

$Wanage::HTTP::UseXForwardedScheme = 1;
$Wanage::HTTP::UseXForwardedFor = 1;
$Wanage::HTTP::UseCFVisitor = 1;
$Wanage::HTTP::UseCFConnectingIP = 1;

return sub {
  my $env = $_[0];
  my $http = Wanage::HTTP->new_from_psgi_env ($env);
  my $app = Warabe::App->new_from_http ($http);
  return $http->send_response (onready => sub {
    if ($app->path_segments->[0] eq 'die') {
      print "/DIE\n";
      warn "/die";
      exit;
    } elsif ($app->path_segments->[0] eq 'style') {
      $app->http->set_response_header ('Content-Type' => 'text/css');
      $app->http->set_response_last_modified (time);
      $app->send_plain_text ('.PASS { color: green } .FAIL { color: red }');
    } elsif ($app->path_segments->[0] eq 'style.css') {
      $app->http->set_response_header ('Content-Type' => 'text/css');
      $app->http->set_response_last_modified (time);
      $app->send_plain_text ('.PASS { color: green } .FAIL { color: red }');
    } else {
      $app->execute (sub {
        my $path = $app->path_segments;
        $app->http->set_status (404);
        $app->send_plain_text (Dumper {
          env => $env,
          url => $app->http->url->stringify,
          client_ip_addr => $app->http->client_ip_addr->as_text,
          hoge => 1,
        });
        return $app->throw;
      });
    }
  });
};

