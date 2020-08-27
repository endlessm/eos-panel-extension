// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported enable, disable, getVisibleApps, hasActiveWindows, hasVisibleWindows */
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

const { Meta, Shell } = imports.gi;

const Main = imports.ui.main;

let _fullscreenChangedId = 0;
let _inFullscreen = false;

function _fullscreenChanged() {
    const primaryMonitor = Main.layoutManager.primaryMonitor;
    _inFullscreen = primaryMonitor && primaryMonitor.inFullscreen;
}

function getVisibleApps() {
    return global.window_group.get_children().filter(child => {
        if (!(child instanceof Meta.WindowActor))
            return false;

        const { metaWindow } = child;
        return !metaWindow.minimized && !metaWindow.get_transient_for();
    });
}

function hasActiveWindows() {
    // Count anything fullscreen as an extra window
    if (_inFullscreen)
        return true;

    const appSystem = Shell.AppSystem.get_default();
    const apps = appSystem.get_running();
    return apps.length > 0;
}

function hasVisibleWindows() {
    // Count anything fullscreen as an extra window
    if (_inFullscreen)
        return true;

    const visibleApps = getVisibleApps();
    return visibleApps.length > 0;
}

function enable() {
    _fullscreenChangedId = global.display.connect('in-fullscreen-changed',
        _fullscreenChanged);
    _fullscreenChanged();
}

function disable() {
    _inFullscreen = false;

    if (_fullscreenChangedId) {
        global.display.disconnect(_fullscreenChangedId);
        _fullscreenChangedId = 0;
    }
}
