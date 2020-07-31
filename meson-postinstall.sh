#!/bin/sh

set -e

schemadir="$1"

echo Compiling GSettings schemas...
glib-compile-schemas ${DESTDIR}/${MESON_INSTALL_PREFIX}/${schemadir}
