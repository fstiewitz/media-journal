/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const path = require('path');
const Config = require('./config');
const {JournalList} = require('./journal');

class Stage {
    constructor(config, db) {
        this.config = config;
        this.db = db;

        this.onconfirm = null;

        this.stagedBlob = null;
        this.currentlyStagedRecord = null;

        this.stageContainer = document.getElementById('stage-container');
        this.stageAudio = document.getElementById('stage-audio');
        this.stageNameInput = document.getElementById('record-text-add');
        this.stageNameLabel = document.getElementById('record-text');
        this.stageConfirm = document.getElementById('stage-confirm');
        this.stageDiscard = document.getElementById('stage-discard');

        this.stageJournalsEdit = document.getElementById('stage-journals-edit');
        this.stageJournalsContainer = document.getElementById('stage-journals-container');
        this.stageJournalsList = new JournalList(document.getElementById('stage-journals-list'), this, false, false);
        this.stageJournalsLabel = document.getElementById('stage-journals-label');

        this.stageStartButton = document.getElementById('stage-start-button');
        this.volumeMuteButton = document.getElementById('volume-mute-button');
        this.volumeSlider = document.getElementById('stage-volume-slider');

        let t = this;
        this.editDb = new (class EditDelegate {
            get journals() {
                return t.db.journals;
            }
        })();

        this.editJournalList = new JournalList(document.getElementById('edit-record-journal-list'), this.editDb, false, true);
        this.editJournalListPopup = document.getElementById('edit-record-journal-popup');
        this.editJournalListConfirm = document.getElementById('edit-record-journal-confirm');
        this.editJournalListCancel = document.getElementById('edit-record-journal-cancel');

        this.stageJournalsEdit.onclick = () => {
            this.editJournalList.journalStates = Object.fromEntries(Object.keys(this.db.journals).map((x) => [x, this.db.files[this.currentlyStagedRecord].tags.has(x)]));
            console.log(this.editJournalList.journalStates);
            this.editJournalList.reload(false);
            this.editJournalListPopup.classList.remove('hidden');
        }

        this.editJournalListCancel.onclick = () => {
            this.editJournalListPopup.classList.add('hidden');
        }

        this.editJournalListConfirm.onclick = () => {
            const record = this.db.files[this.currentlyStagedRecord];
            record.tags = this.editJournalList.activeJournals;
            record.save().then(() => {
                this.stageJournalsList.reload();
                this.editJournalListPopup.classList.add('hidden');
            });
        }

        this.setVolume(this.config.volume);

        this.stageAudio.onended = () => {
            this.stageStartButton.className = 'play';
        }

        this.stageStartButton.onclick = () => {
            if (this.stageAudio.paused || !this.stageAudio.played.length) {
                this.stageStartButton.className = 'pause';
                this.stageAudio.play();
            } else {
                this.stageStartButton.className = 'play';
                this.stageAudio.pause();
            }
        }

        this.volumeSlider.oninput = () => {
            this.config.volume = this.volumeSlider.value;
            this.stageAudio.volume = this.config.volume;
        }

        this.volumeMuteButton.onclick = () => {
            if (this.volumeMuteButton.classList.contains("vol")) {
                this.muteVolume();
            } else {
                this.restoreVolume();
            }
        }
        this.stageConfirm.onclick = () => {
            if(this.onconfirm) this.onconfirm();
        }

        this.stageDiscard.onclick = () => {
            this.stagedBlob = null;
            this.hideStage();
        }

        this.stageNameInput.onkeyup = (e) => {
            if (e.key === 'Enter') {
                if(this.onconfirm) this.onconfirm();
            }
        }

    }

    get journals() {
        if (!this.currentlyStagedRecord) return {};
        let j = {};
        for(const t of this.db.files[this.currentlyStagedRecord].tags) {
            j[t] = this.db.journals[t];
        }
        return j;
    }


    get blob() {
        return this.stagedBlob;
    }

    get stagedRecord() {
        return this.currentlyStagedRecord;
    }

    set stagedRecord(s) {
        this.currentlyStagedRecord = s;
        if(this.currentlyStagedRecord) this.stageJournalsList.reload();
    }

    setVolume(x) {
        this.volumeSlider.value = x;
        this.stageAudio.volume = x;
    }

    muteVolume() {
        this.volumeMuteButton.classList.remove('vol');
        this.volumeMuteButton.classList.add('muted');
        this.volumeSlider.disabled = true;

        this.setVolume(0);
    }

    restoreVolume() {
        this.volumeMuteButton.classList.add('vol');
        this.volumeMuteButton.classList.remove('muted');
        this.volumeSlider.disabled = false;

        this.setVolume(this.config.positiveVolume);
    }

    showStageWithBlob(b) {
        this.stagedBlob = b;
        this.stageAudio.src = URL.createObjectURL(this.stagedBlob);
        this.currentlyStagedRecord = null;
        this.stageAudio.load();

        this.stageContainer.classList.remove('hidden');

        this.stageNameInput.value = "Recording";
        this.stageNameInput.classList.remove('hidden');
        this.stageNameLabel.classList.add('hidden');

        this.stageConfirm.classList.remove('hidden');
        this.stageDiscard.classList.remove('hidden');

        this.stageNameInput.focus();
        this.stageNameInput.select();

    }

    setStageVisibility(stage = false, label = false, input = false, buttons = false, journalsList = false) {
        if(stage) this.stageContainer.classList.remove('hidden');
        else this.stageContainer.classList.add('hidden');

        if(label) this.stageNameLabel.classList.remove('hidden');
        else this.stageNameLabel.classList.add('hidden');

        if(input) this.stageNameInput.classList.remove('hidden');
        else this.stageNameInput.classList.add('hidden');

        if(buttons) {
            this.stageConfirm.classList.remove('hidden');
            this.stageDiscard.classList.remove('hidden');
        } else {
            this.stageConfirm.classList.add('hidden');
            this.stageDiscard.classList.add('hidden');
        }

        if(journalsList) this.stageJournalsContainer.classList.remove('hidden');
        else this.stageJournalsContainer.classList.add('hidden');
    }

    showStageWithRecord(e) {
        const audio = db.files[e['internalName']].audio;
        if (this.currentlyStagedRecord === e['internalName']) return;
        this.currentlyStagedRecord = e['internalName'];
        if(db.files[e['internalName']].tags.size) {
            this.stageJournalsLabel.innerText = "Journals";
        } else {
            this.stageJournalsLabel.innerText = "No Journals";
        }
        this.stageJournalsList.reload();
        this.stagedBlob = null;
        this.stageAudio.src = encodeURI(`file://${path.resolve(path.join(Config.journalPath, audio))}`);
        this.stageAudio.load();

        this.stageNameLabel.innerText = e['name'];
        this.setStageVisibility(true, true, false, false, true);
    }

    hideStage() {
        this.setStageVisibility();
    }

    saveStage() {
        if (!this.stagedBlob) return;
        let name = this.stageNameInput.value;
        let clear = this.stageNameInput.value.replace(/\W/, "-");
        if (clear.length === 0) {
            name = "Recording";
            clear = "Recording";
        }
        this.stageNameLabel.innerText = clear;

        this.setStageVisibility(true, true, false, false);

        return {
            name, clear
        }
    }
}

module.exports = {Stage}