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

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();

const AppFavoritesWrapper = PanelExtension.imports.ui.appFavorites;
const BoxPointer = PanelExtension.imports.ui.boxpointer;
const LayoutManagerWrapper = PanelExtension.imports.ui.layout;
const PanelWrapper = PanelExtension.imports.ui.panel;
const OverviewWrapper = PanelExtension.imports.ui.overview;
const WorkspaceMonitor = PanelExtension.imports.ui.workspaceMonitor;

var PanelManager = GObject.registerClass(
class PanelManager extends GObject.Object {
    _init() {
        super._init();

        this.enabled = false;
    }

    enable() {
        if (this.enabled)
            return;

        BoxPointer.enable();
        WorkspaceMonitor.enable();
        OverviewWrapper.enable();
        PanelWrapper.enable();
        LayoutManagerWrapper.enable();
        AppFavoritesWrapper.enable();

        this.enabled = true;
    }

    disable() {
        if (!this.enabled)
            return;

        BoxPointer.disable();
        WorkspaceMonitor.disable();
        OverviewWrapper.disable();
        PanelWrapper.disable();
        LayoutManagerWrapper.disable();
        AppFavoritesWrapper.disable();

        this.enabled = false;
    }
});
