// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported EndlessButton */
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

const { Clutter, Gio, GObject, St } = imports.gi;

const Main = imports.ui.main;
const ViewSelector = imports.ui.viewSelector;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const OverviewWrapper = PanelExtension.imports.ui.overview;
const SingleIconButton = PanelExtension.imports.ui.panelMenu.SingleIconButton;
const _ = PanelExtension.imports.utils.gettext;

var EndlessButton = GObject.registerClass(
class EndlessButton extends SingleIconButton {
    _init() {
        super._init(_('Endless Button'));
        this.add_style_class_name('endless-button');
        this.connect('style-changed', () => {
            this.width = this.get_theme_node().get_length('width');
            this.height = this.get_theme_node().get_length('height');
        });
        this.connect('notify::hover', this._onHoverChanged.bind(this));
        this.connect('button-press-event', this._onButtonPressEvent.bind(this));
        this.connect('button-release-event', this._onButtonReleaseEvent.bind(this));

        const file = Gio.File.new_for_uri(
            `file://${PanelExtension.path}/data/icons/endless-button-symbolic.svg`);
        this.setIcon(new Gio.FileIcon({ file }));

        this._setupTooltipText();
    }

    _setupTooltipText() {
        this._label = new St.Label({ style_class: 'app-icon-hover-label' });

        this._labelOffsetX = 0;
        this._labelOffsetY = 0;
        this._label.connect('style-changed', () => {
            this._labelOffsetX = this._label.get_theme_node().get_length('-label-offset-x');
            this._labelOffsetY = this._label.get_theme_node().get_length('-label-offset-y');
        });

        const pageChangedId = Main.overview.connect('page-changed', this._onOverviewPageChanged.bind(this));
        const showingId = Main.overview.connect('showing', this._onOverviewShowing.bind(this));
        const hidingId = Main.overview.connect('hiding', this._onOverviewHiding.bind(this));

        this.connect('destroy', () => {
            this._label.destroy();
            Main.overview.disconnect(pageChangedId);
            Main.overview.disconnect(showingId);
            Main.overview.disconnect(hidingId);
        });

        this._setHoverLabelText(true);
    }

    _updateHoverLabel(hiding) {
        const viewSelector = Main.overview.viewSelector;
        const showingDesktop =
            hiding ||
            !viewSelector ||
            viewSelector.getActivePage() !== ViewSelector.ViewPage.APPS;

        this._setHoverLabelText(showingDesktop);
    }

    _setHoverLabelText(desktop) {
        if (desktop)
            this._label.text = _('Show Desktop');
        else
            this._label.text = _('Show Apps');
    }

    _onOverviewPageChanged() {
        this._updateHoverLabel(false);
    }

    _onOverviewShowing() {
        this._updateHoverLabel(false);
    }

    _onOverviewHiding() {
        this._updateHoverLabel(true);
    }

    vfunc_event(event) {
        if (this.menu &&
            (event.type() === Clutter.EventType.TOUCH_BEGIN ||
             event.type() === Clutter.EventType.BUTTON_PRESS))
            OverviewWrapper.toggleApps(Main.overview);

        return Clutter.EVENT_PROPAGATE;
    }

    _onHoverChanged() {
        if (!this._label)
            return;

        if (this.hover) {
            if (this._label.get_parent())
                return;

            Main.uiGroup.add_actor(this._label);
            Main.uiGroup.set_child_above_sibling(this._label, null);

            // Update the tooltip position
            const monitor = Main.layoutManager.findMonitorForActor(this._label);
            const iconMidpoint = this.get_transformed_position()[0] + this.width / 2;
            this._label.translation_x = Math.floor(iconMidpoint - this._label.width / 2) + this._labelOffsetX;
            this._label.translation_y = Math.floor(this.get_transformed_position()[1] - this._labelOffsetY);

            // Clip left edge to be the left edge of the screen
            this._label.translation_x = Math.max(this._label.translation_x, monitor.x + this._labelOffsetX);
        } else if (this._label.get_parent()) {
            // Remove the tooltip from uiGroup
            Main.uiGroup.remove_actor(this._label);
        }
    }

    _onButtonPressEvent() {
        // This is the CSS active state
        this.add_style_pseudo_class('clicked');
        return Clutter.EVENT_PROPAGATE;
    }

    _onButtonReleaseEvent() {
        this.remove_style_pseudo_class('clicked');
        return Clutter.EVENT_PROPAGATE;
    }
});
