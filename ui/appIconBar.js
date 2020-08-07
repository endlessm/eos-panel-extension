// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported AppIconBar */
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

const { Clutter, Gdk, GLib, GObject, Gtk, Meta, Shell, St } = imports.gi;

const AppFavorites = imports.ui.appFavorites;
const BoxPointer = imports.ui.boxpointer;
const Config = imports.misc.config;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

var ParentalControlsManager = null;
if (Config.PACKAGE_VERSION > '3.37.1')
    ParentalControlsManager = imports.misc.parentalControlsManager;

const MAX_OPACITY = 255;

const ICON_SIZE = 24;

const ICON_SCROLL_ANIMATION_TIME = 300;
const ICON_SCROLL_ANIMATION_TYPE = Clutter.AnimationMode.LINEAR;

const ICON_BOUNCE_MAX_SCALE = 0.4;
const ICON_BOUNCE_ANIMATION_TIME = 400;
const ICON_BOUNCE_ANIMATION_TYPE_1 = Clutter.AnimationMode.EASE_OUT_SINE;
const ICON_BOUNCE_ANIMATION_TYPE_2 = Clutter.AnimationMode.EASE_OUT_BOUNCE;

const PANEL_WINDOW_MENU_THUMBNAIL_SIZE = 128;

function _compareByStableSequence(winA, winB) {
    const seqA = winA.get_stable_sequence();
    const seqB = winB.get_stable_sequence();

    return seqA - seqB;
}

const WindowMenuItem = GObject.registerClass(
class WindowMenuItem extends PopupMenu.PopupBaseMenuItem {
    _init(window, params) {
        super._init(params);

        this.window = window;

        this.add_style_class_name('panel-window-menu-item');

        const windowActor = this._findWindowActor();
        const monitor = Main.layoutManager.primaryMonitor;

        // constraint the max size of the clone to the aspect ratio
        // of the primary display, where the panel lives
        const ratio = monitor.width / monitor.height;
        const maxW = ratio > 1
            ? PANEL_WINDOW_MENU_THUMBNAIL_SIZE : PANEL_WINDOW_MENU_THUMBNAIL_SIZE * ratio;
        const maxH = ratio > 1
            ? PANEL_WINDOW_MENU_THUMBNAIL_SIZE / ratio : PANEL_WINDOW_MENU_THUMBNAIL_SIZE;

        const clone = new Clutter.Actor({
            content: windowActor.get_texture(),
            request_mode: Clutter.RequestMode.CONTENT_SIZE,
        });
        const cloneW = clone.width;
        const cloneH = clone.height;

        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const scale = Math.min(maxW / cloneW, maxH / cloneH) * scaleFactor;

        clone.set_size(Math.round(cloneW * scale), Math.round(cloneH * scale));

        this.cloneBin = new St.Bin({
            child: clone,
            style_class: 'panel-window-menu-item-clone',
        });
        this.add(this.cloneBin, { align: St.Align.MIDDLE });

        this.label = new St.Label({
            text: window.title,
            style_class: 'panel-window-menu-item-label',
            y_align: Clutter.ActorAlign.CENTER,
            y_expand: true,
        });

        this.add_child(this.label);
        this.label_actor = this.label;
    }

    _findWindowActor() {
        const actors = global.get_window_actors();
        const windowActors = actors.filter(actor => {
            return actor.meta_window === this.window;
        });

        return windowActors[0];
    }
});

const ScrollMenuItem = GObject.registerClass(
class ScrollMenuItem extends PopupMenu.PopupSubMenuMenuItem {
    _init() {
        super._init('');

        // remove all the stock style classes
        this.remove_style_class_name('popup-submenu-menu-item');
        this.remove_style_class_name('popup-menu-item');

        // remove all the stock actors
        this.remove_all_children();
        this.menu.destroy();

        this.label = null;
        this._triangle = null;

        this.menu = new PopupMenu.PopupSubMenu(this, new St.Label({ text: '' }));
        this.menu.actor.remove_style_class_name('popup-sub-menu');
    }

    _onKeyPressEvent() {
        // no special handling
        return false;
    }

    activate() {
        // override to do nothing
    }

    _onButtonReleaseEvent() {
        // override to do nothing
    }
});

const APP_ICON_MENU_ARROW_XALIGN = 0.5;

const AppIconMenu = class extends PopupMenu.PopupMenu {
    constructor(app, parentActor) {
        super(parentActor, APP_ICON_MENU_ARROW_XALIGN, St.Side.BOTTOM);

        this.actor.add_style_class_name('app-icon-menu');

        this._submenuItem = new ScrollMenuItem();
        this.addMenuItem(this._submenuItem);
        this._submenuItem.menu.connect('activate', this._onActivate.bind(this));

        // We want to popdown the menu when clicked on the source icon itself
        this.shouldSwitchToOnHover = false;

        this._app = app;
    }

    _redisplay() {
        this._submenuItem.menu.removeAll();

        const workspaceManager = global.workspace_manager;
        const activeWorkspace = workspaceManager.get_active_workspace();

        const windows = this._app.get_windows();
        const workspaceWindows = [];
        const otherWindows = [];

        windows.forEach(w => {
            if (w.is_skip_taskbar())
                return;

            if (w.located_on_workspace(activeWorkspace))
                workspaceWindows.push(w);
            else
                otherWindows.push(w);
        });

        workspaceWindows.sort(_compareByStableSequence.bind(this));
        otherWindows.sort(_compareByStableSequence.bind(this));

        const hasWorkspaceWindows = workspaceWindows.length > 0;
        const hasOtherWindows = otherWindows.length > 0;

        // Display windows from other workspaces first, if present, since our panel
        // is at the bottom, and it's much more convenient to just move up the pointer
        // to switch windows in the current workspace
        if (hasOtherWindows)
            this._appendOtherWorkspacesLabel();

        otherWindows.forEach(w => {
            this._appendMenuItem(w, hasOtherWindows);
        });

        if (hasOtherWindows && hasWorkspaceWindows)
            this._appendCurrentWorkspaceSeparator();

        workspaceWindows.forEach(w => {
            this._appendMenuItem(w, hasOtherWindows);
        });
    }

    _appendOtherWorkspacesLabel() {
        const label = new PopupMenu.PopupMenuItem(_('Other workspaces'));
        label.label.add_style_class_name('panel-window-menu-workspace-label');
        this._submenuItem.menu.addMenuItem(label);
    }

    _appendCurrentWorkspaceSeparator() {
        const separator = new PopupMenu.PopupSeparatorMenuItem();
        this._submenuItem.menu.addMenuItem(separator);

        const label = new PopupMenu.PopupMenuItem(_('Current workspace'));
        label.label.add_style_class_name('panel-window-menu-workspace-label');
        this._submenuItem.menu.addMenuItem(label);
    }

    _appendMenuItem(window, hasOtherWindows) {
        const item = new WindowMenuItem(window);
        this._submenuItem.menu.addMenuItem(item);

        if (hasOtherWindows)
            item.cloneBin.add_style_pseudo_class('indented');
    }

    toggle(animation) {
        if (this.isOpen) {
            this.close(animation);
        } else {
            this._redisplay();
            this.open(animation);
            this._submenuItem.menu.open(BoxPointer.PopupAnimation.NONE);
        }
    }

    _onActivate(actor, item) {
        Main.activateWindow(item.window);
        this.close();
    }
};

/** AppIconButton:
 *
 * This class handles the application icon
 */
const AppIconButton = GObject.registerClass({
    Signals: {
        'app-icon-pressed': {},
        'app-icon-pinned': {},
        'app-icon-unpinned': {},
    },
}, class AppIconButton extends St.Button {
    _init(app, iconSize, menuManager, allowsPinning) {
        this._app = app;

        this._iconSize = iconSize;

        super._init({
            style_class: 'app-icon-button',
            child: this._createIcon(),
            button_mask: St.ButtonMask.ONE | St.ButtonMask.THREE,
            reactive: true,
        });

        this._isBouncing = false;
        this._menuManager = menuManager;

        this._label = new St.Label({
            text: this._app.get_name(),
            style_class: 'app-icon-hover-label',
        });
        this._label.connect('style-changed', this._updateStyle.bind(this));

        // Handle the menu-on-press case for multiple windows
        this.connect('button-press-event', this._handleButtonPressEvent.bind(this));
        this.connect('clicked', this._handleClickEvent.bind(this));

        this._startupCompleteId = Main.layoutManager.connect('startup-complete',
            this._updateIconGeometry.bind(this));
        this.connect('notify::allocation', this._updateIconGeometry.bind(this));
        this.connect('enter-event', this._showHoverState.bind(this));
        this.connect('leave-event', this._hideHoverState.bind(this));

        this._rightClickMenuManager = new PopupMenu.PopupMenuManager(this);

        this._rightClickMenu = new PopupMenu.PopupMenu(this, 0.0, St.Side.BOTTOM, 0);
        this._rightClickMenu.blockSourceEvents = true;

        if (allowsPinning) {
            this._pinMenuItem = this._rightClickMenu.addAction(_('Pin to Taskbar'), () => {
                this.emit('app-icon-pinned');
            });

            this._unpinMenuItem = this._rightClickMenu.addAction(_('Unpin from Taskbar'), () => {
                // Unpin from taskbar in idle, so that we can avoid destroying
                // the menu actor before it's closed
                this._unpinIdleId = GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                    this.emit('app-icon-unpinned');
                    return GLib.SOURCE_REMOVE;
                });
            });

            if (AppFavorites.getAppFavorites().isFavorite(this._app.get_id()))
                this._pinMenuItem.actor.visible = false;
            else
                this._unpinMenuItem.actor.visible = false;

            this._rightClickMenu.connect('menu-closed', () => {
                const isPinned = AppFavorites.getAppFavorites().isFavorite(this._app.get_id());
                this._pinMenuItem.actor.visible = !isPinned;
                this._unpinMenuItem.actor.visible = isPinned;
            });
        }

        this._quitMenuItem = this._rightClickMenu.addAction(_('Quit %s').format(this._app.get_name()), () => {
            this._app.request_quit();
        });
        this._rightClickMenuManager.addMenu(this._rightClickMenu);
        this._rightClickMenu.actor.hide();
        Main.uiGroup.add_actor(this._rightClickMenu.actor);

        this._menu = new AppIconMenu(this._app, this);
        this._menuManager.addMenu(this._menu);
        this._menu.actor.hide();
        Main.uiGroup.add_actor(this._menu.actor);

        this._menu.connect('open-state-changed', () => {
            // Setting the max-height won't do any good if the minimum height of the
            // menu is higher then the screen; it's useful if part of the menu is
            // scrollable so the minimum height is smaller than the natural height
            const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
            this._menu.actor.style = 'max-height: %dpx;'.format(Math.round(workArea.height));
        });

        this._appStateUpdatedId = this._app.connect('notify::state', this._syncQuitMenuItemVisible.bind(this));
        this._syncQuitMenuItemVisible();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        this._label.destroy();
        this._menu.destroy();
        this._resetIconGeometry();

        if (this._startupCompleteId) {
            Main.layoutManager.disconnect(this._startupCompleteId);
            this._startupCompleteId = 0;
        }

        if (this._appStateUpdatedId) {
            this._app.disconnect(this._appStateUpdatedId);
            this._appStateUpdatedId = 0;
        }

        if (this._unpinIdleId) {
            GLib.source_remove(this._unpinMenuItem);
            this._unpinIdleId = 0;
        }
    }

    _syncQuitMenuItemVisible() {
        const visible = this._app.get_state() === Shell.AppState.RUNNING;
        this._quitMenuItem.actor.visible = visible;
    }

    _createIcon() {
        return this._app.create_icon_texture(this._iconSize);
    }

    _hasOtherMenuOpen() {
        const activeIconMenu = this._menuManager.activeMenu;
        return activeIconMenu &&
            activeIconMenu !== this._menu &&
            activeIconMenu.isOpen;
    }

    _closeOtherMenus(animation) {
        // close any other open menu
        if (this._hasOtherMenuOpen())
            this._menuManager.activeMenu.toggle(animation);
    }

    _getInterestingWindows() {
        let windows = this._app.get_windows();
        windows = windows.filter(metaWindow => {
            return !metaWindow.is_skip_taskbar();
        });
        return windows;
    }

    _handleButtonPressEvent(actor, event) {
        const button = event.get_button();
        const clickCount = event.get_click_count();

        if (button === Gdk.BUTTON_PRIMARY &&
            clickCount === 1) {
            this._hideHoverState();
            this.emit('app-icon-pressed');

            const windows = this._getInterestingWindows();
            const numRealWindows = windows.length;

            if (numRealWindows > 1) {
                const hasOtherMenu = this._hasOtherMenuOpen();
                let animation = BoxPointer.PopupAnimation.FULL;
                if (hasOtherMenu)
                    animation = BoxPointer.PopupAnimation.NONE;

                this._closeOtherMenus(animation);
                this._animateBounce();

                this.fake_release();
                this._menu.toggle(animation);
                this._menuManager.ignoreRelease();

                // This will block the clicked signal from being emitted
                return true;
            }
        }

        this.sync_hover();
        return false;
    }

    _handleClickEvent() {
        const event = Clutter.get_current_event();
        const button = event.get_button();

        if (button === Gdk.BUTTON_SECONDARY) {
            this._hideHoverState();

            this._closeOtherMenus(BoxPointer.PopupAnimation.FULL);
            if (this._menu.isOpen)
                this._menu.toggle(BoxPointer.PopupAnimation.FULL);

            this._rightClickMenu.open();
            return;
        }

        const hasOtherMenu = this._hasOtherMenuOpen();
        this._closeOtherMenus(BoxPointer.PopupAnimation.FULL);
        this._animateBounce();

        const windows = this._getInterestingWindows();
        const numRealWindows = windows.length;

        // The multiple windows case is handled in button-press-event
        if (windows.length === 0) {
            this._app.activate_full(-1, global.get_current_time());
        } else if (numRealWindows === 1) {
            const win = windows[0];
            if (win.has_focus() && !Main.overview.visible && !hasOtherMenu) {
                // The overview is not visible, and this is the
                // currently focused application; minimize it
                win.minimize();
            } else {
                // Activate window normally
                Main.activateWindow(win);
            }
        }
    }

    activateFirstWindow() {
        this._animateBounce();
        this._closeOtherMenus(BoxPointer.PopupAnimation.FULL);
        const windows = this._getInterestingWindows();
        if (windows.length > 0)
            Main.activateWindow(windows[0]);
        else
            this._app.activate_full(-1, global.get_current_time());
    }

    _hideHoverState() {
        this.fake_release();
        if (this._label.get_parent() !== null)
            Main.uiGroup.remove_actor(this._label);
    }

    _showHoverState() {
        // Show label only if it's not already visible
        this.fake_release();
        if (this._label.get_parent())
            return;

        Main.uiGroup.add_actor(this._label);
        Main.uiGroup.set_child_above_sibling(this._label, null);

        // Calculate location of the label only if we're not tweening as the
        // values will be inaccurate
        if (!this._isBouncing) {
            const iconMidpoint = this.get_transformed_position()[0] + this.width / 2;
            this._label.translation_x = Math.floor(iconMidpoint - this._label.width / 2);
            this._label.translation_y = Math.floor(this.get_transformed_position()[1] - this._labelOffsetY);

            // Clip left edge to be the left edge of the screen
            this._label.translation_x = Math.max(this._label.translation_x, 0);
        }
    }

    _animateBounce() {
        if (this._isBouncing)
            return;

        this._isBouncing = true;

        this.ease({
            scale_y: 1 - ICON_BOUNCE_MAX_SCALE,
            scale_x: 1 + ICON_BOUNCE_MAX_SCALE,
            translation_y: this.height * ICON_BOUNCE_MAX_SCALE,
            translation_x: -this.width * ICON_BOUNCE_MAX_SCALE / 2,
            duration: ICON_BOUNCE_ANIMATION_TIME * 0.25,
            mode: ICON_BOUNCE_ANIMATION_TYPE_1,
            onComplete: () => {
                this.ease({
                    scale_y: 1,
                    scale_x: 1,
                    translation_y: 0,
                    translation_x: 0,
                    duration: ICON_BOUNCE_ANIMATION_TIME * 0.75,
                    mode: ICON_BOUNCE_ANIMATION_TYPE_2,
                    onComplete: () => {
                        this._isBouncing = false;
                    },
                });
            },
        });
    }

    setIconSize(iconSize) {
        const icon = this._app.create_icon_texture(iconSize);
        this._iconSize = iconSize;

        this.set_child(icon);
    }

    _setIconRectForAllWindows(rectangle) {
        const windows = this._app.get_windows();
        windows.forEach(win => win.set_icon_geometry(rectangle));
    }

    _resetIconGeometry() {
        this._setIconRectForAllWindows(null);
    }

    _updateIconGeometry() {
        if (!this.mapped)
            return;

        const rect = new Meta.Rectangle();
        [rect.x, rect.y] = this.get_transformed_position();
        [rect.width, rect.height] = this.get_transformed_size();

        this._setIconRectForAllWindows(rect);
    }

    _updateStyle() {
        this._labelOffsetY = this._label.get_theme_node().get_length('-label-offset-y');
    }

    isPinned() {
        return AppFavorites.getAppFavorites().isFavorite(this._app.get_id());
    }
});

/** AppIconBarNavButton:
 *
 * This class handles the nav buttons on the app bar
 */
const AppIconBarNavButton = GObject.registerClass(
class AppIconBarNavButton extends St.Button {
    _init(iconName) {
        this._icon = new St.Icon({
            style_class: 'app-bar-nav-icon',
            icon_name: iconName,
        });

        super._init({
            style_class: 'app-bar-nav-button',
            child: this._icon,
            can_focus: true,
            reactive: true,
            track_hover: true,
            button_mask: St.ButtonMask.ONE,
        });
    }
});

const ScrolledIconList = GObject.registerClass({
    Signals: {
        'icons-scrolled': {},
        'app-icon-pressed': {},
    },
}, class ScrolledIconList extends St.ScrollView {
    _init(menuManager) {
        super._init({
            style_class: 'scrolled-icon-list hfade',
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.NEVER,
            x_expand: true,
            y_expand: true,
        });

        this._menuManager = menuManager;

        // Due to the interactions with StScrollView,
        // StBoxLayout clips its painting to the content box, effectively
        // clipping out the side paddings we want to set on the actual icons
        // container. We need to go through some hoops and set the padding
        // on an intermediate spacer child instead
        const scrollChild = new St.BoxLayout();
        this.add_actor(scrollChild);

        this._spacerBin = new St.Widget({
            style_class: 'scrolled-icon-spacer',
            layout_manager: new Clutter.BinLayout(),
        });
        scrollChild.add_actor(this._spacerBin);

        this._container = new St.BoxLayout({
            style_class: 'scrolled-icon-container',
            x_expand: true,
            y_expand: true,
        });
        this._spacerBin.add_actor(this._container);

        this._iconSize = ICON_SIZE;
        this._iconSpacing = 0;

        this._iconOffset = 0;
        this._appsPerPage = -1;

        this._container.connect('style-changed', this._updateStyleConstants.bind(this));

        const appSys = Shell.AppSystem.get_default();

        if (ParentalControlsManager)
            this._parentalControlsManager = ParentalControlsManager.getDefault();
        else
            this._parentalControlsManager = null;

        this._taskbarApps = new Map();

        const appFavorites = AppFavorites.getAppFavorites();
        const favorites = appFavorites.getFavorites();
        for (const favorite of favorites)
            this._addButton(favorite);

        // Update for any apps running before the system started
        // (after a crash or a restart)
        const currentlyRunning = appSys.get_running();
        const appsByPid = [];
        for (let i = 0; i < currentlyRunning.length; i++) {
            const app = currentlyRunning[i];
            // Most apps have a single PID; ignore all but the first
            const pid = app.get_pids()[0];
            appsByPid.push({ pid, app });
        }

        // Sort numerically by PID
        // This preserves the original app order, until the maximum PID
        // value is reached and older PID values are recycled
        const sortedPids = appsByPid.sort((a, b) => a.pid - b.pid);
        for (const sortedPid of sortedPids)
            this._addButton(sortedPid.app);

        this._appFavoritesChangedId = appFavorites.connect('changed',
            this._reloadFavorites.bind(this));
        this._appInstalledChangedId = appSys.connect('installed-changed', () => {
            AppFavorites.getAppFavorites().reload();
            this._reloadFavorites();
        });
        this._appStateChangedId = appSys.connect('app-state-changed',
            this._onAppStateChanged.bind(this));

        if (this._parentalControlsManager) {
            this._appFilterChangedId = this._parentalControlsManager.connect('app-filter-changed', () => {
                for (const [app, appButton] of this._taskbarApps) {
                    const shouldShow =
                        this._parentalControlsManager.shouldShowApp(app.get_app_info());
                    const stopped = app.state === Shell.AppState.STOPPED;

                    appButton.visible = !stopped || shouldShow;
                }
            });
        }

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        if (this._appFavoritesChangedId) {
            const appFavorites = AppFavorites.getAppFavorites();
            appFavorites.disconnect(this._appFavoritesChangedId);
            this._appFavoritesChangedId = 0;
        }

        if (this._appInstalledChangedId) {
            const appSys = Shell.AppSystem.get_default();
            appSys.disconnect(this._appInstalledChangedId);
            this._appInstalledChangedId = 0;
        }

        if (this._appStateChangedId) {
            const appSys = Shell.AppSystem.get_default();
            appSys.disconnect(this._appStateChangedId);
            this._appStateChangedId = 0;
        }

        if (this._appFilterChangedId) {
            this._parentalControlsManager.disconnect(this._appFilterChangedId);
            this._appFilterChangedId = 0;
        }
    }

    setActiveApp(app) {
        this._taskbarApps.forEach((appButton, taskbarApp) => {
            if (app === taskbarApp)
                appButton.add_style_pseudo_class('highlighted');
            else
                appButton.remove_style_pseudo_class('highlighted');

            appButton.queue_redraw();
        });
    }

    getNumAppButtons() {
        return this._taskbarApps.size;
    }

    getNumVisibleAppButtons() {
        const buttons = [...this._taskbarApps.values()];
        return buttons.reduce((counter, appButton) => {
            return appButton.visible ? counter : counter + 1;
        }, 0);
    }

    activateNthApp(index) {
        const buttons = [...this._taskbarApps.values()];
        const appButton = buttons[index];
        if (appButton)
            appButton.activateFirstWindow();
    }

    getMinContentWidth(forHeight) {
        // We always want to show one icon, plus we want to keep the padding
        // added by the spacer actor
        const [minSpacerWidth] = this._spacerBin.get_preferred_width(forHeight);
        const [minContainerWidth] = this._container.get_preferred_width(forHeight);
        return this._iconSize + (minSpacerWidth - minContainerWidth);
    }

    _updatePage() {
        // Clip the values of the iconOffset
        const lastIconOffset = this.getNumVisibleAppButtons() - 1;
        const movableIconsPerPage = this._appsPerPage - 1;
        let iconOffset = Math.max(0, this._iconOffset);
        iconOffset = Math.min(lastIconOffset - movableIconsPerPage, iconOffset);

        if (this._iconOffset === iconOffset)
            return;

        this._iconOffset = iconOffset;

        let relativeAnimationTime = ICON_SCROLL_ANIMATION_TIME;

        const iconFullWidth = this._iconSize + this._iconSpacing;
        const pageSize = this._appsPerPage * iconFullWidth;
        const hadjustment = this.hscroll.adjustment;

        const currentOffset = this.hscroll.adjustment.get_value();
        const targetOffset = Math.min(this._iconOffset * iconFullWidth, hadjustment.upper);

        const distanceToTravel = Math.abs(targetOffset - currentOffset);
        if (distanceToTravel < pageSize)
            relativeAnimationTime = relativeAnimationTime * distanceToTravel / pageSize;

        hadjustment.ease(targetOffset, {
            duration: relativeAnimationTime,
            mode: ICON_SCROLL_ANIMATION_TYPE,
        });
        this.emit('icons-scrolled');
    }

    pageBack() {
        this._iconOffset -= this._appsPerPage - 1;
        this._updatePage();
    }

    pageForward() {
        this._iconOffset += this._appsPerPage - 1;
        this._updatePage();
    }

    isBackAllowed() {
        return this._iconOffset > 0;
    }

    isForwardAllowed() {
        return this._iconOffset < this.getNumVisibleAppButtons() - this._appsPerPage;
    }

    calculateNaturalSize(forWidth) {
        const [numOfPages, appsPerPage] = this._calculateNumberOfPages(forWidth);

        if (this._appsPerPage !== appsPerPage ||
            this._numberOfPages !== numOfPages) {
            this._appsPerPage = appsPerPage;
            this._numberOfPages = numOfPages;

            this._updatePage();
        }

        const iconFullSize = this._iconSize + this._iconSpacing;
        return this._appsPerPage * iconFullSize - this._iconSpacing;
    }

    _updateStyleConstants() {
        const node = this._container.get_theme_node();
        this._iconSize = node.get_length('-icon-size');

        // The theme will give us an already-scaled size, but both ScrolledIconList and
        // the instances of AppIconButton expect the unscaled versions, since the underlying
        // machinery will scale things later on as needed. Thus, we need to unscale it.
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        this._iconSize /= scaleFactor;

        this._taskbarApps.forEach(appButton => {
            appButton.setIconSize(this._iconSize);
        });

        this._iconSpacing = node.get_length('spacing');
    }

    _ensureIsVisible(app) {
        const apps = [...this._taskbarApps.keys()];
        const itemIndex = apps.indexOf(app);
        if (itemIndex !== -1)
            this._iconOffset = itemIndex;

        this._updatePage();
    }

    _isAppInteresting(app) {
        if (AppFavorites.getAppFavorites().isFavorite(app.get_id()))
            return true;

        if (app.state === Shell.AppState.STARTING)
            return true;

        if (app.state === Shell.AppState.RUNNING) {
            const windows = app.get_windows();
            return windows.some(metaWindow => !metaWindow.is_skip_taskbar());
        }

        return false;
    }

    _reloadFavorites() {
        const favorites = AppFavorites.getAppFavorites().getFavorites();
        for (let i = 0; i < favorites.length; i++)
            this._ensureButton(favorites[i], i);
    }

    _ensureButton(app, position) {
        if (!this._isAppInteresting(app))
            return;

        if (this._taskbarApps.has(app)) {
            const appButton = this._taskbarApps.get(app);
            const appButtonAtIndex = this._container.get_child_at_index(position);
            if (appButtonAtIndex == appButton)
                return;
            this._container.set_child_at_index(appButton, position);
            return;
        }

        this._insertButton(app, position);
    }

    _insertButton(app, position) {
        if (this._taskbarApps.has(app) || !this._isAppInteresting(app))
            return;

        const favorites = AppFavorites.getAppFavorites();
        const newChild = new AppIconButton(app, this._iconSize, this._menuManager, true);

        newChild.connect('app-icon-pressed', () => {
            this.emit('app-icon-pressed');
        });
        newChild.connect('app-icon-pinned', () => {
            favorites.addFavorite(app.get_id());
        });
        newChild.connect('app-icon-unpinned', () => {
            favorites.removeFavorite(app.get_id());
            if (app.state === Shell.AppState.STOPPED) {
                newChild.destroy();
                this._taskbarApps.delete(app);
                this._updatePage();
            } else {
                this._container.set_child_at_index(newChild,
                    this._taskbarApps.size);
            }
        });
        this._taskbarApps.set(app, newChild);

        this._container.insert_child_at_index(newChild, position);

        if (app.state == Shell.AppState.STOPPED &&
            (this._parentalControlsManager &&
             !this._parentalControlsManager.shouldShowApp(app.get_app_info()))) {
            newChild.hide();
        }
    }

    _addButton(app) {
        this._insertButton(app, -1);
    }

    _onAppStateChanged(appSys, app) {
        const state = app.state;
        switch (state) {
        case Shell.AppState.STARTING:
            if (this._parentalControlsManager &&
                !this._parentalControlsManager.shouldShowApp(app.get_app_info()))
                break;
            this._addButton(app);
            this._ensureIsVisible(app);
            break;

        case Shell.AppState.RUNNING:
            this._addButton(app);
            this._ensureIsVisible(app);
            break;

        case Shell.AppState.STOPPED: {
            const appButton = this._taskbarApps.get(app);
            if (!appButton)
                break;

            if (AppFavorites.getAppFavorites().isFavorite(app.get_id())) {
                if (this._parentalControlsManager &&
                    !this._parentalControlsManager.shouldShowApp(app.get_app_info()))
                    appButton.hide();
                break;
            }

            this._container.remove_child(appButton);
            this._taskbarApps.delete(app);

            break;
        }
        }

        this._updatePage();
    }

    _calculateNumberOfPages(forWidth) {
        const minimumIconWidth = this._iconSize + this._iconSpacing;

        // We need to add one icon space to net width here so that the division
        // takes into account the fact that the last icon does not use iconSpacing
        let iconsPerPage = Math.floor((forWidth + this._iconSpacing) / minimumIconWidth);
        iconsPerPage = Math.max(1, iconsPerPage);

        const pages = Math.ceil(this.getNumVisibleAppButtons() / iconsPerPage);
        return [pages, iconsPerPage];
    }
});

var AppIconBarContainer = GObject.registerClass(
class AppIconBarContainer extends St.Widget {
    _init(backButton, forwardButton, scrolledIconList) {
        super._init({
            name: 'appIconBarContainer',
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });

        this._spacing = 0;

        this._backButton = backButton;
        this.add_child(backButton);

        this._forwardButton = forwardButton;
        this.add_child(forwardButton);

        this._scrolledIconList = scrolledIconList;
        this.add_child(scrolledIconList);
    }

    _updateNavButtonState() {
        let backButtonOpacity = MAX_OPACITY;
        if (!this._scrolledIconList.isBackAllowed())
            backButtonOpacity = 0;

        let forwardButtonOpacity = MAX_OPACITY;
        if (!this._scrolledIconList.isForwardAllowed())
            forwardButtonOpacity = 0;

        this._backButton.opacity = backButtonOpacity;
        this._forwardButton.opacity = forwardButtonOpacity;
    }

    vfunc_get_preferred_width(forHeight) {
        const [minBackWidth, natBackWidth] = this._backButton.get_preferred_width(forHeight);
        const [minForwardWidth, natForwardWidth] = this._forwardButton.get_preferred_width(forHeight);

        // The scrolled icon list actor is a scrolled view with
        // hscrollbar-policy=NONE, so it will take the same width requisition as
        // its child. While we can use the natural one to measure the content,
        // we need a special method to measure the minimum width
        const minContentWidth = this._scrolledIconList.getMinContentWidth(forHeight);
        const [, natContentWidth] = this._scrolledIconList.get_preferred_width(forHeight);

        const minSize = minBackWidth + minForwardWidth + 2 * this._spacing + minContentWidth;
        const naturalSize = natBackWidth + natForwardWidth + 2 * this._spacing + natContentWidth;

        return [minSize, naturalSize];
    }

    vfunc_get_preferred_height(forWidth) {
        const [minListHeight, natListHeight] = this._scrolledIconList.get_preferred_height(forWidth);
        const [minBackHeight, natBackHeight] = this._backButton.get_preferred_height(forWidth);
        const [minForwardHeight, natForwardHeight] = this._forwardButton.get_preferred_height(forWidth);

        const minButtonHeight = Math.max(minBackHeight, minForwardHeight);
        const natButtonHeight = Math.max(natBackHeight, natForwardHeight);

        const minSize = Math.max(minButtonHeight, minListHeight);
        const naturalSize = Math.max(natButtonHeight, natListHeight);

        return [minSize, naturalSize];
    }

    vfunc_style_changed() {
        this._spacing = this.get_theme_node().get_length('spacing');
    }

    vfunc_allocate(box) {
        super.vfunc_allocate(box);

        const allocWidth = box.x2 - box.x1;
        const allocHeight = box.y2 - box.y1;

        const minBackWidth = this._backButton.get_preferred_width(allocHeight)[0];
        const minForwardWidth = this._forwardButton.get_preferred_width(allocHeight)[0];
        const maxIconSpace = Math.max(allocWidth - minBackWidth - minForwardWidth - 2 * this._spacing, 0);

        const childBox = new Clutter.ActorBox();
        childBox.y1 = 0;
        childBox.y2 = allocHeight;

        if (this.get_text_direction() === Clutter.TextDirection.RTL) {
            childBox.x1 = allocWidth;
            childBox.x2 = allocWidth;

            if (this._scrolledIconList.isBackAllowed()) {
                childBox.x1 = childBox.x2 - minBackWidth;
                this._backButton.allocate(childBox);

                childBox.x1 -= this._spacing;
            }

            childBox.x2 = childBox.x1;
            childBox.x1 = childBox.x2 - this._scrolledIconList.calculateNaturalSize(maxIconSpace) - 2 * this._spacing;
            this._scrolledIconList.allocate(childBox);

            childBox.x2 = childBox.x1;
            childBox.x1 = childBox.x2 - minForwardWidth;
            this._forwardButton.allocate(childBox);
        } else {
            childBox.x1 = 0;
            childBox.x2 = 0;

            if (this._scrolledIconList.isBackAllowed()) {
                childBox.x2 = childBox.x1 + minBackWidth;
                this._backButton.allocate(childBox);

                childBox.x2 += this._spacing;
            }

            childBox.x1 = childBox.x2;
            childBox.x2 = childBox.x1 + this._scrolledIconList.calculateNaturalSize(maxIconSpace) + 2 * this._spacing;
            this._scrolledIconList.allocate(childBox);

            childBox.x1 = childBox.x2;
            childBox.x2 = childBox.x1 + minForwardWidth;
            this._forwardButton.allocate(childBox);
        }

        this._updateNavButtonState();
    }
});

/** AppIconBar:
 *
 * This class handles positioning all the application icons and listening
 * for app state change signals
 */
var AppIconBar = GObject.registerClass(
class AppIconBar extends PanelMenu.Button {
    _init(panel) {
        super._init(0.0, null, true);
        this.add_style_class_name('app-icon-bar');

        this._panel = panel;

        this._menuManager = new PopupMenu.PopupMenuManager(this);

        this._backButton = new AppIconBarNavButton('go-previous-symbolic');
        this._backButton.connect('clicked', this._previousPageSelected.bind(this));

        this._scrolledIconList = new ScrolledIconList(this._menuManager);

        this._forwardButton = new AppIconBarNavButton('go-next-symbolic');
        this._forwardButton.connect('clicked', this._nextPageSelected.bind(this));

        const bin = new St.Bin({ name: 'appIconBar' });
        this.add_actor(bin);

        this._container =
            new AppIconBarContainer(this._backButton, this._forwardButton, this._scrolledIconList);
        bin.set_child(this._container);

        this._scrolledIconList.connect('icons-scrolled', () => {
            this._container.queue_relayout();
        });
        this._scrolledIconList.connect('app-icon-pressed', this._onAppIconPressed.bind(this));

        this._windowTracker = Shell.WindowTracker.get_default();
        this._focusAppChangedId = this._windowTracker.connect('notify::focus-app',
            this._updateActiveApp.bind(this));
        this._overviewShowingId = Main.overview.connect('showing',
            this._updateActiveApp.bind(this));
        this._overviewHiddenId = Main.overview.connect('hidden',
            this._updateActiveApp.bind(this));

        this._updateActiveApp();

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        if (this._focusAppChangedId) {
            this._windowTracker.disconnect(this._focusAppChangedId);
            this._focusAppChangedId = 0;
        }
        if (this._overviewShowingId) {
            Main.overview.disconnect(this._overviewShowingId);
            this._overviewShowingId = 0;
        }
        if (this._overviewHiddenId) {
            Main.overview.disconnect(this._overviewHiddenId);
            this._overviewHiddenId = 0;
        }
    }

    _onAppIconPressed() {
        this._closeActivePanelMenu();
    }

    _closeActivePanelMenu() {
        const activeMenu = this._panel.menuManager.activeMenu;
        if (activeMenu)
            activeMenu.close(BoxPointer.PopupAnimation.FADE);
    }

    _activateNthApp(index) {
        this._scrolledIconList.activateNthApp(index);
    }

    _activateLastApp() {
        // Activate the index of the last button in the scrolled list
        this._activateNthApp(this._scrolledIconList.getNumAppButtons() - 1);
    }

    _updateActiveApp() {
        if (Main.overview.visible) {
            this._setActiveApp(null);
            return;
        }

        const focusApp = this._windowTracker.focus_app;
        this._setActiveApp(focusApp);
    }

    _setActiveApp(app) {
        this._scrolledIconList.setActiveApp(app);
    }

    _previousPageSelected() {
        this._scrolledIconList.pageBack();
    }

    _nextPageSelected() {
        this._scrolledIconList.pageForward();
    }
});
