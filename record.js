/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const Config = require('./config')
const fs = require('fs');
const path = require('path');

class Record {
    constructor(p, data) {
        this._path = p;
        if (!data) {
            data = JSON.parse(fs.readFileSync(path.join(Config.journalPath, p)));
        }
        this._name = data['name'];
        this._data = data['data'];
        this._tags = new Set(data['tags']);
    }

    get audio() {
        return this._data.filter((x) => x.endsWith('.ogg'))[0];
    }

    get name() {
        return this._name;
    }

    get tags() {
        return this._tags;
    }

    set tags(x) {
        this._tags = new Set(x);
    }

    get path() {
        return this._path;
    }

    static loadRecord(p) {
        return new Promise((resolve, reject) => {
            const pa = `${p}.meta.json`;
            fs.readFile(path.join(Config.journalPath, pa), (err, data) => {
                if (err) {
                    reject(`read error: ${err}`);
                } else {
                    const d = JSON.parse(data);
                    resolve(new Record(pa, d));
                }
            });
        });
    }

    save() {
        return new Promise((resolve, reject) => {
            const d = {
                name: this._name,
                tags: Array.from(this._tags),
                data: this._data
            }
            fs.writeFile(path.join(Config.journalPath, this._path), JSON.stringify(d), (err) => {
                if (err) reject(err);
                else resolve(this);
            })
        })
    }

    static createRecord(p, name, tags, data) {
        return new Promise((resolve, reject) => {
            const d = {
                name: name,
                tags: tags,
                data: data
            }
            const pname = `${formatISO(new Date())} ${p}.meta.json`;
            fs.writeFile(path.join(Config.journalPath, pname), JSON.stringify(d), (err) => {
                if (err) reject(err);
                else resolve(new Record(pname, d));
            })
        });
    }

    unlinkFile(p) {
        return new Promise((resolve, reject) => {
            fs.unlink(path.join(Config.journalPath, p), (err) => {
                if (err) reject(err);
                else resolve();
            })
        });
    }

    unlink() {
        let x = [];
        x.push(this.unlinkFile(this.path));
        for(const f of this._data) {
            x.push(this.unlinkFile(f));
        }
        return Promise.all(x);
    }
}

module.exports = {
    Record
}