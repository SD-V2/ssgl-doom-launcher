import React, { useContext, useEffect, useRef, useState } from 'react';

import { Box, Flex } from '../components';
import { useDialog } from '../components/Dialog';
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
  useToast,
  useTranslation
} from '../utils';
import AnimatedView from './AnimatedView';

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
    style: settings.style
  });
  useEffect(() => {
    dispatch({
      type: 'settings/preview',
      data: {
        wallpaperDim: form.wallpaperDim,
        wallpaperBlur: form.wallpaperBlur,
        style: form.style
      }
    });
  }, [form.wallpaperDim, form.wallpaperBlur, form.style]);
  useEffect(
    () => () =>
      dispatch({
        type: 'settings/preview',
        data: {
          wallpaperDim: savedLook.current.dim,
          wallpaperBlur: savedLook.current.blur,
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
  const styleOptions = [
    { label: t('settings:styleClassic'), value: 'classic' },
    { label: t('settings:styleCyberpunk'), value: 'cyberpunk' }
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
          {/* <FormCollection title={t('settings:titleSound')}>
            <Checkbox
              value={form.soundActive}
              label={t('settings:soundActive')}
              name="soundActive"
              onChange={onComponent}
            />
            {form.soundActive ? (
              <Flex.Grid>
                <Flex.Col width="50%">
                  <Range
                    value={form.volume}
                    min="0"
                    max="1"
                    step="0.1"
                    name="volume"
                    label={'volume'}
                    onChange={onInput}
                    fluid
                  />
                  <SelectFile
                    name="soundModSelect"
                    onFile={onComponent}
                    label={t('settings:soundModSelect')}
                    value={form.soundModSelect}
                    fluid
                  />
                  <SelectFile
                    name="soundToastSuccess"
                    onFile={onComponent}
                    label={t('settings:soundToastSuccess')}
                    value={form.soundToastSuccess}
                    fluid
                  />
                </Flex.Col>
                <Flex.Col width="50%">
                  <SelectFile
                    name="soundDrawer"
                    onFile={onComponent}
                    label={t('settings:soundDrawer')}
                    value={form.soundDrawer}
                    fluid
                  />
                  <SelectFile
                    name="soundToastError"
                    onFile={onComponent}
                    label={t('settings:soundToastError')}
                    value={form.soundToastError}
                    fluid
                  />
                  <SelectFile
                    name="soundStart"
                    onFile={onComponent}
                    label={t('settings:soundStart')}
                    value={form.soundStart}
                    fluid
                  />
                </Flex.Col>
              </Flex.Grid>
            ) : null}
          </FormCollection> */}
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
