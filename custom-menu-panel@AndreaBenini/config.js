import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Json from 'gi://Json';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import {getLogger} from './logger.js';

const Entry = class Entry {
    constructor(prop) {
        this.type = prop.type;
        this.title = prop.title || "";
        this.__vars = prop.__vars || [];
        this.updateEnv(prop);
    }

    setTitle(text) {
        this.item.label.get_clutter_text().set_text(text);
    }

    updateEnv(prop) {
        this.__env = {}
        if (!this.__vars) return;
        for (let i in this.__vars) {
            let v = this.__vars[i];
            this.__env[v] = prop[v] ? String(prop[v]) : "";
        }
    }

    // the pulse function should be read as "a pulse arrives"
    pulse() { }

    _try_destroy() {
        try {
            if (this.item && this.item.destroy) {
                this.item.destroy();
            }
        } catch(e) { /* Ignore all errors during destory*/ }
    }
}; /**/

const DerivedEntry = class DerivedEntry {
    constructor(prop) {
        if (!prop.base) {
            throw new Error("Base entry not specified in type definition.");
        }
        this.base = prop.base;
        this.vars = prop.vars || [];
        delete prop.base;
        delete prop.vars;
        this.prop = prop;
    }

    createInstance(addit_prop) {
        let cls = type_map[this.base];
        if (!cls) {
            throw new Error("Bad base class.");
        }
        if (cls.createInstance) {
            throw new Error("Not allowed to derive from dervied types");
        }
        for (let rp in this.prop) {
            addit_prop[rp] = this.prop[rp];
        }
        addit_prop.__vars = this.vars;
        let instance = new cls(addit_prop);
        return instance;
    }
}; /**/

let __pipeOpenQueue = [];

/* callback: function (stdout, stderr, exit_status) { }  */
function pipeOpen(cmdline, env, callback) {
    if (cmdline === undefined || callback === undefined) {
        return false;
    }
    realPipeOpen(cmdline, env, callback);
    return true;
}; /**/

function realPipeOpen(cmdline, env, callback) {
    let user_cb = callback;
    let proc;

    function wait_cb(_, _res) {
        let stdout_pipe = proc.get_stdout_pipe();
        let stderr_pipe = proc.get_stderr_pipe();
        let stdout_content;
        let stderr_content;

        // Only the first GLib.MAXINT16 characters are fetched for optimization.
        stdout_pipe.read_bytes_async(GLib.MAXINT16, 0, null, function(osrc, ores) {
            const stdout_bytes = stdout_pipe.read_bytes_finish(ores);
            stdout_content = new TextDecoder().decode(stdout_bytes.get_data());
            stdout_pipe.close(null);
            stderr_pipe.read_bytes_async(GLib.MAXINT16, 0, null, function(esrc, eres) {
                const stderr_bytes = stderr_pipe.read_bytes_finish(eres);
                stderr_content = new TextDecoder().decode(stderr_bytes.get_data());
                stderr_pipe.close(null);
                user_cb(stdout_content, stderr_content, proc.get_exit_status());
            });
        });
    }
    if (user_cb) {
        let _pipedLauncher = new Gio.SubprocessLauncher({
            flags:
                Gio.SubprocessFlags.STDERR_PIPE |
                Gio.SubprocessFlags.STDOUT_PIPE
        });
        for (let key in env) {
            _pipedLauncher.setenv(key, env[key], true);
        }
        proc = _pipedLauncher.spawnv(['bash', '-c', cmdline]);
        proc.wait_async(null, wait_cb);
    } else {
        // Detached launcher is used to spawn commands that we are not concerned about its result.
        let _detacLauncher = new Gio.SubprocessLauncher();
        for (let key in env) {
            _detacLauncher.setenv(key, env[key], true);
        }
        proc = _detacLauncher.spawnv(['bash', '-c', cmdline]);
    }
    getLogger().info("Spawned " + cmdline);
    return proc.get_identifier();
}; /**/

function _generalSpawn(command, env, title) {
    title = title || "Process";
    pipeOpen(command, env, function(stdout, stderr, exit_status) {
        if (exit_status != 0) {
            getLogger().warning(stderr);
            getLogger().notify("proc", title + " exited with status " + exit_status, stderr);
        }
    });
}; /**/

// Detect menu toggle on startup
function _toggleDetect(command, env, object) {
    pipeOpen(command, env, function(stdout, stderr, exit_status) {
        let isToggleActive = (exit_status == 0);
        if (isToggleActive) {
            object.item.setToggleState(true);
        } else {                        // Do NOT execute any action for a toggler initialized as FALSE (just finishing the object init)
            object._initialized = true;
        }
    });
}; /**/


/**
 * This cache is used to reduce detector cost.
 * Each time creating an item, it check if the result of this detector is cached, 
 * which prevent the togglers from running detector on each creation. 
 * This is useful especially in search mode.
 */
let _toggler_state_cache = { };


const TogglerEntry = class TogglerEntry extends Entry {
    constructor(prop) {
        super(prop);
        this.command_on = prop.command_on || "";
        this.command_off = prop.command_off || "";
        this.detector = prop.detector || "";
        this.auto_on = prop.auto_on || false;
        this.notify_when = prop.notify_when || [];
        // if the switch is manually turned off, auto_on is disabled.
        this._manually_switched_off = false;
        this._initialized = true;
    }

    createItem() {
        this._try_destroy();
        this.item = new PopupMenu.PopupSwitchMenuItem(this.title, false);
        this.item.label.get_clutter_text().set_use_markup(true);
        this.item.connect('toggled', this._onManuallyToggled.bind(this));
        this._loadState();
        this._initialized = false;
        _toggleDetect(this.detector, this.__env, this);
        return this.item;
    }

    _onManuallyToggled(_, state) {
        // Skip toggling during initialization execution
        if (!this._initialized) {
            this._initialized = true;
            this._storeState(state);
            return;
        }
        // when switched on again, this flag will get cleared.
        this._manually_switched_off = !state;
        this._storeState(state);
        this._onToggled(state);
    }

    _onToggled(state) {
        if (state) {
            _generalSpawn(this.command_on, this.__env, this.title);
        } else {
            _generalSpawn(this.command_off, this.__env, this.title);
        }
    }

    _detect(callback) {
        // abort detecting if detector is an empty string
        if (!this.detector) {
            return;
        }
        pipeOpen(this.detector, this.__env, function(out) {
            out = String(out);
            callback(!Boolean(out.match(/^\s*$/)));
        });
    }

    // compare the new state with cached state notify when state is different
    compareState(new_state) {
        let old_state = _toggler_state_cache[this.detector];
        if (old_state === undefined) return;
        if (old_state == new_state)  return;

        if (this.notify_when.indexOf(new_state ? "on" : "off") >= 0) {
            let not_str = this.title + (new_state ? " started." : " stopped.");
            if (!new_state && this.auto_on) {
                not_str += " Attempt to restart it now.";
            }
            getLogger().notify("state", not_str);
        }
    }

    _storeState(state) {
        let hash = JSON.stringify({ env: this.__env, detector: this.detector });
        _toggler_state_cache[hash] = state;
    }

    _loadState() {
        let hash = JSON.stringify({ env: this.__env, detector: this.detector });
        let state = _toggler_state_cache[hash];
        if (state !== undefined) {
            this.item.setToggleState(state);            // doesn't emit 'toggled'
        }
    }

    pulse() {
        this._detect((state) => {
            this.compareState(state);
            this._storeState(state);
            this._loadState();
            if (!state && !this._manually_switched_off && this.auto_on) {
                // do not call setToggleState here, because command_on may fail
                this._onToggled(this.item, true);
            }
        });
    }

    perform() {
        this.item.toggle();
    }
}; /**/

const LauncherEntry = class LauncherEntry extends Entry {
    constructor(prop) {
        super(prop);
        this.command = prop.command || "";
    }

    createItem() {
        this._try_destroy();
        this.item = new PopupMenu.PopupMenuItem(this.title);
        this.item.label.get_clutter_text().set_use_markup(true);
        this.item.connect('activate', this._onClicked.bind(this));
        return this.item;
    }

    _onClicked(_) {
        _generalSpawn(this.command, this.__env, this.title);
    }

    perform() {
        this.item.emit('activate');
    }
}; /**/

const ReloadEntry = class ReloadEntry extends Entry {
    constructor(prop, indicator) {
        super(prop);
        this.command   = prop.command || "";
        this.indicator = indicator;
    }

    createItem() {
        this._try_destroy();
        this.item = new PopupMenu.PopupMenuItem(this.title);
        this.item.label.get_clutter_text().set_use_markup(true);
        this.item.connect('activate', this._onClicked.bind(this));
        return this.item;
    }
    
    _onClicked(_) {
        if (this.indicator && typeof this.indicator.loadSetup === 'function') {
            this.indicator.loadSetup();
            log('custom-menu-panel: Configuration reloaded');
        }
    }

    perform() {
        this.item.emit('activate');
    }
}; /**/

const SubMenuEntry = class SubMenuEntry extends Entry {
    constructor(prop, indicator) {
        super(prop);
        this.indicator = indicator;

        if (prop.entries == undefined) {
            throw new Error("Expected entries provided in submenu entry.");
        }
        this.entries = [];
        for (let i in prop.entries) {
            let entry_prop = prop.entries[i];
            let entry = createEntry(entry_prop, indicator);
            this.entries.push(entry);
        }
    }

    createItem() {
        this._try_destroy();
        this.item = new PopupMenu.PopupSubMenuMenuItem(this.title);
        this.item.label.get_clutter_text().set_use_markup(true);
        for (let i in this.entries) {
            let entry = this.entries[i];
            this.item.menu.addMenuItem(entry.createItem());
        }
        return this.item;
    }

    pulse() {
        for (let i in this.entries) {
            let entry = this.entries[i];
            entry.pulse();
        }
    }
}; /**/

const SeparatorEntry = class SeparatorEntry extends Entry {
    constructor(prop) {
        super(prop);
    }

    createItem() {
        this._try_destroy();
        this.item = new PopupMenu.PopupSeparatorMenuItem(this.title);
        this.item.label.get_clutter_text().set_use_markup(true);
        return this.item;
    }
}; /**/

let type_map = {};

////////////////////////////////////////////////////////////////////////////////
// Config Loader loads config from JSON file.

// convert Json Nodes (GLib based) to native javascript value.
function convertJson(node) {
    if (node.get_node_type() == Json.NodeType.VALUE) {
        return node.get_value();
    }
    if (node.get_node_type() == Json.NodeType.OBJECT) {
        let obj = {}
        node.get_object().foreach_member(function(_, k, v_n) {
            obj[k] = convertJson(v_n);
        });
        return obj;
    }
    if (node.get_node_type() == Json.NodeType.ARRAY) {
        let arr = []
        node.get_array().foreach_element(function(_, i, elem) {
            arr.push(convertJson(elem));
        });
        return arr;
    }
    return null;
}; /**/

// Instantiate a generic menu item inside [indicator]
function createEntry(entry_prop, indicator) {
    if (!entry_prop.type) {
        throw new Error("No type specified in entry.");
    }
    let cls = type_map[entry_prop.type];
    if (!cls) {
        throw new Error("Incorrect type '" + entry_prop.type + "'");
    } else if (cls.createInstance) {
        return cls.createInstance(entry_prop, indicator);
    }
    return new cls(entry_prop, indicator);
}; /**/


export const Loader = class Loader {
    constructor(filename, menu) {
        this._configurationFilename = filename;
        this._menu = menu;
    } /**/

    // Reset type_map everytime and load the config
    loadConfig() {
        type_map = {
            launcher: LauncherEntry,
            reload: ReloadEntry,
            toggler: TogglerEntry,
            submenu: SubMenuEntry,
            separator: SeparatorEntry
        };

        // New widgets inherited as DerivedEntry() from [type_map]
        type_map.systemd = new DerivedEntry({
            base: 'toggler',
            vars: ['unit'],
            command_on: "pkexec systemctl start ${unit}",
            command_off: "pkexec systemctl stop ${unit}",
            detector: "systemctl status ${unit} | grep 'Active:\\sactiv'",
        });
        type_map.tmux = new DerivedEntry({
            base: 'toggler',
            vars: ['command', 'session'],
            command_on: 'tmux new -d -s ${session} bash -c "${command}"',
            command_off: 'tmux kill-session -t ${session}',
            detector: 'tmux has -t "${session}" 2>/dev/null && echo yes',
        });

        /**
         * Refer to README.md file for detailed config file format
         */
        this.entries = []; // Remove all entries before loading them again

        let config_parser = new Json.Parser();
        config_parser.load_from_file(this._configurationFilename);
        let conf = convertJson(config_parser.get_root());
        if (conf.entries == undefined) {
            throw new Error("Key 'entries' not found.");
        }
        if (conf.deftype) {
            for (let tname in conf.deftype) {
                if (type_map[tname]) {
                    throw new Error("Type \""+tname+"\" duplicated.");
                }
                type_map[tname] = new DerivedEntry(conf.deftype[tname]);
            }
        }
        // finally loading configuration in [this.entries]
        for (let conf_i in conf.entries) {
            let entry_prop = conf.entries[conf_i];
            this.entries.push(createEntry(entry_prop, this._menu));
        }
    }

    /**
     * Create a default configuration when it does not exists, just change it manually later if you need
     */
    saveDefaultConfig() {
        const PERMISSIONS_MODE = 0o640;
        const jsonString = JSON.stringify({
            "_homepage_": "https://github.com/andreabenini/gnome-plugin.custom-menu-panel",
            "_examples_": "https://github.com/andreabenini/gnome-plugin.custom-menu-panel/tree/main/examples",
            "entries": [ 
                {
                    "type": "launcher",
                    "title": "Edit menu",
                    "command": "gedit $HOME/.entries.json"
                },
                {
                    "type": "reload",
                    "title": "Reload Configuration"
                }
            ]
        }, null, 4);
        let fileConfig = Gio.File.new_for_path(this._configurationFilename);
        if (GLib.mkdir_with_parents(fileConfig.get_parent().get_path(), PERMISSIONS_MODE) === 0) {
            fileConfig.replace_contents(jsonString, null, false, Gio.FileCreateFlags.REPLACE_DESTINATION, null);
        }
        // Try to load newly saved file
        try {
            this.loadConfig();
        } catch(e) {
            Main.notify(_('Cannot create and load file: '+this._configurationFilename));
        }
    }
}; /**/
