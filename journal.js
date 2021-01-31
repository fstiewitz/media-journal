/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const Config = require('./config')
const path = require('path')
const fs = require('fs')

class Journal {
    constructor(p, name) {
        this.path = p;
        if(name) {
            this.name = name;
        } else {
            const d = JSON.parse(fs.readFileSync(path.join(Config.journalPath, p)));
            if (!('name' in d)) {
                console.log('invalid journal file (no name field):', p);
                throw `invalid journal file (no name field): ${p}`;
            }
            this.name = d['name'];
        }
    }
    static loadJournal(p) {
        return new Promise((resolve, reject) => {
            const pa = `${p}.journal.json`;
            fs.readFile(path.join(Config.journalPath, pa), (err, data) => {
                if (err) {
                    reject(`read error: ${err}`);
                } else {
                    const d = JSON.parse(data);
                    if (!('name' in d)) {
                        reject(`invalid journal file (no name field): ${p}`);
                        return;
                    }
                    resolve(new Journal(pa, d['name']));
                }
            });
        });
    }
    static createJournal(name) {
        return new Promise((resolve, reject) => {
            const clear = name.replaceAll(/\W/g, '');
            fs.writeFile(path.join(Config.journalPath, `${clear}.journal.json`), JSON.stringify({
                name: name
            }), (err) => {
                if (err) reject(`journal add error (${name}): ${err}`);
                else resolve(new Journal(`${clear}.journal.json`, name));
            });
        });
    }
    unlink() {
        return new Promise((resolve, reject) => {
            fs.unlink(path.join(Config.journalPath, this.path), (err) => {
                if(err) reject(err);
                else resolve();
            })
        })
    }
}

class JournalList {
    constructor(el, db, allowDelete = false, allowStates = true) {
        this.el = el;
        this.db = db;
        this.allowDelete = allowDelete;
        this.allowStates = allowStates;
        this.onreload = null;
        this.onstatechange = null;
        this.onjournaldelete = null;
        this.journalStates = {};
    }
    get activeJournals() {
        return Object.entries(this.journalStates).filter((x) => x[1]).map((x) => x[0]);
    }
    setJournalState(p, val) {
        this.journalStates[p] = val;
        if(this.onstatechange) this.onstatechange(p);
    }
    addJournalEntry(journal, resetStates = true) {
        if(!journal) return;
        const li = document.createElement('li');
        const lb = document.createElement('label');
        li.className = 'journal-entry';
        lb.className = 'label';
        if(this.allowStates) {
            const chk = document.createElement('input');
            chk.setAttribute("type", "checkbox");
            chk.id = `journal-${this.el.id}-checkbox-${journal.path.replace(/\W/g, '-')}`;
            if(resetStates) {
                chk.checked = true;
                this.journalStates[journal.path] = true;
            } else if(journal.path in this.journalStates) {
                chk.checked = this.journalStates[journal.path];
            } else {
                chk.checked = true;
                this.journalStates[journal.path] = true;
            }
            chk.onchange = () => {
                this.setJournalState(journal.path, chk.checked);
            }
            lb.setAttribute('for', chk.id);
            li.appendChild(chk);
        }
        lb.innerText = journal.name;
        li.appendChild(lb);

        if(this.allowDelete) {
            const btn = document.createElement('button');
            btn.className = 'delete-button';
            btn.onclick = () => {
                if(this.onjournaldelete) this.onjournaldelete(journal);
            }
            li.appendChild(btn);
        }

        this.el.appendChild(li);
    }
    anyJournalActive(tags) {
        if (tags.size === 0) return true;
        let anyValidTags = false;
        for (const tag of tags) {
            if (!(tag in this.journalStates)) continue;
            if (this.isJournalActive(tag)) return true;
            anyValidTags = true;
        }
        return !anyValidTags;
    }
    isJournalActive(n) {
        return this.journalStates[n];
    }
    reload(resetStates = true) {
        while (this.el.lastChild) {
            this.el.removeChild(this.el.firstChild);
        }
        for (const journal of Object.keys(this.db.journals)) {
            this.addJournalEntry(this.db.journals[journal], resetStates);
        }
        if(this.onreload) this.onreload();
    }
}

module.exports = {
    Journal, JournalList
}