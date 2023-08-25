#!/usr/bin/env bash
#
# Plain and simple script to create the gnome shell extension
#
# @see  I'm lazy, instead of creating a proper zip file each time I run this
#       Feel free to edit this file and send it back to me as a merge request
#
DEST=custom-menu-panel@AndreaBenini
ZIP=/tmp/custom-menu-panelAndreaBenini.shell-extension.zip

cd $DEST
zip --quiet $ZIP *
cd - >/dev/null
echo "File '$ZIP' created"
