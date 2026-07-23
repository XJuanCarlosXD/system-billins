#!/bin/sh
set -e
cron
exec "$@"
