// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported RemoteAccessIndicator */
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

const { GObject, Meta } = imports.gi;

const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

/* HACK: The upstream impl hides the indicator on non wayland sessions
 * and given we enable X11 on Endless OS atm let's enable it
 * here. The original code was copied from gnome-shell 3.38 (i.e. RemoteAccessApplet)
 * and we create a new class instead of specializing the upstream one
 * to avoid some hacks that would be needed to handle object
 * destruction properly.
 */
var RemoteAccessIndicator = GObject.registerClass(
class RemoteAccessIndicator extends PanelMenu.SystemIndicator {
    _init() {
        super._init();

        let controller = global.backend.get_remote_access_controller();

        if (!controller)
            return;

        this._handles = new Set();
        this._sharedIndicator = null;
        this._recordingIndicator = null;

        this._controllerNewHandleId = controller.connect('new-handle', (o, handle) => {
            this._onNewHandle(handle);
        });

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        if (this._controllerNewHandleId) {
            let controller = global.backend.get_remote_access_controller();
            if (controller)
                controller.disconnect(this._controllerNewHandleId);
            this._controllerNewHandleId = 0;
        }

        this._handles.forEach((handle, handleStoppedId) => {
            handle.disconnect(handleStoppedId);
        });
        this._handles.clear();
    }

    _ensureControls() {
        if (this._sharedIndicator && this._recordingIndicator)
            return;

        this._sharedIndicator = this._addIndicator();
        this._sharedIndicator.icon_name = 'screen-shared-symbolic';
        this._sharedIndicator.add_style_class_name('remote-access-indicator');

        this._sharedItem =
            new PopupMenu.PopupSubMenuMenuItem(_("Screen is Being Shared"),
                                               true);
        this._sharedItem.menu.addAction(_("Turn off"),
            () => {
                for (let handle of this._handles) {
                    if (!handle.is_recording)
                        handle.stop();
                }
            });
        this._sharedItem.icon.icon_name = 'screen-shared-symbolic';
        this.menu.addMenuItem(this._sharedItem);

        this._recordingIndicator = this._addIndicator();
        this._recordingIndicator.icon_name = 'media-record-symbolic';
        this._recordingIndicator.add_style_class_name('screencast-indicator');
    }

    _isScreenShared() {
        return [...this._handles].some(handle => !handle.is_recording);
    }

    _isRecording() {
        return [...this._handles].some(handle => handle.is_recording);
    }

    _sync() {
        if (this._isScreenShared()) {
            this._sharedIndicator.visible = true;
            this._sharedItem.visible = true;
        } else {
            this._sharedIndicator.visible = false;
            this._sharedItem.visible = false;
        }

        this._recordingIndicator.visible = this._isRecording();
    }

    _onStopped(handle) {
        this._handles.delete(handle);
        this._sync();
    }

    _onNewHandle(handle) {
        const handleStoppedId = handle.connect('stopped', this._onStopped.bind(this));
        this._handles.add(handle, handleStoppedId);

        this._ensureControls();
        this._sync();
    }
});
