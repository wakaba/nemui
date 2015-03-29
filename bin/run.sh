#!/bin/sh
while true
do
  ./plackup -p $PORT bin/server.psgi
done
