/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
class AudioManager {
    constructor(config) {
        this.config = config;
        this.context = new AudioContext();
        this.analyser = this.context.createAnalyser();
        this.analyser.maxDecibels = 10;
        this.analyser.minDecibels = -100;
        this.analyser.fftSize = 4096;

        this.inputStream = null;
        this.inputNode = null;

        this.recorder = null;
        this.currentChunks = [];
        this.stagedBlob = null;

        this.onstart = null;
        this.onpause = null;
        this.onresume = null;
        this.onstop = null;

        this.onstaged = null;

        this.volumeData = new Uint8Array(this.analyser.fftSize);
        this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    get sampleRate() {
        return this.context.sampleRate;
    }

    getVolume() {
        let volumeResult = 0.0;
        for (const x of this.freqData) {
            volumeResult = Math.max(volumeResult, x);
        }
        return volumeResult / 255.0;
    }

    getFrequencyData() {
        this.analyser.getByteFrequencyData(this.freqData);
        return this.freqData;
    }

    selectAudioInput(id) {
        return navigator.mediaDevices.getUserMedia({
            audio: {
                deviceId: id
            }
        })
            .then((localMediaStream) => {
                if (this.inputNode) this.inputNode.disconnect();
                if (this.recorder) {
                    this.abortRecording();
                }
                this.inputNode = this.context.createMediaStreamSource(localMediaStream);
                this.inputStream = localMediaStream;
                this.inputNode.connect(this.analyser);

                this.config.input = id;
                console.log('connected to audio input', id);
            }).catch((err) => {
                console.log(err);
            });
    }

    startRecording() {
        this.recorder = new MediaRecorder(this.inputStream);
        this.recorder.ondataavailable = (e) => this.currentChunks.push(e.data);
        this.recorder.onstop = (e) => {
            const blob = new Blob(this.currentChunks, {type: 'audio/ogg; codecs=opus'})
            this.currentChunks = [];
            this.setStageBlob(blob);
            this.recorder = null;
            if(this.onstop) this.onstop();
        };
        this.recorder.onstart = (e) => {
            if(this.onstart) this.onstart();
        }
        this.recorder.onresume = (e) => {
            if(this.onresume) this.onresume();
        }
        this.recorder.onpause = (e) => {
            if(this.onpause) this.onpause();
        }
        this.recorder.start();
    }
    pauseRecording() {
        if (this.recorder.state === 'recording') this.recorder.pause();
        else this.recorder.resume();
    }
    stopRecording() {
        this.recorder.stop();
    }
    setStageBlob(b) {
        this.stagedBlob = b;
        if(this.onstaged && b) this.onstaged(this.stagedBlob);
    }
}

module.exports = {
    AudioManager
}
