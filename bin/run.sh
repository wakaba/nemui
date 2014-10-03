#!/bin/sh
while true
do
  ./plackup -s Twiggy -p $PORT bin/server.psgi
done
