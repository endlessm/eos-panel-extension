// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported enable, disable, toggleApps, toggleWindows */
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

const { Clutter, GLib, GObject, Meta, Pango, St } = imports.gi;

const Main = imports.ui.main;
const ViewSelector = imports.ui.viewSelector;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();
const WorkspaceMonitor = PanelExtension.imports.ui.workspaceMonitor;

function pageFromViewPage(viewSelector, viewPage) {
    let page;

    if (viewPage === ViewSelector.ViewPage.WINDOWS)
        page = viewSelector._workspacesPage;
    else
        page = viewSelector._appsPage;

    return page;
}

function _setActivePage(overview, page) {
    overview.viewSelector._showPage(pageFromViewPage(overview.viewSelector, page));
}

function _showOrSwitchPage(overview, page) {
    if (!overview.visible)
        overview.show();
    _setActivePage(overview, page);
}

function _showApps(overview) {
    if (overview.isDummy)
        return;

    _showOrSwitchPage(overview, ViewSelector.ViewPage.APPS);
}

function _showWindows(overview) {
    if (overview.isDummy)
        return;

    _showOrSwitchPage(overview, ViewSelector.ViewPage.WINDOWS);
}

function toggleApps(overview) {
    if (overview.isDummy)
        return;

    if (!overview.visible ||
        overview.viewSelector.getActivePage() !== ViewSelector.ViewPage.APPS) {
        _showApps(overview);
        return;
    }

    if (!WorkspaceMonitor.hasVisibleWindows()) {
        let appSystem = Shell.AppSystem.get_default();
        let runningApps = appSystem.get_running();
        if (runningApps.length > 0)
            runningApps[0].activate();
    }

    // Toggle to the currently open window
    overview.hide();
}

function toggleWindows(overview) {
    if (overview.isDummy)
        return;

    if (!overview.visible) {
        _showWindows(overview);
        return;
    }

    if (overview.viewSelector.getActivePage() !== ViewSelector.ViewPage.WINDOWS) {
        _showWindows(overview);
        return;
    }

    if (!WorkspaceMonitor.hasVisibleWindows()) {
        _showApps(overview);
        return;
    }

    // Toggle to the currently open window
    overview.hide();
}

function enable() {
}

function disable() {
}
