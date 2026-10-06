import React, { useContext, useState } from 'react';

import { Box, Flex } from '../components';
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
import cleanRepo from '../utils/cleanRepo';
import AnimatedView from './AnimatedView';

const Settings = () => {
  setTitle('settings');
  const { t } = useTranslation(['settings', 'common', 'nav']);
  const { gstate, dispatch } = useContext(StoreContext);
  const { settings } = gstate;
  const [form, setForm] = useState(settings);
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

    // "Look for updates at": a link or name/repository is turned into name/repository
    const typed = (form.updateRepo || '').trim();
    const repo = cleanRepo(typed);
    if (typed !== '' && repo === '') {
      toast('danger', t('common:error'), t('settings:updateRepoInvalid'));
      return;
    }

    if (!hasError) {
      if (repo !== form.updateRepo) setForm({ ...form, updateRepo: repo });
      const newSettings = await saveSettings('settings/save', {
        ...form,
        updateRepo: repo
      });
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
                <Input
                  name="updateRepo"
                  label={t('settings:updateRepo')}
                  value={form.updateRepo || ''}
                  placeholder="your-name/ssgl-doom-launcher"
                  onChange={onInput}
                  fluid
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
