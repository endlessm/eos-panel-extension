// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported getMigrationSettings, tryMigrateSettings,
 *   override, restore, original, loadInterfaceXML */
/*
 * Copyright © 2020 Endless OS Foundation LLC
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, see <http://www.gnu.org/licenses/>.
 */

const { Gio } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

function getMigrationSettings() {
    const dir = PanelExtension.dir.get_child('schemas').get_path();
    const source = Gio.SettingsSchemaSource.new_from_directory(dir,
        Gio.SettingsSchemaSource.get_default(), false);

    if (!source)
        throw new Error('Error retrieving settings schema source');

    const schema = source.lookup('org.gnome.shell', false);
    if (!schema)
        throw new Error('Schema missing');

    return new Gio.Settings({ settings_schema: schema });
}

function tryMigrateSettings() {
    const settings = ExtensionUtils.getSettings();
    if (settings.get_boolean('panel-settings-migrated'))
        return;

    const desktopInterfaceSettings = new Gio.Settings({
        schema_id: 'org.gnome.desktop.interface',
    });

    const oldSettings = getMigrationSettings();
    const boolSettings = [
        [ 'hot-corner-enabled', desktopInterfaceSettings, 'enable-hot-corners' ],
        [ 'hot-corner-on-right', null, null ],
        [ 'hot-corner-on-bottom', null, null ],
    ];
    const intSettings = [
        [ 'hot-corner-size', null, null ],
    ];

    boolSettings.forEach((k) => {
        const destSettings = k[1] ? k[1] : settings;
        const destKey = k[2] ? k[2] : k[0];
        destSettings.set_boolean(destKey, oldSettings.get_boolean(k[0]));
    });
    intSettings.forEach((k) => {
        const destSettings = k[1] ? k[1] : settings;
        const destKey = k[2] ? k[2] : k[0];
        destSettings.set_int(destKey, oldSettings.get_int(k[0]));
    });

    settings.set_boolean('panel-settings-migrated', true);
}

function override(object, methodName, callback) {
    if (!object._panelFnOverrides)
        object._panelFnOverrides = {};

    const baseObject = object.prototype || object;
    const originalMethod = baseObject[methodName];
    object._panelFnOverrides[methodName] = originalMethod;
    baseObject[methodName] = callback;
}

function restore(object) {
    const baseObject = object.prototype || object;
    if (object._panelFnOverrides) {
        Object.keys(object._panelFnOverrides).forEach(k => {
            baseObject[k] = object._panelFnOverrides[k];
        });
        delete object._panelFnOverrides;
    }
}

function original(object, methodName) {
    return object._panelFnOverrides[methodName];
}

function loadInterfaceXML(iface) {
    let uri = `file://${PanelExtension.path}/data/dbus-interfaces/${iface}.xml`;
    let f = Gio.File.new_for_uri(uri);

    try {
        let [ok_, bytes] = f.load_contents(null);
        return imports.byteArray.toString(bytes);
    } catch (e) {
        log(`Failed to load D-Bus interface ${iface}`);
    }

    return null;
}
