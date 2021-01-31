/*
 * Copyright (c) 2021 Fabian Stiewitz <fabian@stiewitz.pw>
 * Licensed under the terms of the EUPL-1.2
 */
class SpectrumCanvas {
    constructor(el, audio) {
        this.el = el;
        this.audio = audio;

        this.elContext = this.el.getContext('2d');
        this.elContext.clearRect(0, 0, this.el.width, this.el.height);

        this.sampleRate = audio.sampleRate;
        this.binCount = audio.freqData.length;
        this.canvasEndFreq = 10000;
        this.finalBinCount = Math.floor(this.binCount * (this.canvasEndFreq / (this.sampleRate / 2)));

        this.volumeCanvasGradient = this.elContext.createLinearGradient(0, 0, 0, this.el.height);
        this.volumeSize = (this.audio.analyser.maxDecibels - this.audio.analyser.minDecibels)
        this.volumeZero = this.audio.analyser.maxDecibels / this.volumeSize;

        this.resize();

        this.volumeCanvasGradient.addColorStop(0, 'rgb(255,0,0)');
        this.volumeCanvasGradient.addColorStop(this.volumeZero, 'rgb(255,255,0)');
        this.volumeCanvasGradient.addColorStop(this.volumeZero + 0.01, 'rgb(0,255,0)');
        this.volumeCanvasGradient.addColorStop(1, 'rgb(0,26,0)');

        this.el.lineWidth = 1;
        this.el.font = '12px sans-serif';

        this.markedFrequencies = [
            50,
            100,
            200,
            500,
            1000,
            2000,
            5000,
        ]

        this.alt_e = 0.001;
        this.log_scale = 1.05;
    }

    resize() {
        this.el.width = this.el.height * (this.el.clientWidth / this.el.clientHeight);
    }

    log(x) {
        return Math.log(x) / Math.log(this.alt_e);
    }

    freqYByBin(i, volumeData) {
        if(i === 0) return 0;
        const xr = (this.alt_e - 1) * this.log_scale * i / this.finalBinCount;
        const ix = this.log(1 + xr) * this.finalBinCount;
        return volumeData[Math.floor(ix)] / 255.0;
    }

    updateCanvas() {
        this.elContext.clearRect(0, 0, this.el.width, this.el.height);

        const volumeData = this.audio.getFrequencyData();

        const barWidth = this.el.width / this.finalBinCount;
        // Draw Guides

        this.elContext.strokeStyle = 'rgb(0, 0, 0)';
        this.elContext.fillStyle = 'rgb(0, 0, 0)';
        this.elContext.lineWidth = 1;
        for(const freq of this.markedFrequencies) {
            const f = freq / this.canvasEndFreq;
            const x = Math.floor(this.el.width * ((this.alt_e ** f - 1) / (this.alt_e - 1)) / this.log_scale) + 0.5;
            this.elContext.fillText(`${freq}`, x, 30);
            this.elContext.beginPath();
            this.elContext.moveTo(x, 40);
            this.elContext.lineTo(x, this.el.height);
            this.elContext.stroke();
        }

        // Draw Graph
        this.elContext.fillStyle = this.volumeCanvasGradient;
        this.elContext.beginPath()
        this.elContext.moveTo(0, this.el.height + 0.5);

        let posX = 0;
        for (let i = 0; i < this.finalBinCount; i++) {
            const y0 = this.el.height - this.freqYByBin(i, volumeData) * this.el.height;

            this.elContext.lineTo(Math.floor(posX + barWidth) + 0.5, Math.floor(y0) + 0.5);
            posX += barWidth;
        }

        this.elContext.lineTo(this.el.width, this.el.height);
        this.elContext.closePath()
        this.elContext.fill()
    }
}

module.exports = {
    SpectrumCanvas
}