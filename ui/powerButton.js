// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported PowerButton */
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

const { Atk, Clutter, Gio, GObject } = imports.gi;

const GnomeSession = imports.misc.gnomeSession;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const SingleIconButton = PanelExtension.imports.ui.panelMenu.SingleIconButton;
const _ = PanelExtension.imports.utils.gettext;

var PowerButton = GObject.registerClass(
class PowerButton extends SingleIconButton {
    _init() {
        super._init(0.0, C_("Power menu", "Power"), false);

        this.accessible_role = Atk.Role.PUSH_BUTTON;

        this._session = new GnomeSession.SessionManager();

        const icon = new Gio.ThemedIcon({ name: 'system-shutdown-symbolic' });
        this.setIcon(icon, Panel.PANEL_ICON_SIZE);

        this.add_style_class_name('power-button');
    }

    vfunc_event(event) {
        if (this.menu &&
            (event.type() == Clutter.EventType.TOUCH_BEGIN ||
             event.type() == Clutter.EventType.BUTTON_PRESS)) {
            this._session.ShutdownRemote(0);
        }

        return Clutter.EVENT_PROPAGATE;
    }
});
