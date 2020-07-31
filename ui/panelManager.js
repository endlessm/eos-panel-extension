// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported PanelManager */
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

const { GObject } = imports.gi;

var PanelManager = GObject.registerClass(
class PanelManager extends GObject.Object {
    _init() {
        super._init();

        this.enabled = false;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }
});
