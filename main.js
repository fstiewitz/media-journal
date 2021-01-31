/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
const {app, BrowserWindow, ipcMain} = require('electron')
const fs = require('fs')
const path = require('path')
const process = require('process')
const yargs = require('yargs')
const {hideBin} = require('yargs/helpers')
const {ConfigManager} = require('./config');

const config = new ConfigManager();

const args = yargs(hideBin(process.argv))
    .help()
    .argv

function getFolder(args) {
    return args._[0];
}

let folder = getFolder(args);

if(folder) {
    fs.mkdirSync(folder, {recursive: true});
    console.log('opening journal in', folder);
}

let mainWin = null;
let selectWin = null;

function createWindow() {
    mainWin = new BrowserWindow({
        width: 1200,
        height: 800,
        //icon: 'icon/icon_48px.png',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWin.removeMenu();

    mainWin.loadFile('index.html')
}

function createSelectionWindow() {
    selectWin = new BrowserWindow({
        width: 400,
        height: 600,
        //icon: 'icon/icon_48px.png',
        webPreferences: {
            enableRemoteModule: true,
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    selectWin.removeMenu();

    selectWin.loadFile('select.html')
}

ipcMain.on('get-journal', (ev) => {
    ev.returnValue = folder;
})

ipcMain.on('collection-selected', (ev, f) => {
    folder = f;
    if(!folder) folder = path.join(app.getPath('userData'), 'default.journal');
    createWindow();
    if(selectWin) selectWin.close()
})

app.whenReady().then(() => {
    if(folder) createWindow();
    else createSelectionWindow();
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

