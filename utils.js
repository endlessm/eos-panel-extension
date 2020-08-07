// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-
/* exported override, restore, original */
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

function override(object, methodName, callback) {
    if (!object._panelFnOverrides)
        object._panelFnOverrides = {};

    const baseObject = object.prototype || object;
    const originalMethod = baseObject[methodName];
    object._panelFnOverrides[methodName] = originalMethod;
    baseObject[methodName] = callback;
}

function restore(object) {
    const baseObject = object.prototype || object;
    if (object._panelFnOverrides) {
        Object.keys(object._panelFnOverrides).forEach(k => {
            baseObject[k] = object._panelFnOverrides[k];
        });
        delete object._panelFnOverrides;
    }
}

function original(object, methodName) {
    return object._panelFnOverrides[methodName];
}
