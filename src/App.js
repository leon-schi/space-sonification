import logo from './logo.svg';
import './App.css';

import React, { useState, useEffect } from 'react';
import { SweepLine } from './Vis'
import Slider from '@mui/material/Slider';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import InfoIcon from '@mui/icons-material/Info';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

import FormGroup from '@mui/material/FormGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';

let magLimit = 5

function App() {
  const width = 800, height = 800;
  const [lineCanvas, setLineCanvas] = useState(null);
  const [imageCanvas, setImageCanvas] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [_aladin, setAladin] = useState(null)
  const [_hips, setHips] = useState(null)
  const [_magLimit, setMagLimit] = useState(magLimit)
  const [volume, setVolume] = useState(1);
  const [dampening, setDampening] = useState(1);
  const [duration, setDuration] = useState(30);
  const [loop, setLoop] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  function init() {
    console.log("initing")
    /*global A*/
    const style = "width:" + width + "px; height: " + height + "px"
    document.getElementById("aladin-lite-div").setAttribute("style", style);
    document.getElementById("container").setAttribute("style", style);

    const filter = function (source) {
      var V = parseFloat(source.data['V']);
      if (isNaN(V) && source.data['sp_type']) {
        return false;
      }
      return V <= magLimit;
    }

    let aladin = A.aladin('#aladin-lite-div', { survey: "P/DSS2/color", fov: 60 })
    var hips = A.catalogHiPS('https://axel.u-strasbg.fr/HiPSCatService/Simbad', { onClick: 'showTable', name: 'Simbad', filter: filter });
    aladin.addCatalog(hips);
    setAladin(aladin);
    setHips(hips)

    if (document.getElementById("overlay") == null) {
      const canvas = document.createElement("canvas")
      canvas.setAttribute("class", "overlay");
      canvas.setAttribute("width", width);
      canvas.setAttribute("height", height);
      canvas.setAttribute("id", "overlay");
      console.log(document.getElementsByClassName("aladin-reticleCanvas"))

      let parent = document.getElementById("aladin-lite-div")
      let reticleCanvas = document.getElementsByClassName("aladin-reticleCanvas")[0]
      parent.insertBefore(canvas, reticleCanvas)

      setLineCanvas(canvas);
    }

    setImageCanvas(document.getElementsByClassName("aladin-imageCanvas")[0]);
  }

  function togglePlay() {
    setPlaying(!playing);
  }

  useEffect(() => {
    init();
  }, [])

  useEffect(() => {
    console.log(_aladin)
  }, [playing])

  function handleChange(event, newValue) {
    magLimit = newValue
    setMagLimit(newValue)
    if (_hips) {
      _hips.reportChange();
    }
  }

  function handleBackgroundVolChange(event, newValue) {
    setVolume(newValue)
  }

  function handleCloseDialog() {
    setDialogOpen(false);
  }

  function openDialog() {
    setDialogOpen(true);
  }

  function handleDampening(event, newValue) {
    setDampening(newValue);
  }

  function handleDuration(event, newValue) {
    setDuration(newValue);
  }

  function handleLoopChange(event) {
    setLoop(event.target.checked);
  }

  return (
    <>
      <div className="spacer" />

      <div className="container-fluid">
        <div className="row">
          <div className="col">
            <div id="container" className="aladin-container">
              <div id="aladin-lite-div"></div>
              <SweepLine
                loop={loop}
                duration={duration}
                dampening={dampening}
                volume={volume}
                aladin={_aladin}
                setPlaying={setPlaying}
                playing={playing}
                canvas={lineCanvas}
                imageCanvas={imageCanvas}
                width={width}
                height={height}
                magLimit={_magLimit} />
            </div>
          </div>
          <div className="col m-auto">
            <div>
              <Stack direction="row" style={{ justifyContent: 'center', marginTop: '50px' }} spacing={2}>
                <Button onClick={togglePlay} variant="contained">{playing ? "Stop" : "Play"}</Button>
              </Stack>
              <Box width={800} style={{ margin: 'auto', marginTop: '50px' }}>
                <Stack direction="row" spacing={2}>
                  <h6 className='heading'> Sonify Objects with Apparent Maginitude below (Adjust Light Pollution Level) </h6>
                  <IconButton aria-label="delete" onClick={openDialog}>
                    <InfoIcon sx={{ color: 'white' }} />
                  </IconButton>
                </Stack>
                <Slider
                  onChange={handleChange}
                  defaultValue={3}
                  max={30}
                  step={0.1}
                  aria-label="Small"
                  valueLabelDisplay="auto"
                />
                <h6 className='heading'> Adjust Background Image Volume </h6>
                <Slider
                  onChange={handleBackgroundVolChange}
                  defaultValue={1}
                  max={1}
                  step={0.01}
                  aria-label="Small"
                  valueLabelDisplay="auto"
                />
                <h6 className='heading'> Dampening </h6>
                <Slider
                  onChange={handleDampening}
                  defaultValue={2}
                  min={1}
                  max={3}
                  step={0.01}
                  aria-label="Small"
                  valueLabelDisplay="auto"
                />
                <h6 className='heading'> Duration </h6>
                <Slider
                  onChange={handleDuration}
                  defaultValue={30}
                  min={30}
                  max={120}
                  step={1}
                  aria-label="Small"
                  valueLabelDisplay="auto"
                />
                <FormControlLabel control={<Checkbox checked={loop} onChange={handleLoopChange} />} label="Loop" style={{color: 'white'}}/>
              </Box>
            </div>
          </div>
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}>
        <DialogTitle id="alert-dialog-title">
          What is the Apparent Maginitude of a Star and what does it have to do with Light Pollution?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            The apparent maginitude of a star measures its brightness as seen from earth. It is measured in units of maginitude, whereby a lower magnitude indicates a higher brightness (e.g. the sun has an apparent magnitude of -27). The scale is further logarithmic such that each step in magnitude corresponds to a change in brightness of about 2.512. That is, a maginitude 1 star is about 2.512 times brighter than a magnitude 2 star and so on.

            In a strongly light polluted area, only those stars with lowest apparent magnitudes can be seen with the naked eye. As light pollution vanishes, more and more of the higher magnitude stars can be seen. Increasing the threshold on the slider thus corresponds to lowering the level of light pollution in the sonification.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default App;
