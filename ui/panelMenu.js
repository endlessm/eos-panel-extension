// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported SingleIconButton */
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

const { GObject, St } = imports.gi;

const PanelMenu = imports.ui.panelMenu;

/* SingleIconButton:
 *
 * This class simplifies the process of creating an independent button
 * with a single icon and a popup menu associated to it.
 */
var SingleIconButton = GObject.registerClass(
class SingleIconButton extends PanelMenu.Button {
    _init(nameText, xAlign, yAlign) {
        super._init(0.0, nameText);

        this._mainIcon = new St.Icon({ style_class: 'single-icon-button' });

        if (xAlign)
            this._mainIcon.x_align = xAlign;

        if (yAlign)
            this._mainIcon.y_align = yAlign;

        this.add_actor(this._mainIcon);
    }

    setIcon(icon, size) {
        this._mainIcon.gicon = icon;
        if (size)
            this._mainIcon.set_icon_size(size);
    }
});
