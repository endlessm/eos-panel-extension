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
const ModalDialog = imports.ui.modalDialog;
const Overview = imports.ui.overview;
const ViewSelector = imports.ui.viewSelector;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();
const Utils = PanelExtension.imports.utils;
const WorkspaceMonitor = PanelExtension.imports.ui.workspaceMonitor;

const NO_WINDOWS_OPEN_DIALOG_TIMEOUT = 2000; // ms

var NoWindowsDialog = GObject.registerClass(
class NoWindowsDialog extends ModalDialog.ModalDialog {
    _init() {
        super._init({
            styleClass: 'prompt-dialog',
            shellReactive: true,
            destroyOnClose: false,
        });

        this._timeoutId = 0;

        const descriptionLabel = new St.Label({
            style_class: 'prompt-dialog-headline headline',
            text: _('No apps are open'),
            x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
        });
        descriptionLabel.clutter_text.line_wrap = true;
        descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;

        this.contentLayout.add_child(descriptionLabel);

        this.connect('key-press-event', () => {
            this.close(global.get_current_time());
            return Clutter.EVENT_PROPAGATE;
        });
    }

    popup() {
        if (this._timeoutId !== 0)
            GLib.source_remove(this._timeoutId);

        this._timeoutId =
            GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                NO_WINDOWS_OPEN_DIALOG_TIMEOUT,
                () => {
                    this.popdown();
                    return GLib.SOURCE_REMOVE;
                });
        this.open(global.get_current_time());
    }

    popdown() {
        if (this._timeoutId !== 0) {
            GLib.source_remove(this._timeoutId);
            this._timeoutId = 0;
        }
        this.close(global.get_current_time());
    }
});

let _noWindowsDialog = null;

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

function toggleApps(overview, ignoreNoWindowsDialog = false) {
    if (overview.isDummy)
        return;

    if (!overview.visible ||
        overview.viewSelector.getActivePage() !== ViewSelector.ViewPage.APPS) {
        _showApps(overview);
        return;
    }

    if (!ignoreNoWindowsDialog && !WorkspaceMonitor.hasActiveWindows()) {
        _noWindowsDialog.popup();
        return;
    }

    if (!WorkspaceMonitor.hasVisibleWindows()) {
        // There are active windows but all of them are hidden, so activate
        // the most recently used one before hiding the overview.
        const appSystem = Shell.AppSystem.get_default();
        const runningApps = appSystem.get_running();
        if (runningApps.length > 0)
            runningApps[0].activate();
    }

    // Toggle to the currently open window
    overview.hide();
}

function toggleWindows(overview, ignoreNoWindowsDialog = false) {
    if (overview.isDummy)
        return;

    if (!overview.visible) {
        _showWindows(overview);
        return;
    }

    if (!ignoreNoWindowsDialog && !WorkspaceMonitor.hasActiveWindows()) {
        _noWindowsDialog.popup();
        return;
    }

    if (overview.viewSelector.getActivePage() !== ViewSelector.ViewPage.WINDOWS) {
        _showWindows(overview);
        return;
    }

    if (!WorkspaceMonitor.hasVisibleWindows()) {
        // There are active windows but all of them are
        // hidden, so we get back to show the icons grid.
        _showApps(overview);
        return;
    }

    // Toggle to the currently open window
    overview.hide();
}

function enable() {
    _noWindowsDialog = new NoWindowsDialog();

    Utils.override(Overview.Overview, 'hide', function() {
        const original = Utils.original(Overview.Overview, 'hide');
        original.bind(this)();

        if (this.isDummy)
            return;

        if (!this._shown)
            return;

        const event = Clutter.get_current_event();
        if (event) {
            const type = event.type();
            const button = type == Clutter.EventType.BUTTON_PRESS ||
                           type == Clutter.EventType.BUTTON_RELEASE;
            const ctrl = (event.get_state() & Clutter.ModifierType.CONTROL_MASK) != 0;
            if (button && ctrl)
                return;
        }

        _noWindowsDialog.popdown();
    });
}

function disable() {
    Utils.restore(Overview.Overview);

    if (_noWindowsDialog) {
        _noWindowsDialog.destroy();
        _noWindowsDialog = null;
    }
}
