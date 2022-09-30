import React, { useState, useEffect } from 'react';
import * as Tone from 'tone'

class AudioManager {
    constructor(channels, freq, bins, padding) {
        this.channels = channels
        this.bins = bins
        this.freq = freq
        this.padding = padding

        this.volume = 1;

        this.started = false;
        this.playing = false;
        this.startTime = 0;

        this.audioContext = new window.AudioContext();
        this.gain = this.audioContext.createGain();

        this.oscillators = []
        this.oscillatorGains = []
        for (let i = 0; i < bins; i++) {
            const osc = this.audioContext.createOscillator()
            const gain = this.audioContext.createGain()
            this.oscillators.push(osc)
            this.oscillatorGains.push(gain)
            osc.frequency.value = freq
            gain.gain.value = 0

            osc.connect(gain)
            gain.connect(this.gain)
        }

        this.gain.connect(this.audioContext.destination)
    }

    setVolume(vol) {
        this.volume = vol;
        if (this.playing) {
            this.gain.gain.value = this.volume;
        }
    }

    start() {
        if (!this.started) {
            this.started = true;
            for (let i = 0; i < this.bins; i++)
                this.oscillators[i].start(0);
        }
    }

    setImage(imageData) {
        const x_len = Math.floor(imageData.width / this.bins)
        const y_len = Math.floor(imageData.height / this.channels)
        for (let i = 0; i < this.bins; i++) {
            let real = [], imag = [];

            for (let j = 0; j < this.padding; j++) {
                real.push(0)
                imag.push(0)
            }

            for (let j = 0; j < this.channels; j++) {
                let avg = 0
                for (let y = j * y_len; y < (j + 1) * y_len; y++) {
                    for (let x = i * x_len; x < (i + 1) * x_len; x++) {
                        for (let a = 0; a < 3; a++) {
                            avg += imageData.data[4 * y * imageData.width + 4 * x + a] / 255;
                        }
                    }
                }
                avg = avg / (3 * x_len * y_len)

                real.push(Math.pow(avg, 2)/this.channels)
                imag.push(0)
            }

            this.oscillators[i].setPeriodicWave(this.audioContext.createPeriodicWave(real, imag, { disableNormalization: true }))
        }

        this.startTime = this.audioContext.currentTime + 1;
    }

    sonifyProgress(progress) {
        const current = Math.floor(progress*this.bins);
        const dist = progress*this.bins - current
        this.oscillatorGains[current].gain.value = dist;
        if (current < this.bins - 1)
            this.oscillatorGains[current + 1].gain.value = 1 - dist;
        if (current > 0)
            this.oscillatorGains[current - 1].gain.value = 0;
    }

    play() {
        this.start();
        this.playing = true;
        this.gain.gain.value = this.volume;
    }

    stop() {
        this.playing = false;
        this.gain.gain.value = 0;
        for (let i = 0; i < this.bins; i++) {
            this.oscillatorGains[i].gain.value = 0;
        }
    }
}

function drawLineAt(canvas, progress) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const x = canvas.width * progress;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
}

function resetCanvas(canvas) {
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const luminosityClasses = ['IV', 'V', 'III', 'II', '0', 'Iab', 'Ia', 'Ib']
const luminosityClassIndices = [6, 7, 5, 4, 0, 3, 1, 2]
const spectralClasses = ['O', 'B', 'A', 'F', 'G', 'K', 'M']

const notes = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'B#']
const note_vals = ['1n', '2n', '4n', '8n', '16n', '16n', '16n', '16n']

function parseSpectral(str) {
    let spectralClass = null;
    for (let i = 0; i < spectralClasses.length; i++) {
        if (spectralClasses[i] == str[0]) {
            spectralClass = i;
            break;
        }
    }

    let luminosityClass = null;
    for (let i = 0; i < luminosityClasses.length; i++) {
        if (str.search(luminosityClasses[i]) != -1) {
            luminosityClass = luminosityClassIndices[i];
            break;
        }
    }

    if (!luminosityClass) luminosityClass = 6;
    if (!spectralClass) spectralClass = 4;

    return {spectralClass, luminosityClass}
}

let audioManager = null;

function SweepLine(props) {
    let mag_limit = props.magLimit;

    async function getObjects(aladin, width, height, queue) {
        let objects = aladin.view.getObjectsInBBox(0, 0, width, height)
        for (let object of objects) {
            if (object.data['sp_type'].length > 0 && object.data['V'].length > 0) {
                if (parseFloat(object.data['V']) < mag_limit) {
                    let sp_type = parseSpectral(object.data['sp_type']);
                    queue.push([object.x, parseFloat(object.data['V']), sp_type])
                }
            }
        }
        queue.sort((a, b) => { return a[0] - b[0] })
    }

    async function startSonification(imageCanvas, audioManager, width, height) {
        audioManager.setImage(imageCanvas.getContext('2d').getImageData(0, 0, width,height))
        audioManager.play();
    }

    function to_val(mag) {
        if (mag < 1) return '4n';
        
        if (mag < 2) return '4n';
        if (mag < mag_limit/2) return '8n';
        if (mag < mag_limit/1.5) return '16n';
        return '16n';
    }

    function startSonificationLoop(aladin, canvas, setPlaying, audioManager, width, height, dampening, duration, loop) {
        canvas.classList.add("overlay-playing");
        let frameId;
        
        const n_synths = 20;
        let synths = []
        for (let i = 0; i < n_synths; i++) synths.push(new Tone.AMSynth().toDestination());

        let queue = []
        getObjects(aladin, width, height, queue)

        function loop() {
            if (audioManager.startTime < audioManager.audioContext.currentTime) {
                const progress = (audioManager.audioContext.currentTime - audioManager.startTime) / duration;
                if (progress < 1 && canvas) {
                    let x = progress * width;
                    if (queue.length > 0 && x >= queue[0][0]-5) {
                        let i = queue.length % n_synths;
                        let sp_type = queue[0][2]
                        let note = notes[6-sp_type.spectralClass] + (sp_type.luminosityClass);
                        let velocity = (queue[0][1] < 1) ? 1 : Math.pow(1/queue[0][1], dampening)
                        let note_val = to_val(queue[0][1]);// note_vals[sp_type.luminosityClass]
                        synths[i].triggerAttackRelease(note, note_val, Tone.now(), 0.5*velocity);
                        queue.shift();
                    }
                    
                    drawLineAt(canvas, progress)
                    audioManager.sonifyProgress(progress);
                } else if (progress > 1) {
                    if (loop) {
                        getObjects(aladin, width, height, queue)
                        audioManager.startTime = audioManager.audioContext.currentTime;
                    } else {
                        for (let i = 0; i < n_synths; i++) synths[i].dispose();
                        setPlaying(false)
                    }
                }
            }
            frameId = requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
        return () => {
            for (let i = 0; i < n_synths; i++) synths[i].dispose();
            cancelAnimationFrame(frameId);
        }
    }

    
        
    useEffect(() => {
        if (props.playing && props.canvas && props.imageCanvas) {
            if (! audioManager) {
                audioManager = new AudioManager(100, 50, 400, 0);
                audioManager.setVolume(props.volume);
            }
            console.log('starting')
            startSonification(props.imageCanvas, audioManager, props.width, props.height, props.aladin);
            return startSonificationLoop(props.aladin, props.canvas, props.setPlaying, audioManager, props.width, props.height, props.dampening, props.duration, props.loop);
        } else {
            console.log('stopping')
            if (audioManager) audioManager.stop();
            if (props.canvas) {
                resetCanvas(props.canvas);
                props.canvas.classList.remove("overlay-playing");
            }
        }
    }, [props.playing]);

    useEffect( () => {
        if (audioManager) {
            audioManager.setVolume(props.volume);
        }
    }, [props.volume])
    
    return (<></>);
}

export { SweepLine };