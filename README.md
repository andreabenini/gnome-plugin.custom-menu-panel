# Gnome Custom Menu Panel
Custom menu on Gnome Top Bar with your favorite program shortcuts.

![Screenshot Preview](screenshot.png)
![another Preview](widget.png)


### Usage:
- Edit `.entries.json` to match your needs
- Copy `.entries.json` file to `$HOME/`  

If you edit `.entries.json` while running gnome please ensure to reload Gnome Window Manager (Alt+F2, "r")  
Tested with: Arch Linux, X11, Gnome v41.1.0.  
Widgets manual below describe available options, in the `examples` directory you can see some tests you can
pick for your setup


---

## Widgets Manual
Here are common widgets and entities you can use with this plugin:
### **- Launcher**
Create a new entry and put it in the menu
```json
    {
      "type": "launcher",
      "title": "Item Name on Menu",
      "command": "/your/command/to/execute --with-parameters"
    },
```

### **- Separator**
Place a menu separator _(\<hr>)_
```json
    {
      "type": "separator"
    },
```

### **- SubMenu**
Create a submenu inside current menu, items inside the submenu are placed inside `entries`
and they can be of any type (launcher, separator, submenu, ...)
```json
    {
        "type": "submenu",
        "title": "Menu Name",
        "entries": [
            //... Place your entries here ...//
        ]
    },
```
