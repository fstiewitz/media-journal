/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const Store = require('electron-store');

let journalPath = null;

class ConfigManager {
    constructor() {
        this.store = new Store();
    }
    get collections() {
        return new Set(Object.keys(this.store.get('collections', {})));
    }
    get input() {
        return this.store.get('input', null);
    }
    get volume() {
        return this.store.get('volume', 1.0);
    }
    get positiveVolume() {
        return this.store.get('positiveVolume', 1.0);
    }
    set input(x) {
        this.store.set('input', x);
    }
    set volume(x) {
        x = Math.max(0, x);
        x = Math.min(x, 1.0);
        if(x > 0) this.store.set('positiveVolume', x)
        this.store.set('volume', x);
    }
    set collections(x) {
        const y = {};
        for(const z of x) {
            y[z] = true;
        }
        this.store.set('collections', y)
    }
}

module.exports = {
    journalPath, ConfigManager
}