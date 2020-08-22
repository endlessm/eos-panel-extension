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

const { Clutter, Gdk, Gio, GObject, Meta } = imports.gi;

const Main = imports.ui.main;
const Layout = imports.ui.layout;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const OverviewWrapper = PanelExtension.imports.ui.overview;
const Settings = ExtensionUtils.getSettings();
const SingleIconButton = PanelExtension.imports.ui.panelMenu.SingleIconButton;

// GSettings keys to determine the position of the hot corner target.
var HOT_CORNER_ON_RIGHT_KEY = 'hot-corner-on-right';
var HOT_CORNER_ON_BOTTOM_KEY = 'hot-corner-on-bottom';
// GSettings key for the size of the hot corner target.
// When using a VirtualBox VM, may need to set to at least 3 pixels,
// since the VM may "steal" two rows from the guest OS display.
var HOT_CORNER_SIZE_KEY = 'hot-corner-size';

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

        this._interfaceSettings = new Gio.Settings({
            schema_id: 'org.gnome.desktop.interface',
        });

        this._enableMenuItem = this.menu.addAction(_('Enable Hot Corner'), () => {
            this._interfaceSettings.set_boolean('enable-hot-corners', true);
        });

        this._disableMenuItem = this.menu.addAction(_('Disable Hot Corner'), () => {
            this._interfaceSettings.set_boolean('enable-hot-corners', false);
        });

        this._enabledChangedId = this._interfaceSettings.connect(
            'changed::' + 'enable-hot-corners', this._sync.bind(this));
        this.menu.connect('menu-closed', this._sync.bind(this));

        this._sync();
    }

    _onDestroy() {
        super._onDestroy();

        if (this._enabledChangedId) {
            this._interfaceSettings.disconnect(this._enabledChangedId);
            this._enabledChangedId = 0;
        }
    }

    _sync() {
        const isEnabled = this._interfaceSettings.get_boolean('enable-hot-corners');
        this._enableMenuItem.actor.visible = !isEnabled;
        this._disableMenuItem.actor.visible = isEnabled;
    }

    vfunc_event(event) {
        if (event.type() === Clutter.EventType.TOUCH_BEGIN ||
            event.type() === Clutter.EventType.BUTTON_PRESS) {
            const button = event.get_button();
            if (button === Gdk.BUTTON_PRIMARY)
                OverviewWrapper.toggleWindows(Main.overview);
            else if (button === Gdk.BUTTON_SECONDARY)
                this.menu.toggle();
        }

        return Clutter.EVENT_PROPAGATE;
    }
});

var HotCorner = GObject.registerClass(
class HotCorner extends Layout.HotCorner {
    _init(layoutManager, monitor, x, y) {
        this._cornerTargetSize = Settings.get_int(HOT_CORNER_SIZE_KEY);
        const cornerRightSetting = Settings.get_boolean(HOT_CORNER_ON_RIGHT_KEY);
        const textDirection = Clutter.get_default_text_direction();
        this._cornerOnRight = (cornerRightSetting && textDirection == Clutter.TextDirection.LTR) ||
                (!cornerRightSetting && textDirection == Clutter.TextDirection.RTL);
        this._cornerOnBottom = Settings.get_boolean(HOT_CORNER_ON_BOTTOM_KEY);

        super._init(layoutManager, monitor, x, y);

        const ripples = [
            this._ripples._ripple1,
            this._ripples._ripple2,
            this._ripples._ripple3
        ];

        const px = this._cornerOnRight ? 1.0 : 0.0;
        const py = this._cornerOnBottom ? 1.0 : 0.0;

        this._ripples._px = px;
        this._ripples._py = py;
        for (const ripple of ripples)
            ripple.set_pivot_point(px, py);

        // Remove all existing style pseudo-classes
        // (note: top-left is default and does not use a pseudo-class)
        const corners = ['tr', 'bl', 'br'];
        for (const corner of corners) {
            for (const ripple of ripples)
                ripple.remove_style_pseudo_class(corner);
        }

        // Add the style pseudo-class for the selected ripple corner
        let addCorner = null;
        if (this._cornerOnRight) {
            if (this._cornerOnBottom) {
                // Bottom-right corner
                addCorner = 'br';
            } else {
                // Top-right corner
                addCorner = 'tr';
            }
        } else {
            if (this._cornerOnBottom) {
                // Bottom-left corner
                addCorner = 'bl';
            } else {
                // Top-left corner
                // No style pseudo-class to add
            }
        }

        if (addCorner) {
            for (const ripple of ripples) {
                ripple.add_style_pseudo_class(addCorner);
            }
        }
    }

    _toggleOverview() {
        if (this._monitor.inFullscreen && !Main.overview.visible)
            return;

        if (Main.overview.shouldToggleByCornerOrButton()) {
            OverviewWrapper.toggleWindows(Main.overview, true);
            this._ripples.playAnimation(this._x, this._y);
        }
    }

    _setupFallbackCornerIfNeeded(layoutManager) {
        super._setupFallbackCornerIfNeeded(layoutManager);
        if (!this._corner)
            return;

        this._corner.width = this._cornerTargetSize;
        this._corner.height = this._cornerTargetSize;

        if (this._cornerOnRight) {
            if (this._cornerOnBottom) {
                // Bottom-right corner
                this._corner.set_position(this.width - this._corner.width, this.height - this._corner.height);
                this.set_pivot_point(1.0, 1.0);
                this.translation_x = -this.width;
                this.translation_y = -this.height;
            } else {
                // Top-right corner
                this._corner.set_position(this.width - this._corner.width, 0);
                this.set_pivot_point(1.0, 0.0);
                this.translation_x = -this.width;
                this.translation_y = 0;
            }
        } else {
            if (this._cornerOnBottom) {
                // Bottom-left corner
                this._corner.set_position(0, this.height - this._corner.height);
                this.set_pivot_point(0.0, 1.0);
                this.translation_x = 0;
                this.translation_y = -this.height;
            } else {
                // Top-left corner
                this._corner.set_position(0, 0);
                this.set_pivot_point(0.0, 0.0);
                this.translation_x = 0;
                this.translation_y = 0;
            }
        }
    }

    setBarrierSize(size) {
        if (this._verticalBarrier) {
            this._pressureBarrier.removeBarrier(this._verticalBarrier);
            this._verticalBarrier.destroy();
            this._verticalBarrier = null;
        }

        if (this._horizontalBarrier) {
            this._pressureBarrier.removeBarrier(this._horizontalBarrier);
            this._horizontalBarrier.destroy();
            this._horizontalBarrier = null;
        }

        if (size > 0) {
            // The corner itself is at (this._x, this._y).
            // Extend the barrier by size towards the center of the screen.

            let x1, x2, y1, y2;
            let xDir, yDir;

            if (this._cornerOnRight) {
                x1 = this._x - size;
                x2 = this._x;
                xDir = Meta.BarrierDirection.NEGATIVE_X;
            } else {
                x1 = this._x;
                x2 = this._x + size;
                xDir = Meta.BarrierDirection.POSITIVE_X;
            }

            if (this._cornerOnBottom) {
                y1 = this._y - size;
                y2 = this._y;
                yDir = Meta.BarrierDirection.NEGATIVE_Y;
            } else {
                y1 = this._y;
                y2 = this._y + size;
                yDir = Meta.BarrierDirection.POSITIVE_Y;
            }

            this._verticalBarrier = new Meta.Barrier({ display: global.display,
                                                       x1: this._x, x2: this._x, y1: y1, y2: y2,
                                                       directions: xDir });
            this._horizontalBarrier = new Meta.Barrier({ display: global.display,
                                                         x1: x1, x2: x2, y1: this._y, y2: this._y,
                                                         directions: yDir });

            this._pressureBarrier.addBarrier(this._verticalBarrier);
            this._pressureBarrier.addBarrier(this._horizontalBarrier);
        }
    }
});
