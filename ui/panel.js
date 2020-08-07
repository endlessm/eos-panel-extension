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
const AppIconBar = PanelExtension.imports.ui.appIconBar;
const EndlessButton = PanelExtension.imports.ui.endlessButton;
const HotCorner = PanelExtension.imports.ui.hotCorner;
const PowerButton = PanelExtension.imports.ui.powerButton;
const SystemMenu = PanelExtension.imports.ui.systemMenu;
const UserMenu = PanelExtension.imports.ui.userMenu;
const Utils = PanelExtension.imports.utils;

const EXTRA_PANEL_ITEM_IMPLEMENTATIONS = {
    'appIconBar': AppIconBar.AppIconBar,
    'endlessButton': EndlessButton.EndlessButton,
    'hotCorner': HotCorner.HotCorner,
    'powerButton': PowerButton.PowerButton,
    'systemMenu': SystemMenu.SystemMenu,
    'userMenu': UserMenu.UserMenu,
};

const _panelModes = {
    'user': {
        panel: {
            left: ['endlessButton', 'appIconBar'],
            center: [],
            right: ['dwellClick', 'a11y', 'keyboard', 'systemMenu',
                    'dateMenu', 'userMenu', 'hotCorner'],
        },
    },
    'unlock-dialog': {
        panel: {
            left: [],
            center: [],
            right: ['dwellClick', 'a11y', 'keyboard', 'systemMenu'],
        },
    },
    'gdm': {
        panel: {
            left: [],
            center: [],
            right: ['dwellClick', 'a11y', 'keyboard', 'systemMenu',
                    'powerButton'],
        },
    },
};

let _extraIndicators = [];
let _sessionModeUpdatedId = 0;

function _getPanelForSessionMode(sessionMode) {
    let panel = sessionMode.panel;
    let panelStyle = sessionMode.panelStyle;

    const currentMode = sessionMode.currentMode;
    const parentMode = sessionMode.parentMode;
    const panelMode = _panelModes[currentMode] ?
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
        const [panel, panelStyle] = _getPanelForSessionMode(Main.sessionMode);

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

        for (const role in EXTRA_PANEL_ITEM_IMPLEMENTATIONS) {
            const indicator = this.statusArea[role];
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

        const constructor = EXTRA_PANEL_ITEM_IMPLEMENTATIONS[role];
        if (!constructor)
            return null;

        indicator = new constructor(this);
        this.statusArea[role] = indicator;
        const destroyId = indicator.connect('destroy', emitter => {
            const index = _extraIndicators.indexOf(indicator);
            if (index > -1)
                _extraIndicators.splice(index, 1);
            emitter.disconnect(destroyId);
        });
        _extraIndicators.push([indicator, destroyId]);

        return indicator;
    });

    const panel = Main.panel;
    // workaround to make sure the overriden Panel._updatePanel is
    // invoked when the session mode is updated. The original signal
    // connection uses 'bind' which circumvents the override mechanism here
    _sessionModeUpdatedId = Main.sessionMode.connect('updated',
        () => panel._updatePanel());
    panel._updatePanel();
}

function disable() {
    // Hide all indicators before restoring the original method to make sure
    // our custom indicators are hidden when the extension is disabled.
    // We can't rely on '_extraIndicators' because it may be empty in case we
    // are re-enabling the extension now that we don't destroy the indicators
    // when disabling anymore - this can be removed if/once the issue
    // destroying indicators is fixed (see below)
    Main.panel._hideIndicators();

    Utils.restore(Panel.Panel);

    for (var i = _extraIndicators.length - 1; i >= 0; i--) {
        const [indicator, destroyId] = _extraIndicators[i];
        indicator.disconnect(destroyId);
        // FIXME: Let's not destroy the indicators due to some lifecycle
        //        issues on upstream indicators used by our custom ones.
        //        See https://phabricator.endlessm.com/T30625.
        // indicator.destroy();
    }
    _extraIndicators = [];

    if (_sessionModeUpdatedId) {
        Main.sessionMode.disconnect(_sessionModeUpdatedId);
        _sessionModeUpdatedId = 0;
    }

    Main.panel._updatePanel();
}
