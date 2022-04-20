use strict;
use warnings;
use Socket;

my $EphemeralStart = 1024;
my $EphemeralEnd = 5000;

my $UsedPorts = [@{$Web::Transport::_Defs::BadPorts or []}];
## Bad ports are excluded
## <https://fetch.spec.whatwg.org/#port-blocking>.

sub is_listenable_port ($) {
  my $port = shift;
    return 0 unless $port;
    return 0 if $UsedPorts->[$port];
    
    my $proto = getprotobyname('tcp');
    socket(my $server, PF_INET, SOCK_STREAM, $proto) || die "socket: $!";
    setsockopt($server, SOL_SOCKET, SO_REUSEADDR, pack("l", 1)) || die "setsockopt: $!";
    bind($server, sockaddr_in($port, INADDR_ANY)) || return 0;
    listen($server, SOMAXCONN) || return 0;
    close($server);
    return 1;
}

sub find_listenable_port () {
    
    for (1..10000) {
      my $port = $EphemeralStart + int rand($EphemeralEnd - $EphemeralStart);
        next if $UsedPorts->[$port];
        if (is_listenable_port($port)) {
            $UsedPorts->[$port] = 1;
            return $port;
        }
    }

    die "Listenable port not found";
}

for (1..10) {
warn find_listenable_port;
}
