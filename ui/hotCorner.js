// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported HotCorner */
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

const { Clutter, Gdk, Gio, GObject } = imports.gi;

const Main = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const OverviewWrapper = PanelExtension.imports.ui.overview;
const SingleIconButton = PanelExtension.imports.ui.panelMenu.SingleIconButton;

var HotCornerButton = GObject.registerClass(
class HotCornerButton extends SingleIconButton {
    _init() {
        super._init(_('Hot Corner'), Clutter.ActorAlign.END, Clutter.ActorAlign.END);
        this.add_style_class_name('hot-corner');

        let file;
        if (this.get_text_direction() === Clutter.TextDirection.RTL)
            file = Gio.File.new_for_uri(
                `file://${PanelExtension.path}/data/icons/hot-corner-rtl-symbolic.svg`);
        else
            file = Gio.File.new_for_uri(
                `file://${PanelExtension.path}/data/icons/hot-corner-symbolic.svg`);
        this.setIcon(new Gio.FileIcon({ file }));
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.TOUCH_BEGIN ||
            event.type() === Clutter.EventType.BUTTON_PRESS) {
            const button = event.get_button();
            if (button === Gdk.BUTTON_PRIMARY)
                OverviewWrapper.toggleWindows(Main.overview);
        }

        return Clutter.EVENT_PROPAGATE;
    }
});
