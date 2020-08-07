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

const { Meta } = imports.gi;

const Main = imports.ui.main;
const Layout = imports.ui.layout;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();
const Utils = PanelExtension.imports.utils;

function enable() {
    Utils.override(Layout.LayoutManager, '_updatePanelBarrier', function() {
        if (this._rightPanelBarrier) {
            this._rightPanelBarrier.destroy()
            this._rightPanelBarrier = null;
        }

        let monitor = this.primaryMonitor;
        if (!monitor)
            return;

        if (!this.panelBox.height)
            return;

        this._rightPanelBarrier = new Meta.Barrier({
            display: global.display,
            x1: monitor.x + monitor.width,
            x2: monitor.x + monitor.width,
            y1: monitor.y + monitor.height - this.panelBox.height,
            y2: monitor.y + monitor.height,
            directions: Meta.BarrierDirection.NEGATIVE_Y
        });
    });

    Utils.override(Layout.LayoutManager, '_updateBoxes', function() {
        const original = Utils.original(Layout.LayoutManager, '_updateBoxes');
        original.bind(this)();

        let monitor = this.primaryMonitor;
        if (!monitor)
            return;

        this.panelBox.set_position(monitor.x,
            monitor.y + monitor.height - this.panelBox.height);
    });

    let layoutManager = Main.layoutManager;
    layoutManager._updateBoxes();
    layoutManager._updatePanelBarrier();
}

function disable() {
    Utils.restore(Layout.LayoutManager);

    let layoutManager = Main.layoutManager;
    layoutManager._updateBoxes();
    layoutManager._updatePanelBarrier();
}
