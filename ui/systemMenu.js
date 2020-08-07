// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported SystemMenu */
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

const { Clutter, GObject, St } = imports.gi;

const Config = imports.misc.config;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const AutomaticUpdates = PanelExtension.imports.ui.automaticUpdates;
const Power = PanelExtension.imports.ui.power;

var SystemMenu = GObject.registerClass(
class SystemMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, C_("System menu", "System"), false);
        this.menu.actor.add_style_class_name('aggregate-menu');

        let menuLayout = new Panel.AggregateLayout();
        this.menu.box.set_layout_manager(menuLayout);

        this._indicators = new St.BoxLayout({
            style_class: 'panel-status-indicators-box',
            y_align: Clutter.ActorAlign.CENTER,
        });

        this.add_child(this._indicators);

        if (Config.HAVE_NETWORKMANAGER)
            this._network = new imports.ui.status.network.NMApplet();
        else
            this._network = null;

        if (Config.HAVE_BLUETOOTH)
            this._bluetooth = new imports.ui.status.bluetooth.Indicator();
        else
            this._bluetooth = null;

        this._remoteAccess = new imports.ui.status.remoteAccess.RemoteAccessApplet();
        this._power = new Power.Indicator();
        this._rfkill = new imports.ui.status.rfkill.Indicator();
        this._volume = new imports.ui.status.volume.Indicator();
        this._brightness = new imports.ui.status.brightness.Indicator();
        this._nightLight = new imports.ui.status.nightLight.Indicator();
        this._automaticUpdates = new AutomaticUpdates.Indicator();
        this._thunderbolt = new imports.ui.status.thunderbolt.Indicator();

        this._indicators.add_child(this._thunderbolt);
        this._indicators.add_child(this._nightLight);
        this._indicators.add_child(this._automaticUpdates);
        if (this._network)
            this._indicators.add_child(this._network);
        if (this._bluetooth)
            this._indicators.add_child(this._bluetooth);
        this._indicators.add_child(this._remoteAccess);
        this._indicators.add_child(this._rfkill);
        this._indicators.add_child(this._volume);
        this._indicators.add_child(this._brightness);
        this._indicators.add_child(this._power);
        this._arrowIcon = PopupMenu.arrowIcon(St.Side.BOTTOM);
        this._indicators.add_child(this._arrowIcon);

        if (this._network)
            this.menu.addMenuItem(this._network.menu);

        this.menu.addMenuItem(this._automaticUpdates.menu);

        if (this._bluetooth)
            this.menu.addMenuItem(this._bluetooth.menu);

        this.menu.addMenuItem(this._remoteAccess.menu);
        this.menu.addMenuItem(this._rfkill.menu);
        this.menu.addMenuItem(this._power.menu);
        this.menu.addMenuItem(this._nightLight.menu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this.menu.addMenuItem(this._volume.menu);
        this.menu.addMenuItem(this._brightness.menu);

        menuLayout.addSizeChild(this._rfkill.menu.actor);
        menuLayout.addSizeChild(this._power.menu.actor);

        this._sessionModeUpdatedId = Main.sessionMode.connect('updated',
            this._sessionUpdated.bind(this));
        this._sessionUpdated();
    }

    _sessionUpdated() {
        // Update volume state when session is updated
        this._volume._volumeMenu._onControlStateChanged();

        let userMode = Main.sessionMode.hasOverview;
        if (userMode)
            this._indicators.add_style_class_name('user-mode-indicators-box');
        else
            this._indicators.remove_style_class_name('user-mode-indicators-box');
        this._arrowIcon.visible = !userMode;
    }

    _onDestroy() {
        super._onDestroy();

        if (this._sessionModeUpdatedId) {
            Main.sessionMode.disconnect(this._sessionModeUpdatedId);
            this._sessionModeUpdatedId = 0;
        }
    }
});
