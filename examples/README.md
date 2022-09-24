# Menu Examples
This directory contains some live examples for this plugin feel free to take a look at them.  
The file in your computer **must** be called `$HOME/.entries.json`


### Usage
- An `.entries.json` file will automatically be created within your $HOME directory, if it does not already exist. (**_$HOME/.entries.json_**).

- Edit the file by clicking [Edit Config File] within the Custom Menu Config submenu and add your favorite commands, referencing the .entries.json file in this examples directory for ideas. It is a `.json` file so respect syntax and commands accordingly. For example, use commas after each item, but not on the last item.

- Reload the configuration file for changes to take effect by choosing *[Reload Configuration File]* from the *Custom Menu Config* submenu. Alternatively, disable/enable the plugin within the Extensions app or restart the entire Gnome environment using (Alt+F2, 'r', Enter).

- If you make a mistake in the .entries file and a JSON parse error occurs, a submenu entitled *'Config File Parse Error . . . '* is displayed in the custom menu and automatically expands to show *[Edit Config File]*, *[Reload Config File]* and *[View Log in Journalctl]*.

- The optional constants, 'editorExecutable', defaulted to 'gedit' and 'terminalExecutable', defaulted to 'gnome-terminal' are currently only used for the permanent *Custom Menu Config* submenu items , where *[Edit Config File]* uses 'editorExecutable' and *[View Log in Journalctl]* uses 'terminalExecutable'. These have been tested with Geany and Tilix, respectively.

_Feel free to request features or document issues_
