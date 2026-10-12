/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
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
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/**
 * @author Ben
 * @see    https://github.com/andreabenini/gnome-plugin.custom-menu-panel
 */

/* exported init */
import GObject from 'gi://GObject';
import St from 'gi://St';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as Config from './config.js';
import * as Logger from './logger.js';

const GETTEXT_DOMAIN = 'custom-menu-panel';
const CONFIGURATION_FILE = '/.entries.json';

const LOGGER_INFO = 0;
const LOGGER_WARNING = 1;
const LOGGER_ERROR = 2;

const Indicator = GObject.registerClass(
    class Indicator extends PanelMenu.Button {
        _init() {
            super._init(0.0, _('Custom Menu Panel Indicator'));
            this.add_child(new St.Icon({
                icon_name: 'view-list-bullet-symbolic',
                style_class: 'system-status-icon',
            }));
            this.loadSetup();
        } /**/

        /**
         * LOAD Program settings from .entries.json file
         */
        loadSetup() {
            this.menu.removeAll();
            // Loading configuration from file
            this.configLoader = new Config.Loader(GLib.get_home_dir() + CONFIGURATION_FILE, this);
            try {
                this.configLoader.loadConfig();                                 // $HOME/.entries.json
            } catch(e) {
                this.configLoader.saveDefaultConfig();                          // create default entries
            }
            // Build the menu
            let i = 0;
            for (let i in this.configLoader.entries) {
                let item = this.configLoader.entries[i].createItem();
                this.menu.addMenuItem(item);
            }
        } /**/
    }
);

export default class CustomMenuPanelExtension extends Extension {
    constructor(metadata) {
        super(metadata);
        this._uuid = metadata.uuid;
    }
    
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this._uuid, this._indicator);
    } /**/

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
        Logger.destroyLogger();
    } /**/
}
