/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const {ipcRenderer} = require('electron');

const path = require('path')
const fs = require('fs')
const Config = require('./config');
const {Journal, JournalList} = require('./journal');
const {Record} = require('./record');
const {AudioManager} = require('./audio');
const {SpectrumCanvas} = require('./spectrum-canvas');
const {Stage} = require('./stage');

const {format, formatISO, parseISO} = require('date-fns');

let config = new Config.ConfigManager();
const audioManager = new AudioManager(config);
const stage = new Stage(config, null);
const mainJournalList = new JournalList(document.getElementById('journal-list'), null, true, true);

mainJournalList.onjournaldelete = requestJournalDelete;
mainJournalList.onstatechange = reloadRecordList;
mainJournalList.onreload = reloadRecordList;

document.body.onresize = resize;

// Database

function timestampFromName(name) {
    const s = path.basename(name).split(" ");
    if (s.length <= 1) return new Date();
    return parseISO(s[0]);
}

function titleFromName(name) {
    return path.basename(name).split(" ").slice(1).join(" ").split(".").slice(0, -1).join(".");
}

class Database {
    constructor() {
        this.journals = {};
        this.files = {};
        this._syncDir(Config.journalPath, "", "");
    }

    getEntriesBetween(from, to) {
        let e = [];
        for (const f of Object.keys(this.files)) {
            const ts = timestampFromName(path.basename(f));
            let anyActive = mainJournalList.anyJournalActive(this.files[f].tags);
            if (anyActive && (!from || from <= ts) && (!to || ts < to)) {
                e.push({
                    internalName: f,
                    name: this.files[f].name,
                    ts: ts
                })
            }
        }
        return e;
    }

    _syncDir(f, r, p) {
        for (const e of fs.readdirSync(path.join(f, p), {withFileTypes: true})) {
            if (e.isFile() && e.name.endsWith('.journal.json')) {
                const pa = path.join(r, p, e.name);
                const journal = new Journal(pa, null);
                this.journals[pa] = journal;
                mainJournalList.addJournalEntry(journal);
            } else if (e.isFile() && e.name.endsWith('.meta.json')) {
                this.addEntry(path.join(r, p, e.name), true);
            } else if (e.isDirectory()) {
                this._syncDir(path.join(f, p), path.join(r, p), e.name);
            }
        }
    }

    addEntry(p, sync = false) {
        if (!p.endsWith('.meta.json')) {
            if (sync) return;
            else Promise.reject(`File not a .meta.json: ${p}`);
        }
        if (sync) {
            this.files[p] = new Record(p);
        } else {
            return Record.loadRecord(p)
                .then((r) => {
                    this.files[p] = r;
                })
        }
    }

    addEntry_(p, r) {
        this.files[p] = r;
    }

    removeEntry(r) {
        delete this.files[r.path];
    }

    removeJournal(j) {
        delete this.journals[j.path];
    }

}

let db = null;

function initDb() {
    db = new Database();
    stage.db = db;
    reloadRecordList();
    console.log('initialized DB');
}


// HTML

const journalList = document.getElementById('journal-list');
const journalTextField = document.getElementById('journal-text-add');
const recordList = document.getElementById('record-list');
const entryList = document.getElementById('entry-list');

const audioDevices = document.getElementById('audio-devices');
const audioSelectFeedback = document.getElementById('audio-input-selection-feedback');
const audioSelectFeedbackMessage = document.getElementById('audio-input-selection-feedback-message');

const audioStartPauseButton = document.getElementById('start-pause-button');
const audioStopButton = document.getElementById('stop-button');

const deletePopup = document.getElementById('delete-popup');
const deleteCancelButton = document.getElementById('delete-cancel');
const deleteConfirmButton = document.getElementById('delete-confirm');

const journalDeletePopup = document.getElementById('delete-journal-popup');
const journalDeleteCancelButton = document.getElementById('journal-delete-cancel');
const journalDeleteConfirmButton = document.getElementById('journal-delete-confirm');

const spectrumCanvas = new SpectrumCanvas(document.getElementById('spectrum-canvas'), audioManager);

let journalToDelete = null;

function requestJournalDelete(j) {
    journalToDelete = j;
    journalDeletePopup.classList.remove('hidden');
}

journalDeleteCancelButton.onclick = () => {
    journalDeletePopup.classList.add('hidden');
}

journalDeleteConfirmButton.onclick = () => {
    console.log('deleting journal', journalToDelete.path);
    journalDeletePopup.classList.add('hidden');
    db.removeJournal(journalToDelete);
    journalToDelete.unlink();
    mainJournalList.reload(false);
    journalToDelete = null;
}

let recordToDelete = null;

function requestDelete(r) {
    recordToDelete = r;
    deletePopup.classList.remove('hidden');
}

deleteCancelButton.onclick = () => {
    deletePopup.classList.add('hidden');
}

deleteConfirmButton.onclick = () => {
    deletePopup.classList.add('hidden');
    recordToDelete.unlink();
    db.removeEntry(recordToDelete);
    reloadRecordList();
    recordToDelete = null;
}

let selectedRecord = null

function reloadEntryList() {
    selectEntry(selectedRecord);
}

function reloadRecordList() {
    while (recordList.children[1].lastChild) {
        recordList.children[1].removeChild(recordList.children[1].firstChild);
    }
    for (const file of Object.keys(db.files)) {
        if (!mainJournalList.anyJournalActive(db.files[file].tags)) continue;
        addRecord({
            name: titleFromName(file),
            internalName: file,
            ts: timestampFromName(file)
        });
    }
    selectEntry(null);
    reloadEntryList();
}

audioStartPauseButton.onclick = () => {
    if (audioManager.recorder) audioManager.pauseRecording();
    else audioManager.startRecording();
}

audioStopButton.onclick = () => {
    audioManager.stopRecording();
}

function addYearEntryToTree(ts, ch, isChild = true) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const ul = document.createElement('ul');

    li.setAttribute('data-year', ts.getFullYear());
    a.innerText = format(ts, 'y');
    a.onclick = () => selectEntry(a);

    li.appendChild(a);
    li.appendChild(ul);

    if (isChild) ch.parentNode.insertBefore(li, ch);
    else ch.appendChild(li);
    return li;
}

function addMonthEntryToTree(ts, ch, isChild = true) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const ul = document.createElement('ul');

    li.setAttribute('data-month', ts.getMonth());
    a.innerText = format(ts, 'MMMM');
    a.onclick = () => selectEntry(a);

    li.appendChild(a);
    li.appendChild(ul);

    if (isChild) ch.parentNode.insertBefore(li, ch);
    else ch.appendChild(li);
    return li;
}

function addDayEntryToTree(ts, ch, isChild = true) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const ul = document.createElement('ul');

    li.setAttribute('data-is-leaf', 1);
    li.setAttribute('data-day', ts.getDate());
    a.innerText = format(ts, 'EEEE d');
    a.onclick = () => selectEntry(a);

    li.appendChild(a);
    li.appendChild(ul);

    if (isChild) ch.parentNode.insertBefore(li, ch);
    else ch.appendChild(li);
    return li;
}

function addRecordToTree(name, timestamp, node) {
    if (node.hasAttribute('data-is-leaf') && node.getAttribute('data-is-leaf')) {
        return;
    }
    for (const ch of node.children[1].children) {
        if (ch.hasAttribute('data-year')) {
            const year = parseInt(ch.getAttribute('data-year'));
            if (year === timestamp.getFullYear()) {
                addRecordToTree(name, timestamp, ch);
                return;
            } else if (year < timestamp.getFullYear()) {
                addRecordToTree(name, timestamp, addYearEntryToTree(timestamp, ch));
                return;
            }
        } else if (ch.hasAttribute('data-month')) {
            const month = parseInt(ch.getAttribute('data-month'));
            if (month === timestamp.getMonth()) {
                addRecordToTree(name, timestamp, ch);
                return;
            } else if (month < timestamp.getMonth()) {
                addRecordToTree(name, timestamp, addMonthEntryToTree(timestamp, ch));
                return;
            }
        } else if (ch.hasAttribute('data-day')) {
            const day = parseInt(ch.getAttribute('data-day'));
            if (day === timestamp.getDate()) {
                addRecordToTree(name, timestamp, ch);
                return;
            } else if (day < timestamp.getDate()) {
                addRecordToTree(name, timestamp, addDayEntryToTree(timestamp, ch));
                return;
            }
        } else {
            console.log(`invalid record list when inserting timestamp ${timestamp}`);
            return;
        }
    }
    if (node === recordList) {
        addRecordToTree(name, timestamp, addYearEntryToTree(timestamp, node.children[1], false));
    } else if (node.hasAttribute('data-year')) {
        addRecordToTree(name, timestamp, addMonthEntryToTree(timestamp, node.children[1], false));
    } else if (node.hasAttribute('data-month')) {
        addRecordToTree(name, timestamp, addDayEntryToTree(timestamp, node.children[1], false));
    } else if (node.hasAttribute('data-day')) {
    } else {
        console.log(`invalid record list when inserting timestamp ${timestamp}`);
    }
}

function addRecord(name) {
    const ts = new Date(name['ts']); // TODO necessary?
    addRecordToTree(name, ts, recordList);
}

function selectEntry(a) {
    let from = null;
    let to = null;
    selectedRecord = a;
    if (a) {
        if (a.parentNode.hasAttribute('data-year')) {
            from = new Date(parseInt(a.parentNode.getAttribute('data-year')), 0, 1);
            to = new Date(parseInt(a.parentNode.getAttribute('data-year')) + 1, 0, 1);
        } else if (a.parentNode.hasAttribute('data-month')) {
            const year = parseInt(a.parentNode.parentNode.parentNode.getAttribute('data-year'));
            const month = parseInt(a.parentNode.getAttribute('data-month'));
            from = new Date(year, month, 1);
            if (month === 11) {
                to = new Date(year + 1, 0, 1);
            } else {
                to = new Date(year, month + 1, 1);
            }
        } else if (a.parentNode.hasAttribute('data-day')) {
            const year = parseInt(a.parentNode.parentNode.parentNode.parentNode.parentNode.getAttribute('data-year'));
            const month = parseInt(a.parentNode.parentNode.parentNode.getAttribute('data-month'));
            const day = parseInt(a.parentNode.getAttribute('data-day'));
            from = new Date(year, month, day, 0, 0, 0);
            to = new Date(year, month, day, 23, 59, 59);
        }
    }
    const entries = db.getEntriesBetween(from, to).filter((x) => mainJournalList.anyJournalActive(db.files[x['internalName']].tags));
    while (entryList.lastChild) {
        entryList.removeChild(entryList.firstChild);
    }
    let hasStaged = (stage.stagedRecord === null);
    for (const e of entries.sort((a, b) => {
        if (a['ts'] > b['ts']) return -1;
        else if (a['ts'] < b['ts']) return 1;
        else return 0;
    })) {
        if (!hasStaged && e['internalName'] === stage.stagedRecord) {
            hasStaged = true;
        }
        addEntryEntry(e);
    }
    if (!hasStaged) {
        stage.hideStage();
        stage.stagedRecord = null;
    }
}

function resize() {
    spectrumCanvas.resize();
}

stage.onconfirm = () => {
    const d = stage.saveStage();
    saveStage(d);
}

function saveStage(data) {
    const d = new Date();
    const clear = data['clear'];
    const name = data['name'];
    const pname = `${formatISO(d)} ${clear}.ogg`;
    const mname = `${formatISO(d)} ${clear}.meta.json`;
    stage.blob.arrayBuffer()
        .then((buffer) => {
            fs.writeFile(path.join(Config.journalPath, pname), Buffer.from(buffer), (err) => {
                if (err) console.log(err);
                else {
                    const tags = mainJournalList.activeJournals;
                    Record.createRecord(clear, name, tags, [pname])
                        .then((r) => {
                            db.addEntry_(r.path, r)
                            addRecord({
                                name: name,
                                internalName: mname,
                                ts: timestampFromName(mname)
                            });
                            reloadRecordList();
                        })
                        .catch(console.log);
                }
            });
        })
}

// Events

function addEntryEntry(e) {
    const li = document.createElement('li');

    const a = document.createElement('a');
    const delButton = document.createElement('button');
    delButton.className = 'delete-button';
    delButton.onclick = () => {
        requestDelete(db.files[e['internalName']]);
    }
    a.innerText = `${format(e['ts'], "hh:mm")}\t${e['name']}`;

    li.className = 'entry';
    a.className = 'entry-label';

    a.onclick = () => {
        stage.showStageWithRecord(e);
    }

    li.appendChild(a);
    li.appendChild(delButton);

    entryList.appendChild(li);
}

function addJournal(n) {
    Journal.createJournal(n).then((p) => {
        db.journals[p.path] = p;
        mainJournalList.addJournalEntry(p);
    });
}

journalTextField.addEventListener('keyup', (event) => {
    if (event.key === "Enter") {
        addJournal(journalTextField.value);
        journalTextField.value = "";
    }
});

function connectToSelectedInput() {
    if (audioDevices.value) {
        audioSelectFeedback.classList.remove('done');
        audioSelectFeedback.classList.add('loading');
        audioSelectFeedbackMessage.className = "";
        audioManager.selectAudioInput(audioDevices.value)
            .then(() => {
                audioSelectFeedbackMessage.className = "done";
                audioSelectFeedbackMessage.innerText = "Connected";
                audioSelectFeedback.classList.add('done');
                audioSelectFeedback.classList.remove('loading');
            })
            .catch((err) => {
                audioSelectFeedbackMessage.className = "error";
                audioSelectFeedbackMessage.innerText = err;
                audioSelectFeedback.classList.add('error');
                audioSelectFeedback.classList.remove('loading');
            })
    }
}

audioDevices.addEventListener('change', () => {
    connectToSelectedInput();
});

// Audio


function updateVolume() {
    requestAnimationFrame(updateVolume);

    spectrumCanvas.updateCanvas();
}

updateVolume();

let isFirstDeviceEnumeration = true;

async function updateAudioInputDeviceList() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    while (audioDevices.lastChild) {
        audioDevices.removeChild(audioDevices.firstChild);
    }
    let options = new Set();
    for (const device of devices) {
        if (device.kind !== 'audioinput') continue;
        const option = document.createElement('option');
        option.innerText = device.label;
        option.value = device.deviceId;
        options.add(device.deviceId);
        audioDevices.appendChild(option);
    }
    if (config.input && options.has(config.input)) {
        audioDevices.value = config.input;
    }
    if (isFirstDeviceEnumeration) {
        isFirstDeviceEnumeration = false;
        connectToSelectedInput();
    }
}

navigator.mediaDevices.ondevicechange = updateAudioInputDeviceList;
navigator.mediaDevices.enumerateDevices().then(updateAudioInputDeviceList).catch(console.log);

audioManager.onstaged = (b) => {stage.showStageWithBlob(b)};

audioManager.onstop = () => {
    audioStartPauseButton.className = "record";
    audioStopButton.setAttribute('disabled', '');
};

audioManager.onstart = () => {
    stage.setStageVisibility(false, false, false, false);
    audioStartPauseButton.className = "pause";
    audioStopButton.removeAttribute('disabled');
}
audioManager.onresume = () => {
    audioStartPauseButton.className = "pause";
}
audioManager.onpause = () => {
    audioStartPauseButton.className = "play";
}

Config.journalPath = ipcRenderer.sendSync('get-journal');
document.title = `media-journal -- ${Config.journalPath}`;
initDb();
