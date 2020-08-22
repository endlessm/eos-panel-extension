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

const { Clutter, Gio, Meta } = imports.gi;

const Main = imports.ui.main;
const Layout = imports.ui.layout;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const HotCorner = PanelExtension.imports.ui.hotCorner;
const Settings = ExtensionUtils.getSettings();
const Utils = PanelExtension.imports.utils;

let _enableHotCornersChangedId = 0;
let _hotCornerOnRightChangedId = 0;
let _hotCornerOnBottomChangedId = 0;
let _hotCornerSizeChangedId = 0;

function enable() {
    Utils.override(Layout.LayoutManager, '_updatePanelBarrier', function() {
        if (this._rightPanelBarrier) {
            this._rightPanelBarrier.destroy()
            this._rightPanelBarrier = null;
        }

        const monitor = this.primaryMonitor;
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

        const monitor = this.primaryMonitor;
        if (!monitor)
            return;

        this.panelBox.set_position(monitor.x,
            monitor.y + monitor.height - this.panelBox.height);
    });

    Utils.override(Layout.LayoutManager, '_updateHotCorners', function() {
        // destroy old hot corners
        this.hotCorners.forEach(corner => {
            if (corner)
                corner.destroy();
        });
        this.hotCorners = [];

        if (!this._interfaceSettings.get_boolean('enable-hot-corners')) {
            this.emit('hot-corners-changed');
            return;
        }

        const size = this.panelBox.height;

        const cornerRightSetting = Settings.get_boolean(HotCorner.HOT_CORNER_ON_RIGHT_KEY);
        const textDirection = Clutter.get_default_text_direction();
        const hotCornerOnRight =
            (cornerRightSetting && textDirection == Clutter.TextDirection.LTR) ||
            (!cornerRightSetting && textDirection == Clutter.TextDirection.RTL);
        const hotCornerOnBottom = Settings.get_boolean(HotCorner.HOT_CORNER_ON_BOTTOM_KEY);

        // build new hot corners
        for (let i = 0; i < this.monitors.length; i++) {
            const monitor = this.monitors[i];
            let cornerX = monitor.x;
            let cornerY = monitor.y;
            if (hotCornerOnRight)
                cornerX += monitor.width;

            if (hotCornerOnBottom)
                cornerY += monitor.height;

            let haveHotCorner = true;

            if (i != this.primaryIndex) {
                // check if we have the specified corner.
                // I.e. if there is no monitor directly above/below
                // or beside (to the left/right)
                const besideX =
                    hotCornerOnRight ? cornerX + 1 : cornerX - 1;
                const besideY = cornerY;
                const aboveOrBelowX = cornerX;
                const aboveOrBelowY =
                    hotCornerOnBottom ? cornerY + 1 : cornerY - 1;

                // iterate through all other monitors, and see if any of them
                // contain the point that is one pixel diagonally further
                // outside the corner point of interest
                for (let j = 0; j < this.monitors.length; j++) {
                    if (i == j)
                        continue;
                    const otherMonitor = this.monitors[j];
                    if (besideX >= otherMonitor.x &&
                        besideX < otherMonitor.x + otherMonitor.width &&
                        besideY >= otherMonitor.y &&
                        besideY < otherMonitor.y + otherMonitor.height) {
                        haveHotCorner = false;
                        break;
                    }
                    if (aboveOrBelowX >= otherMonitor.x &&
                        aboveOrBelowX < otherMonitor.x + otherMonitor.width &&
                        aboveOrBelowY >= otherMonitor.y &&
                        aboveOrBelowY < otherMonitor.y + otherMonitor.height) {
                        haveHotCorner = false;
                        break;
                    }
                }
            }

            if (haveHotCorner) {
                const corner = new HotCorner.HotCorner(this, monitor,
                    cornerX, cornerY);
                corner.setBarrierSize(size);
                this.hotCorners.push(corner);
            } else {
                this.hotCorners.push(null);
            }
        }

        this.emit('hot-corners-changed');
    });

    const layoutManager = Main.layoutManager;

    const desktopInterfaceSettings = new Gio.Settings({
        schema_id: 'org.gnome.desktop.interface',
    });
    // workaround to make sure the overriden LayoutManager._updateHotCorners is
    // invoked when the desktop settings change. The original signal
    // connection uses 'bind' which circumvents the override mechanism here
    _enableHotCornersChangedId = desktopInterfaceSettings.connect('changed::enable-hot-corners',
        () => layoutManager._updateHotCorners());

    _hotCornerOnRightChangedId = Settings.connect('changed::' + HotCorner.HOT_CORNER_ON_RIGHT_KEY,
        () => layoutManager._updateHotCorners());
    _hotCornerOnBottomChangedId = Settings.connect('changed::' + HotCorner.HOT_CORNER_ON_BOTTOM_KEY,
        () => layoutManager._updateHotCorners());
    _hotCornerSizeChangedId = Settings.connect('changed::' + HotCorner.HOT_CORNER_SIZE_KEY,
        () => layoutManager._updateHotCorners());

    layoutManager._updateBoxes();
    layoutManager._updatePanelBarrier();
    layoutManager._updateHotCorners();
}

function disable() {
    Utils.restore(Layout.LayoutManager);

    if (_enableHotCornersChangedId) {
        const desktopInterfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });
        const layoutManager = Main.layoutManager;
        desktopInterfaceSettings.disconnect(_enableHotCornersChangedId);
        _enableHotCornersChangedId = 0;
    }
    if (_hotCornerOnRightChangedId) {
        Settings.disconnect(_hotCornerOnRightChangedId);
        _hotCornerOnRightChangedId = 0;
    }
    if (_hotCornerOnBottomChangedId) {
        Settings.disconnect(_hotCornerOnBottomChangedId);
        _hotCornerOnBottomChangedId = 0;
    }
    if (_hotCornerSizeChangedId) {
        Settings.disconnect(_hotCornerSizeChangedId);
        _hotCornerSizeChangedId = 0;
    }

    const layoutManager = Main.layoutManager;
    layoutManager._updateBoxes();
    layoutManager._updatePanelBarrier();
    layoutManager._updateHotCorners();
}
