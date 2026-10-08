import React, { useContext, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import { Box, Flex } from '../components';
import { useDialog } from '../components/Dialog';
import { markerOf } from '../components/Mods/Checkmarks';
import MarkerPicker from '../components/MarkerPicker';
import {
  Button,
  Checkbox,
  Dropdown,
  FormCollection,
  Input,
  Label,
  Range,
  SelectFile,
  SubmitArea
} from '../components/Form';
import i18n from '../i18n';
import { AVAILABLE_LOCALES } from '../locales';
import { StoreContext } from '../state';
import {
  setTitle,
  useHashLocation,
  useIpc,
  useSound,
  useToast,
  useTranslation
} from '../utils';
import AnimatedView from './AnimatedView';

// the Cursor effects group (Cyberpunk only): a thin accent line on its start side
const EffectsGroup = styled.div`
  border-inline-start: 2px solid ${({ theme }) => theme.color.active};
  padding-inline-start: 12px;
  margin-bottom: 15px;

  > label:first-child {
    margin-bottom: 8px;
  }
`;

const Settings = () => {
  setTitle('settings');
  const { t } = useTranslation(['settings', 'common', 'nav']);
  const { gstate, dispatch } = useContext(StoreContext);
  const dialog = useDialog();
  const { settings } = gstate;
  const [form, setForm] = useState(settings);

  // The wallpaper sliders show their effect at once. If you leave without saving,
  // the saved values come back.
  const savedLook = useRef({
    dim: settings.wallpaperDim,
    blur: settings.wallpaperBlur,
    fit: settings.wallpaperFit,
    marker: settings.marker,
    trail: settings.cursorTrail,
    click: settings.cursorClick,
    trailSize: settings.trailSize,
    trailLength: settings.trailLength,
    sound: settings.soundActive,
    volume: settings.volume,
    styleSounds: settings.styleSounds,
    style: settings.style
  });
  useEffect(() => {
    dispatch({
      type: 'settings/preview',
      data: {
        wallpaperDim: form.wallpaperDim,
        wallpaperBlur: form.wallpaperBlur,
        wallpaperFit: form.wallpaperFit,
        marker: form.marker,
        cursorTrail: form.cursorTrail,
        cursorClick: form.cursorClick,
        trailSize: form.trailSize,
        trailLength: form.trailLength,
        soundActive: form.soundActive,
        volume: form.volume,
        styleSounds: form.styleSounds,
        style: form.style
      }
    });
  }, [
    form.wallpaperDim,
    form.wallpaperBlur,
    form.wallpaperFit,
    form.marker,
    form.cursorTrail,
    form.cursorClick,
    form.trailSize,
    form.trailLength,
    form.soundActive,
    form.volume,
    form.styleSounds,
    form.style
  ]);
  useEffect(
    () => () =>
      dispatch({
        type: 'settings/preview',
        data: {
          wallpaperDim: savedLook.current.dim,
          wallpaperBlur: savedLook.current.blur,
          wallpaperFit: savedLook.current.fit,
          marker: savedLook.current.marker,
          cursorTrail: savedLook.current.trail,
          cursorClick: savedLook.current.click,
          trailSize: savedLook.current.trailSize,
          trailLength: savedLook.current.trailLength,
          soundActive: savedLook.current.sound,
          volume: savedLook.current.volume,
          styleSounds: savedLook.current.styleSounds,
          style: savedLook.current.style
        }
      }),
    []
  );
  const [errors, setError] = useState({});
  const [toast] = useToast();
  const [saveSettings] = useIpc();
  const [fetchInit, loadInit] = useIpc();
  // eslint-disable-next-line no-unused-vars
  const [loc, navigate] = useHashLocation();

  const notifyReleaseOptions = [
    { label: t('settings:notifyBeta'), value: 'beta' },
    { label: t('settings:notifyStable'), value: 'stable' },
    { label: t('settings:notifyOff'), value: 'off' }
  ];

  // how the menus look and feel (the color theme only decides the colors)
  // how the wallpaper is laid on the window
  const fitOptions = [
    { label: t('settings:wallpaperFitCover'), value: 'cover' },
    { label: t('settings:wallpaperFitContain'), value: 'contain' },
    { label: t('settings:wallpaperFitStretch'), value: 'stretch' }
  ];

  const styleOptions = [
    { label: t('settings:styleClassic'), value: 'classic' },
    { label: t('settings:styleCyberpunk'), value: 'cyberpunk' },
    { label: t('settings:styleGothic'), value: 'gothic' }
  ];

  const themeOptions = [
    {
      label: 'Hell',
      value: 'hell'
    },
    {
      label: 'UAC',
      value: 'uac'
    },
    {
      label: 'BFG',
      value: 'bfg'
    },
    {
      label: 'Slayer',
      value: 'slayer'
    },
    {
      label: 'Pinkie',
      value: 'pinkie'
    },
    { label: 'Plasma', value: 'plasma' },
    { label: 'Nightmare', value: 'nightmare' },
    { label: 'Lost Soul', value: 'lostsoul' },
    { label: 'Arch-Vile', value: 'archvile' },
    { label: 'Toxic', value: 'toxic' },
    { label: 'Berserk', value: 'berserk' },
    { label: 'Steel', value: 'steel' },
    { label: 'Neon', value: 'neon' },
    { label: 'Night City', value: 'nightcity' },
    { label: 'Blood Moon', value: 'bloodmoon' },
    { label: 'Custom color...', value: 'custom' }
  ];
  const viewOptions = [
    {
      label: t('nav:wads'),
      value: '/'
    },
    {
      label: t('nav:packages'),
      value: '/packages'
    }
  ];

  const sourceportOptions = gstate.sourceports.map(item => ({
    label: item.name,
    value: item.id
  }));

  const onComponent = ({ name, value }) => {
    setForm({
      ...form,
      [name]: value ? value : ''
    });
  };

  // choosing another style (or "match the style") gives a short sample of its sound -
  // after the new style is shown, so it already is the new sound
  const [play] = useSound();
  const playRef = useRef(play);
  playRef.current = play;
  const sampleFirst = useRef(true);
  useEffect(() => {
    if (sampleFirst.current) {
      sampleFirst.current = false;
      return undefined;
    }
    const id = setTimeout(() => playRef.current('soundModSelect'), 150);
    return () => clearTimeout(id);
  }, [form.style, form.styleSounds]);

  // sections back to how SSGL comes: names, explanations, words, your own and the
  // removed sections, the order, and the sections you picked by hand
  const onResetSections = async () => {
    const sure = await dialog.confirm({
      title: t('settings:sectionsResetTitle'),
      message: t('settings:sectionsResetMessage'),
      detail: t('settings:sectionsResetDetail'),
      confirmText: t('settings:sectionsResetConfirm'),
      cancelText: t('common:cancel'),
      danger: true
    });
    if (!sure) return;
    dispatch({ type: 'sections/reset' });
    toast('ok', t('common:success'), t('settings:sectionsResetDone'));
  };

  const onInput = e => {
    const { name, value } = e.currentTarget;
    setForm({
      ...form,
      [name]: value
    });
  };
  const validate = () => {
    const fields = ['modpath', 'savepath', 'obligeBinary', 'obligeConfigPath'];

    let temp = {};
    let hasError = false;

    fields
      .filter(field => (form.obligeActive ? true : field.indexOf('oblige') < 0))
      .forEach(field => {
        if (!form[field] || form[field].trim() === '') {
          hasError = true;
          temp = {
            ...temp,
            [field]: t('common:required')
          };
        } else {
          temp = {
            ...temp,
            [field]: null
          };
        }
      });

    setError(temp);

    return hasError;
  };

  const onSubmit = async e => {
    e.preventDefault();
    const hasError = validate();

    if (!hasError) {
      const newSettings = await saveSettings('settings/save', form);
      // what is saved now is what comes back when the sliders are left unsaved later
      savedLook.current = {
        dim: form.wallpaperDim,
        blur: form.wallpaperBlur,
        fit: form.wallpaperFit,
        marker: form.marker,
        trail: form.cursorTrail,
        click: form.cursorClick,
        trailSize: form.trailSize,
        trailLength: form.trailLength,
        sound: form.soundActive,
        volume: form.volume,
        styleSounds: form.styleSounds,
        style: form.style
      };
      dispatch({ type: 'settings/save', data: newSettings });

      const newState = await fetchInit('main/init', null);
      dispatch({ type: 'main/init', data: newState });
      i18n.changeLanguage(newState.settings.language);
      toast('ok', t('common:success'), t('settings:toastSaved'));
      if (gstate.sourceports.length < 1) {
        navigate('/sourceports');
      }
    } else {
      toast('danger', t('common:error'), t('common:toastRequired'));
    }
  };

  return (
    <AnimatedView>
      <Box>
        <form onSubmit={onSubmit}>
          <FormCollection title={t('settings:titleDirectories')}>
            <Flex.Grid>
              <Flex.Col width="50%">
                <SelectFile
                  name="modpath"
                  onFile={onComponent}
                  label={t('settings:waddir')}
                  value={form.modpath}
                  error={errors.modpath}
                  directory
                  info="https://github.com/FreaKzero/ssgl-doom-launcher/wiki/SSGL---First-Setup#wad-directory-required"
                  fluid
                />
                <SelectFile
                  name="mappath"
                  onFile={onComponent}
                  label={t('settings:mapdir')}
                  value={form.mappath || ''}
                  directory
                  fluid
                />
              </Flex.Col>
              <Flex.Col width="50%">
                <SelectFile
                  name="savepath"
                  onFile={onComponent}
                  label={t('settings:savepath')}
                  value={form.savepath}
                  error={errors.savepath}
                  directory
                  info="https://github.com/FreaKzero/ssgl-doom-launcher/wiki/SSGL---First-Setup#ssgl-data-directory-required"
                  fluid
                />
              </Flex.Col>
            </Flex.Grid>
            <Checkbox
              value={form.autoRefresh}
              label={t('settings:autoRefresh')}
              name="autoRefresh"
              onChange={onComponent}
            />
            <Input
              name="importFolder"
              label={t('settings:importFolder')}
              value={form.importFolder || ''}
              placeholder="Added via Explorer"
              onChange={onInput}
              fluid
            />
          </FormCollection>

          <FormCollection title={t('settings:titleCustomization')}>
            <Flex.Grid>
              <Flex.Col width="50%">
                <SelectFile
                  name="background"
                  onFile={onComponent}
                  label={t('settings:wallpaper')}
                  value={form.background}
                  fluid
                />
                <Dropdown
                  name="wallpaperFit"
                  options={fitOptions}
                  label={t('settings:wallpaperFit')}
                  value={form.wallpaperFit || 'cover'}
                  onChange={onComponent}
                />
                <Range
                  value={form.wallpaperDim || 0}
                  min="0"
                  max="80"
                  step="5"
                  name="wallpaperDim"
                  label={t('settings:wallpaperDim')}
                  onChange={onInput}
                  fluid
                />
                <Range
                  value={form.wallpaperBlur || 0}
                  min="0"
                  max="12"
                  step="1"
                  name="wallpaperBlur"
                  label={t('settings:wallpaperBlur')}
                  onChange={onInput}
                  fluid
                />
                <Checkbox
                  value={form.hideWhilePlaying}
                  label={t('settings:hideWhilePlaying')}
                  name="hideWhilePlaying"
                  onChange={onComponent}
                />
                <Checkbox
                  value={form.compactList}
                  label={t('settings:compactList')}
                  name="compactList"
                  onChange={onComponent}
                />
                <Dropdown
                  name="language"
                  options={AVAILABLE_LOCALES}
                  label={t('common:language')}
                  value={form.language}
                  onChange={onComponent}
                />
                <div>
                  <Label>{t('settings:sectionsLabel')}</Label>
                </div>
                <div style={{ marginBottom: '15px' }}>
                  <Button
                    type="button"
                    width="auto"
                    border="#f55945"
                    glow="#b8342a"
                    color="#ff2f00"
                    style={{ margin: 0 }}
                    onClick={onResetSections}
                  >
                    {t('settings:sectionsResetButton')}
                  </Button>
                </div>
                {gstate.packages.length > 0 ? (
                  <Dropdown
                    name="startView"
                    options={viewOptions}
                    label={t('settings:startView')}
                    value={form.startView}
                    onChange={onComponent}
                  />
                ) : null}
              </Flex.Col>
              <Flex.Col width="50%">
                <Dropdown
                  name="theme"
                  options={themeOptions}
                  label={t('settings:colorTheme')}
                  value={form.theme}
                  onChange={onComponent}
                />
                {form.theme === 'custom' ? (
                  <>
                    <Label>{t('settings:accentColor')}</Label>
                    <input
                      type="color"
                      name="accent"
                      value={form.accent || '#ff7a00'}
                      onChange={onInput}
                      style={{
                        width: '100%',
                        height: '38px',
                        marginBottom: '15px',
                        cursor: 'pointer',
                        background: 'transparent',
                        border: 'none'
                      }}
                    />
                  </>
                ) : null}
                <Dropdown
                  name="style"
                  options={styleOptions}
                  label={t('settings:interfaceStyle')}
                  value={form.style || 'classic'}
                  onChange={onComponent}
                />
                {form.style === 'cyberpunk' ? (
                  <EffectsGroup className="ssgl-cursor-effects">
                    <Label>{t('settings:cursorEffects')}</Label>
                    <Checkbox
                      value={form.cursorTrail === undefined ? true : form.cursorTrail}
                      label={t('settings:cursorTrail')}
                      name="cursorTrail"
                      onChange={onComponent}
                    />
                    {form.cursorTrail === undefined || form.cursorTrail ? (
                      <>
                        <Range
                          value={form.trailSize === undefined ? 100 : form.trailSize}
                          min="50"
                          max="200"
                          step="10"
                          name="trailSize"
                          label={t('settings:trailSize')}
                          onChange={onInput}
                          fluid
                        />
                        <Range
                          value={form.trailLength === undefined ? 100 : form.trailLength}
                          min="50"
                          max="200"
                          step="10"
                          name="trailLength"
                          label={t('settings:trailLength')}
                          onChange={onInput}
                          fluid
                        />
                      </>
                    ) : null}
                    <Checkbox
                      value={form.cursorClick === undefined ? true : form.cursorClick}
                      label={t('settings:cursorClick')}
                      name="cursorClick"
                      onChange={onComponent}
                    />
                  </EffectsGroup>
                ) : null}
                <Label>{t('settings:marker')}</Label>
                <MarkerPicker
                  value={form.marker || 'auto'}
                  onChange={onComponent}
                  colorTheme={form.theme}
                  autoMarker={markerOf({
                    theme: form.theme,
                    style: form.style
                  })}
                  autoLabel={t('settings:markerAuto')}
                  names={{
                    hell: t('settings:markerHell'),
                    uac: t('settings:markerUac'),
                    bfg: t('settings:markerBfg'),
                    pinkie: t('settings:markerPinkie'),
                    slayer: t('settings:markerSlayer'),
                    target: t('settings:markerTarget'),
                    chip: t('settings:markerChip'),
                    bolt: t('settings:markerBolt'),
                    cross: t('settings:markerCross'),
                    rose: t('settings:markerRose'),
                    arch: t('settings:markerArch'),
                    christmas: t('settings:markerChristmas'),
                    halloween: t('settings:markerHalloween'),
                    ramadan: t('settings:markerRamadan'),
                    eid: t('settings:markerEid')
                  }}
                />
                {gstate.sourceports.length > 0 ? (
                  <Dropdown
                    name="defaultsourceport"
                    options={sourceportOptions}
                    label={t('settings:favouriteSourceport')}
                    value={form.defaultsourceport}
                    onChange={onComponent}
                    error={errors.defaultsourceport}
                  />
                ) : null}
                <Dropdown
                  name="notifyRelease"
                  options={notifyReleaseOptions}
                  label={t('settings:notifyRelease')}
                  value={form.notifyRelease}
                  onChange={onComponent}
                />
              </Flex.Col>
            </Flex.Grid>
          </FormCollection>

          <FormCollection title={t('settings:titleOblige')}>
            <Checkbox
              value={form.obligeActive}
              label={t('settings:obligeActive')}
              name="obligeActive"
              onChange={onComponent}
              info="https://github.com/FreaKzero/ssgl-doom-launcher/wiki/SSGL---First-Setup#oblige-integration"
            />
            {form.obligeActive ? (
              <Flex.Grid>
                <Flex.Col width="50%">
                  <SelectFile
                    name="obligeBinary"
                    onFile={onComponent}
                    label={t('settings:obligeBinary')}
                    value={form.obligeBinary}
                    error={errors.obligeBinary}
                    info="https://github.com/FreaKzero/ssgl-doom-launcher/wiki/SSGL---First-Setup#oblige-binary"
                    fluid
                  />
                </Flex.Col>
                <Flex.Col width="50%">
                  <SelectFile
                    name="obligeConfigPath"
                    onFile={onComponent}
                    label={t('settings:obligeConfigPath')}
                    value={form.obligeConfigPath}
                    error={errors.obligeConfigPath}
                    info="https://github.com/FreaKzero/ssgl-doom-launcher/wiki/SSGL---First-Setup#oblige-build-configs"
                    directory
                    fluid
                  />
                </Flex.Col>
              </Flex.Grid>
            ) : null}
          </FormCollection>
          <FormCollection title={t('settings:titleSound')}>
            <Checkbox
              value={form.soundActive}
              label={t('settings:soundActive')}
              name="soundActive"
              onChange={onComponent}
            />
            {form.soundActive ? (
              <>
                <Range
                  value={form.volume === undefined ? 0.5 : form.volume}
                  min="0"
                  max="1"
                  step="0.1"
                  name="volume"
                  label={t('settings:volume')}
                  onChange={onInput}
                  fluid
                />
                <Checkbox
                  value={form.styleSounds === undefined ? true : form.styleSounds}
                  label={t('settings:styleSounds')}
                  name="styleSounds"
                  onChange={onComponent}
                />
              </>
            ) : null}
          </FormCollection>
          <SubmitArea>
            <Button type="submit" load={loadInit} width="200px">
              {t('settings:save')}
            </Button>
          </SubmitArea>
        </form>
      </Box>
    </AnimatedView>
  );
};

export default Settings;
