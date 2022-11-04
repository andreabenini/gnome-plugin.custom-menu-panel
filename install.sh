#!/usr/bin/env bash

set -e

if [ "$UID" = "0" ]; then
    echo 'This should not be run as root'
    exit 101
fi

NAME=custom-menu-panel\@AndreaBenini
SRC=src
DEST=~/.local/share/gnome-shell/extensions/$NAME

function compile-translations {
  if [ -d locale ]; then
    echo 'Compiling translations...'
    for po in locale/*/LC_MESSAGES/*.po; do
      msgfmt -cv -o ${po%.po}.mo $po;
    done
  else
    echo 'No translations to compile... Skipping'
  fi
}

function compile-preferences {
    if [ -d ${SRC}/schemas ]; then
        echo 'Compiling preferences...'
        glib-compile-schemas --targetdir=${SRC}/schemas ${SRC}/schemas
    else
        echo 'No preferences to compile... Skipping'
    fi
}

function make-local-install {

    compile-translations
    compile-preferences

    echo 'Installing...'
    if [ ! -d $DEST ]; then
        mkdir $DEST
    fi
    cp -r ${SRC}/* $DEST/
    if [ -d locale ]; then
      cp -r locale $DEST/
    fi


    busctl --user call org.gnome.Shell /org/gnome/Shell org.gnome.Shell Eval s 'Meta.restart("Restarting…")'

    echo 'Done'
}

function make-zip {
    if [ -d build ]; then
        rm -r build
    fi

    rm -fv "$NAME".zip
    mkdir build
    compile-translations
    compile-preferences
    echo 'Coping files...'
    cp -r README.md LICENSE CHANGELOG.txt ${SRC}/* build/
    if [ -d locale ]; then
      cp -r locale build/
    fi

    find build -name "*.po*" -delete
    echo 'Creating archive..'
    cd build
    zip -r ../"$NAME".zip ./*
    cd ..
    rm -r build
    echo 'Done'
}

function usage() {
    echo 'Usage: ./install.sh COMMAND'
    echo 'COMMAND:'
    echo "  local-install  install the extension in the user's home directory"
    echo '                 under ~/.local'
    echo '  zip            Creates a zip file of the extension'
}

case "$1" in
    "local-install" )
        make-local-install
        ;;

    "zip" )
        make-zip
        ;;

    * )
        usage
        ;;
esac
exit
