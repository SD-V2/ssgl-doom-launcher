import PropTypes from 'prop-types';
import React, { useContext } from 'react';

import click from '../../assets/sounds/click.ogg';
import cyberDrawer from '../../assets/sounds/cyberpunk-drawer.ogg';
import cyberError from '../../assets/sounds/cyberpunk-error.ogg';
import cyberSelect from '../../assets/sounds/cyberpunk-modselect.ogg';
import cyberStart from '../../assets/sounds/cyberpunk-start.ogg';
import cyberSuccess from '../../assets/sounds/cyberpunk-success.ogg';
import gothDrawer from '../../assets/sounds/gothic-drawer.ogg';
import gothError from '../../assets/sounds/gothic-error.ogg';
import gothSelect from '../../assets/sounds/gothic-modselect.ogg';
import gothStart from '../../assets/sounds/gothic-start.ogg';
import gothSuccess from '../../assets/sounds/gothic-success.ogg';
import { StoreContext } from '../../state';
import AudioContext from './AudioContext';

// The sounds of the five events. The classic ones are all the same click; every
// interface style has a set of its own (made for SSGL): digital beeps for Cyberpunk,
// stone and bells for Gothic.
export const SOUND_PACKS = {
  classic: {
    soundStart: click,
    soundDrawer: click,
    soundModSelect: click,
    soundToastSuccess: click,
    soundToastError: click
  },
  cyberpunk: {
    soundStart: cyberStart,
    soundDrawer: cyberDrawer,
    soundModSelect: cyberSelect,
    soundToastSuccess: cyberSuccess,
    soundToastError: cyberError
  },
  gothic: {
    soundStart: gothStart,
    soundDrawer: gothDrawer,
    soundModSelect: gothSelect,
    soundToastSuccess: gothSuccess,
    soundToastError: gothError
  }
};

// the set in use: the one of the interface style, unless "match the style" is off
export const soundsFor = settings => {
  // not saved yet = on; the Settings form saves an unticked box as ''
  const matchStyle =
    settings.styleSounds === undefined ? true : !!settings.styleSounds;
  return (matchStyle && SOUND_PACKS[settings.style]) || SOUND_PACKS.classic;
};

const AudioProvider = ({ children }) => {
  const { gstate } = useContext(StoreContext);
  const play = name => {
    if (!gstate.settings.soundActive) {
      return;
    }

    // a sound file chosen by hand for this event always wins
    if (gstate.settings[name] && gstate.settings[name].trim() !== '') {
      try {
        const a = new Audio(`file://${gstate.settings[name]}`);
        a.volume = gstate.settings.volume;
        a.play();
      } catch (e) {
        console.log(e);
      }
    } else {
      try {
        const a = new Audio(soundsFor(gstate.settings)[name]);
        a.volume = gstate.settings.volume;
        a.play();
      } catch (e) {
        console.log(e);
      }
    }
  };

  return (
    <AudioContext.Provider value={{ play }}>{children}</AudioContext.Provider>
  );
};

AudioProvider.propTypes = {
  children: PropTypes.any
};

export default AudioProvider;
