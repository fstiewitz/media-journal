/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const {ipcRenderer} = require('electron');
const {dialog} = require('electron').remote;
const Config = require('./config');

const config = new Config.ConfigManager();

const Collection = document.getElementById('collection-list');

document.getElementById('new-collection-select').onclick = () => {
    dialog.showOpenDialog({
        title: "Select Collection Folder",
        properties: ["openDirectory", "createDirectory", "promptToCreate"]
    }).then((result) => {
        if(result['canceled']) return;
        const filePaths = result['filePaths'];
        const collections = config.collections;
        collections.add(filePaths[0]);
        config.collections = collections;
        ipcRenderer.send('collection-selected', filePaths[0]);
    })
}

document.getElementById('default-collection-select').onclick = () => {
    ipcRenderer.send('collection-selected', null);
}

for(const collection of config.collections) {
    addCollectionEntry(collection);
}

function addCollectionEntry(collection) {
    const li = document.createElement('li');
    const a = document.createElement('a');
    const btn = document.createElement('button');
    btn.className = 'delete-button';
    btn.onclick = () => {
        const collections = config.collections;
        collections.delete(collection);
        config.collections = collections;
        Collection.removeChild(li);
    }
    li.className = 'collection collection-entry';
    a.innerText = collection;
    a.onclick = () => {
        ipcRenderer.send('collection-selected', collection);
    }
    li.appendChild(a);
    li.appendChild(btn);
    Collection.insertBefore(li, Collection.firstElementChild);
}

