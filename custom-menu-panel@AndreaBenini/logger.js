import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const LOGGER_INFO = 0;
const LOGGER_WARNING = 1;
const LOGGER_ERROR = 2;

const Logger = class Logger {
    constructor(log_file) {
        this._log_file = log_file;
        // initialize log_backend
        if (!log_file) {
            this._initEmptyLog();
        } else if(log_file == "gnome-shell") {
            this._initGnomeLog();
        } else {
            this._initFileLog();
        }
        this.level = LOGGER_WARNING;
        this.info = function(t) {
            if (this.level <= LOGGER_INFO) {
                this.log(t);
            }
        };
        this.warning = function(t) {
            if (this.level <= LOGGER_WARNING) {
                this.log(t);
            }
        };
        this.error = function(t) {
            if (this.level <= LOGGER_ERROR) {
                this.log(t);
            }
        };
    }

    _initEmptyLog() {
        this.log = function(_) { };
    }

    _initGnomeLog() {
        this.log = function(s) {
            console.log("custom-menu-panel> " + s);
        };
    }

    _initFileLog() {
        this.log = function(s) {
            // all operations are synchronous: any needs to optimize?
            if (!this._output_file || !this._output_file.query_exists(null) || !this._fstream || this._fstream.is_closed()) {
                this._output_file = Gio.File.new_for_path(this._log_file);
                this._fstream = this._output_file.append_to(Gio.FileCreateFlags.NONE, null);
                if (!this._fstream instanceof Gio.FileIOStream) {
                    this._initGnomeLog();
                    this.log("IOError: Failed to append to " + this._log_file + " [Gio.IOErrorEnum:" + this._fstream + "]");
                    return;
                }
            }
            this._fstream.write(String(new Date())+" "+s+"\n", null);
            this._fstream.flush(null);
        }
    }

    notify(t, str, details) {
        this.ncond = this.ncond || ['proc', 'ext', 'state'];
        if (this.ncond.indexOf(t) < 0) {
            return;
        }
        Main.notify(str, details || "");
    }
};

// lazy-evaluation
let logger = null;
export function getLogger() {
    if (logger === null) {
        logger = new Logger("gnome-shell");
    }
    return logger;
}
