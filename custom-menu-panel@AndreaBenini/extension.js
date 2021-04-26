/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'my-indicator-extension';

const { GObject, St } = imports.gi;

const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils    = imports.misc.extensionUtils;
const Lang              = imports.lang;
const GLib              = imports.gi.GLib;
const Gio               = imports.gi.Gio;
const Main              = imports.ui.main;
const PanelMenu         = imports.ui.panelMenu;
const PopupMenu         = imports.ui.popupMenu;

const Me                = imports.misc.extensionUtils.getCurrentExtension();
const Config            = Me.imports.config
// const Core              = Me.imports.core;
// const Convenience       = Me.imports.convenience;
// const Prefs             = Me.imports.prefs;

const LOGGER_INFO = 0;
const LOGGER_WARNING = 1;
const LOGGER_ERROR = 2;


const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('My Shiny Indicator'));

            this.add_child(new St.Icon({
                icon_name: 'view-list-bullet-symbolic',
                style_class: 'system-status-icon',
            }));

            this._loadSetup();

            // let item = new PopupMenu.PopupMenuItem(_('Show Notification'));
            // item.connect('activate', () => {
            //     Main.notify(_('Whatʼs up, folks?'));
            // });
            // this.menu.addMenuItem(item);
        }

        /**
         * LOAD Program settings from .entries.json file
         */
        _loadSetup() {
            // Loading configuration from file
            this.configLoader = new Config.Loader();
            this.configLoader.loadConfig(GLib.get_home_dir() + "/.entries.json");   // $HOME/.entries.json //
            // Build the menu
            this.menu.removeAll();
            for (let i in this.configLoader.entries) {
                let item = this.configLoader.entries[i].createItem();
                this.menu.addMenuItem(item);
            }
        } /**/
    }
);


const Logger = new Lang.Class({
    Name: 'Logger',

    _init: function(log_file) {
        this._log_file = log_file;
        // initailize log_backend
        if(!log_file)
            this._initEmptyLog();
        else if(log_file == "gnome-shell")
            this._initGnomeLog();
        else
            this._initFileLog();

        this.level = LOGGER_WARNING;

        this.info = function(t) {
            if(this.level <= LOGGER_INFO) this.log(t)
        };
        this.warning = function(t) {
            if(this.level <= LOGGER_WARNING) this.log(t)
        };
        this.error = function(t) {
            if(this.level <= LOGGER_ERROR) this.log(t);
        };
    },

    _initEmptyLog: function() {
        this.log = function(_) { };
    },

    _initGnomeLog: function() {
        this.log = function(s) {
            global.log("custom-menu-panel> " + s);
        };
    },

    _initFileLog: function() {
        this.log = function(s) {
            // all operations are synchronous: any needs to optimize?
            if(!this._output_file || !this._output_file.query_exists(null) ||
                !this._fstream || this._fstream.is_closed()) {

                this._output_file = Gio.File.new_for_path(this._log_file);
                this._fstream = this._output_file.append_to(
                    Gio.FileCreateFlags.NONE, null);

                if(!this._fstream instanceof Gio.FileIOStream) {
                    this._initGnomeLog();
                    this.log("IOError: Failed to append to " + this._log_file +
                            " [Gio.IOErrorEnum:" + this._fstream + "]");
                    return;
                }
            }

            this._fstream.write(String(new Date())+" "+s+"\n", null);
            this._fstream.flush(null);
        }
    },

    notify: function(t, str, details) {
        this.ncond = this.ncond || ['proc', 'ext', 'state'];
        if(this.ncond.indexOf(t) < 0) return;
        Main.notify(str, details || "");
    },
});

// lazy-evaluation
let logger = null;
function getLogger() {
    if(logger === null)
        logger = new Logger("gnome-shell");
    return logger;
}

class Extension {
    constructor(uuid) {
        this._uuid = uuid;

        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);
    }

    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}

function init(meta) {
    return new Extension(meta.uuid);
}
