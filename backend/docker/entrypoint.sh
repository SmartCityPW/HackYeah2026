#!/bin/sh
# Migracje i (zależnie od konfiguracji YAML: seed.on_start) słowniki oraz scenariusze, potem właściwy proces.
set -e
python manage.py bootstrap
exec "$@"
