// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported UserMenu */
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

const { AccountsService, Atk, Clutter, GLib, Gio, GObject, Pango, Shell, St } = imports.gi;

const BoxPointer = imports.ui.boxpointer;
const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const UserWidget = imports.ui.userWidget;

const ExtensionUtils = imports.misc.extensionUtils;
const PanelExtension = ExtensionUtils.getCurrentExtension();
const _ = PanelExtension.imports.utils.gettext;

const USER_ICON_SIZE = 34;

const SETTINGS_TEXT = _('Settings');
const SETTINGS_LAUNCHER = 'gnome-control-center.desktop';

const USER_ACCOUNTS_PANEL_LAUNCHER = 'gnome-user-accounts-panel.desktop';

const ONLINE_ACCOUNTS_TEXT = _('Social Accounts');
const ONLINE_ACCOUNTS_PANEL_LAUNCHER = 'gnome-online-accounts-panel.desktop';

const FEEDBACK_TEXT = _('Give Us Feedback');
const FEEDBACK_LAUNCHER = "eos-link-feedback.desktop";

const HELP_CENTER_TEXT = _('Help');
const HELP_CENTER_LAUNCHER = 'org.gnome.Yelp.desktop';
const HELP_CENTER_LAUNCHER_ALT = 'yelp.desktop';

const UserAccountSection = class extends PopupMenu.PopupMenuSection {
    constructor(user) {
        super();

        // User account's icon
        this._userIconItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        this._userIconItem.set({
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
        });

        this._user = user;
        this._avatar = new UserWidget.Avatar(this._user, {
            reactive: true,
            styleClass: 'user-menu-avatar',
        });
        this._avatar.x_align = Clutter.ActorAlign.CENTER;

        const iconButton = new St.Button({ child: this._avatar });
        this._userIconItem.add_child(iconButton);

        iconButton.connect('clicked', () => {
            if (Main.sessionMode.allowSettings)
                this._userIconItem.activate(null);
        });

        this._userIconItem.connect('notify::sensitive', () => {
            this._avatar.setSensitive(this._userIconItem.getSensitive);
        });
        this.addMenuItem(this._userIconItem);

        // User account's name
        this._userLabelItem = new PopupMenu.PopupBaseMenuItem({
            reactive: false,
            can_focus: false,
        });
        this._label = new St.Label({ style_class: 'user-menu-name' });
        this._label.clutter_text.set({
            x_align: Clutter.ActorAlign.CENTER,
            x_expand: true,
            ellipsize: Pango.EllipsizeMode.NONE,
            line_wrap: true,
        });
        this._userLabelItem.add_child(this._label);
        this.addMenuItem(this._userLabelItem);

        // We need to monitor the session to know when to enable the user avatar
        this._sessionModeUpdatedId = Main.sessionMode.connect('updated',
            this._sessionUpdated.bind(this));
        this._sessionUpdated();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        if (this._sessionModeUpdatedId) {
            Main.sessionMode.disconnect(this._sessionModeUpdatedId);
            this._sessionModeUpdatedId = 0;
        }
    }

    _sessionUpdated() {
        this._userIconItem.setSensitive(Main.sessionMode.allowSettings);
    }

    update() {
        this._avatar.update();

        if (this._user.is_loaded)
            this._label.set_text(this._user.get_real_name());
        else
            this._label.set_text('');
    }
};

var UserMenuManager = class {
    constructor() {
        this._userManager = AccountsService.UserManager.get_default();
        this._user = this._userManager.get_user(GLib.get_user_name());

        this._userLoadedId = this._user.connect('notify::is-loaded', this._updateUser.bind(this));
        this._userChangedId = this._user.connect('changed', this._updateUser.bind(this));

        this._createPanelIcon();
        this._createPopupMenu();

        this._updateUser();
    }

    destroy() {
        if (this._userLoadedId) {
            this._user.disconnect(this._userLoadedId);
            this._userLoadedId = 0;
        }
        if (this._userChangedId) {
            this._user.disconnect(this._userChangedId);
            this._userChangedId = 0;
        }
        if (this._activateId) {
            this._accountSection._userIconItem.disconnect(this._activateId);
            this._activateId = 0;
        }
        if (this._sessionModeUpdatedId) {
            Main.sessionMode.disconnect(this._sessionModeUpdatedId);
            this._sessionModeUpdatedId = 0;
        }
    }

    _createPanelIcon() {
        this.panelBox = new St.BoxLayout({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this._panelAvatar = new UserWidget.Avatar(this._user, {
            iconSize: USER_ICON_SIZE,
            styleClass: 'user-menu-button-icon',
            reactive: true,
        });
        this.panelBox.add_actor(this._panelAvatar);
    }

    _createPopupMenu() {
        this.menu = new PopupMenu.PopupMenuSection();

        this._accountSection = new UserAccountSection(this._user);
        this._activateId = this._accountSection._userIconItem.connect('activate', () => {
            this._launchApplication(USER_ACCOUNTS_PANEL_LAUNCHER);
        });

        this.menu.addMenuItem(this._accountSection);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const menuItemsSection = new PopupMenu.PopupMenuSection();
        menuItemsSection.box.style_class = 'user-menu-items';

        // Control Center
        let gicon = new Gio.ThemedIcon({ name: 'applications-system-symbolic' });
        this._settingsItem = menuItemsSection.addAction(SETTINGS_TEXT, () => {
            this._launchApplication(SETTINGS_LAUNCHER);
        }, gicon);

        // Social
        gicon = new Gio.ThemedIcon({ name: 'user-available-symbolic' });
        const onlineAccountsItem = menuItemsSection.addSettingsAction(ONLINE_ACCOUNTS_TEXT,
            ONLINE_ACCOUNTS_PANEL_LAUNCHER);
        // PopupMenuSection.addSettingsAction doesn't support an icon, let's
        // add it manually
        onlineAccountsItem.remove_child(onlineAccountsItem.label);
        onlineAccountsItem.icon = new St.Icon({ style_class: 'popup-menu-icon',
                                                x_align: Clutter.ActorAlign.END });
        onlineAccountsItem.icon.gicon = gicon;
        onlineAccountsItem.add_child(onlineAccountsItem.icon);
        onlineAccountsItem.add_child(onlineAccountsItem.label);

        let app = null;

        // Feedback
        app = Shell.AppSystem.get_default().lookup_app(FEEDBACK_LAUNCHER);
        if (app) {
            const file = Gio.File.new_for_uri(
                `file://${PanelExtension.path}/data/icons/feedback-symbolic.svg`);
            gicon = new Gio.FileIcon({ file });
            menuItemsSection.addAction(FEEDBACK_TEXT, () => {
                this._launchApplication(FEEDBACK_LAUNCHER);
            }, gicon);
        }

        // Help center
        app = Shell.AppSystem.get_default().lookup_app(HELP_CENTER_LAUNCHER) ||
              Shell.AppSystem.get_default().lookup_app(HELP_CENTER_LAUNCHER_ALT);
        if (app) {
            const file = Gio.File.new_for_uri(
                `file://${PanelExtension.path}/data/icons/endless-help-symbolic.svg`);
            gicon = new Gio.FileIcon({ file });
            menuItemsSection.addAction(HELP_CENTER_TEXT, () => {
                this._launchApplication(app.get_id());
            }, gicon);
        }

        this.menu.addMenuItem(menuItemsSection);

        // We need to monitor the session to know when to show/hide the settings item
        this._sessionModeUpdatedId = Main.sessionMode.connect('updated',
            this._sessionUpdated.bind(this));
        this._sessionUpdated();
    }

    _launchApplication(launcherName) {
        this.menu.close(BoxPointer.PopupAnimation.NONE);
        Main.overview.hide();

        const app = Shell.AppSystem.get_default().lookup_app(launcherName);
        app.activate_full(-1, global.get_current_time());
    }

    _updateUser() {
        this._panelAvatar.update();
        this._accountSection.update();
    }

    _sessionUpdated() {
        this._settingsItem.visible = Main.sessionMode.allowSettings;
    }
};

var UserMenu = GObject.registerClass(
class UserMenu extends PanelMenu.Button {
    _init() {
        super._init(0.0, C_("User menu", "User Menu"), false);

        this.accessible_role = Atk.Role.MENU;

        const menuLayout = new Panel.AggregateLayout();
        this.menu.box.set_layout_manager(menuLayout);
        this.menu.actor.add_style_class_name('aggregate-menu');

        this._userMenu = new UserMenuManager();
        this.add_child(this._userMenu.panelBox);
        this.menu.addMenuItem(this._userMenu.menu);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        this._systemIndicator = new imports.ui.status.system.Indicator();
        this.menu.addMenuItem(this._systemIndicator.menu);

        menuLayout.addSizeChild(this._systemIndicator.menu.actor);

        // We need to monitor the session to know when to show the button
        this._sessionModeUpdatedId = Main.sessionMode.connect('updated',
            this._sessionUpdated.bind(this));
        this._sessionUpdated();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        if (this._userMenu) {
            this._userMenu.destroy();
            this._userMenu = null;
        }

        if (this._sessionModeUpdatedId) {
            Main.sessionMode.disconnect(this._sessionModeUpdatedId);
            this._sessionModeUpdatedId = 0;
        }
    }

    _sessionUpdated() {
        this.visible = !Main.sessionMode.isGreeter;
        this.setSensitive(!Main.sessionMode.isLocked);
        // Always hide the settings item from system indicator
        // as we already have an item for it
        this._systemIndicator._settingsItem.visible = false;
    }
});
