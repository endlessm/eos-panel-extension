// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported enable, disable */
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

const { St } = imports.gi;

const BoxPointer = imports.ui.boxpointer;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();
const Utils = PanelExtension.imports.utils;

function enable() {
    Utils.override(BoxPointer.BoxPointer, '_calculateArrowSide', function(arrowSide) {
        const sourceTopLeft = this._sourceExtents.get_top_left();
        const sourceBottomRight = this._sourceExtents.get_bottom_right();
        const [boxWidth, boxHeight] = this.get_preferred_size();
        const workarea = this._workArea;

        switch (arrowSide) {
        case St.Side.TOP:
            if (sourceBottomRight.y + boxHeight > workarea.y + workarea.height &&
                boxHeight < sourceTopLeft.y - workarea.y)
                return St.Side.BOTTOM;
            break;
        case St.Side.BOTTOM:
            if (sourceTopLeft.y - boxHeight < workarea.y &&
                boxHeight < workarea.y + workarea.height - sourceBottomRight.y)
                return St.Side.TOP;
            break;
        case St.Side.LEFT:
            if (sourceBottomRight.x + boxWidth > workarea.x + workarea.width &&
                boxWidth < sourceTopLeft.x - workarea.x)
                return St.Side.RIGHT;
            break;
        case St.Side.RIGHT:
            if (sourceTopLeft.x - boxWidth < workarea.x &&
                boxWidth < workarea.x + workarea.width - sourceBottomRight.x)
                return St.Side.LEFT;
            break;
        }

        return arrowSide;
    });
}

function disable() {
    Utils.restore(BoxPointer.BoxPointer);
}
