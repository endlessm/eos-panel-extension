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

const { Clutter } = imports.gi;

const Main = imports.ui.main;
const Panel = imports.ui.panel;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();
const Utils = PanelExtension.imports.utils;

const EXTRA_PANEL_ITEM_IMPLEMENTATIONS = {
};

const _panelModes = {
};

let _extraIndicators = [];
let _sessionModeUpdatedId = 0;

function _getPanelForSessionMode(sessionMode) {
    let panel = sessionMode.panel;
    let panelStyle = sessionMode.panelStyle;

    let currentMode = sessionMode.currentMode;
    let parentMode = sessionMode.parentMode;
    let panelMode = _panelModes[currentMode] ?
        _panelModes[currentMode] :
        (parentMode && _panelModes[parentMode] ?
            _panelModes[parentMode] : null);
    if (panelMode) {
        panel = panelMode.panel;
        if (panelMode.panelStyle)
            panelStyle = panelMode.panelStyle;
    }

    return [panel, panelStyle];
}

function enable() {
    Utils.override(Panel.Panel, '_updatePanel', function() {
        let [panel, panelStyle] = _getPanelForSessionMode(Main.sessionMode);

        this._hideIndicators();
        this._updateBox(panel.left, this._leftBox);
        this._updateBox(panel.center, this._centerBox);
        this._updateBox(panel.right, this._rightBox);

        if (panel.left.includes('dateMenu'))
            Main.messageTray.bannerAlignment = Clutter.ActorAlign.START;
        else if (panel.right.includes('dateMenu'))
            Main.messageTray.bannerAlignment = Clutter.ActorAlign.END;
        else
            Main.messageTray.bannerAlignment = Clutter.ActorAlign.CENTER;

        if (this._sessionStyle)
            this._removeStyleClassName(this._sessionStyle);

        this._sessionStyle = panelStyle;
        if (this._sessionStyle)
            this._addStyleClassName(this._sessionStyle);

        if (this.get_text_direction() == Clutter.TextDirection.RTL) {
            this._leftCorner.setStyleParent(this._rightBox);
            this._rightCorner.setStyleParent(this._leftBox);
        } else {
            this._leftCorner.setStyleParent(this._leftBox);
            this._rightCorner.setStyleParent(this._rightBox);
        }
    });

    Utils.override(Panel.Panel, '_hideIndicators', function() {
        const original = Utils.original(Panel.Panel, '_hideIndicators');

        original.bind(this)();

        for (let role in EXTRA_PANEL_ITEM_IMPLEMENTATIONS) {
            let indicator = this.statusArea[role];
            if (!indicator)
                continue;
            indicator.container.hide();
        }
    });

    Utils.override(Panel.Panel, '_ensureIndicator', function(role) {
        const original = Utils.original(Panel.Panel, '_ensureIndicator');

        let indicator = original.bind(this)(role);
        if (indicator)
            return indicator;

        let constructor = EXTRA_PANEL_ITEM_IMPLEMENTATIONS[role];
        if (!constructor)
            return null;

        indicator = new constructor(this);
        this.statusArea[role] = indicator;
        _extraIndicators.push(indicator);

        let destroyId = indicator.connect('destroy', emitter => {
            let index = _extraIndicators.indexOf(indicator);
            if (index > -1)
                _extraIndicators.splice(index, 1);
            emitter.disconnect(destroyId);
        });

        return indicator;
    });

    let panel = Main.panel;
    // workaround to make sure the overriden Panel._updatePanel is
    // invoked when the session mode is updated. The original signal
    // connection uses 'bind' which circumvents the override mechanism here
    _sessionModeUpdatedId = Main.sessionMode.connect('updated',
        () => panel._updatePanel());
    panel._updatePanel();
}

function disable() {
    Utils.restore(Panel.Panel);

    for (var i = _extraIndicators.length - 1; i >= 0; i--) {
        let indicator = _extraIndicators[i];
        indicator.destroy();
    }
    _extraIndicators = [];

    if (_sessionModeUpdatedId) {
        Main.sessionMode.disconnect(_sessionModeUpdatedId);
        _sessionModeUpdatedId = 0;
    }

    Main.panel._updatePanel();
}
