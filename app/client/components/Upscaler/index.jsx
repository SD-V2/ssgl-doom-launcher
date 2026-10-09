import { ipcRenderer } from 'electron';
import PropTypes from 'prop-types';
import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';

import { StoreContext } from '../../state';
import { useToast, useTranslation } from '../../utils';
import { openExternal, showOpenDialog } from '../../utils/native';
import {
  DEFAULT_GROUPS,
  destChoices,
  formatBytes,
  formatTime,
  groupCounts,
  groupsToKinds,
  isBusy,
  kindsToGroups,
  megapixels,
  modNameOf,
  pickDestFolder,
  resultFileName,
  scaleFor
} from '../../utils/upscale';
import Box from '../Box';
import { useDialog } from '../Dialog';
import Flex from '../Flex';
import { Button, Checkbox, Dropdown } from '../Form';
import Compare from './Compare';
import { Bar, Buttons, Greyed, Heading, Kinds, Note, Notice, Part, Path } from './parts';
import { useShowNewMod } from './Watcher';

// Tools > Upscaler. The work itself happens in the main part (electron/handlers/
// upscaler.js); this screen asks, shows and starts. A running job goes on when you
// leave the screen; coming back shows it again.

const call = async (channel, data) => {
  const res = await ipcRenderer.invoke(channel, data);
  if (!res || res.error) {
    const err = new Error((res && res.error) || 'failed');
    err.code = (res && res.error) || 'failed';
    throw err;
  }
  return res.data;
};

// the state of the screen, for the look and for the checks
export const screenState = ({ engine, downloading, job, previewing, samples, error }) => {
  if (job && isBusy(job)) return 'running';
  if (job && job.phase === 'done') return 'done';
  if (error || (job && job.phase === 'error')) return 'error';
  if (downloading) return 'downloading';
  if (!engine || !engine.ok) return 'noEngine';
  if (previewing || (samples && samples.length)) return 'preview';
  return 'ready';
};

const Upscaler = ({ onBack }) => {
  const { gstate } = useContext(StoreContext);
  const { t } = useTranslation(['tools', 'common']);
  const dialog = useDialog();
  const [toast] = useToast();
  const showNewMod = useShowNewMod();

  const [status, setStatus] = useState(null);
  const [test, setTest] = useState(null);
  const [testing, setTesting] = useState(false);
  const [downloading, setDownloading] = useState(null);
  const [source, setSource] = useState('');
  const [found, setFound] = useState(null);
  const [reading, setReading] = useState(false);
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [scale, setScale] = useState(2);
  const [small, setSmall] = useState(true);
  const [modelId, setModelId] = useState('');
  const [dest, setDest] = useState('');
  const [estimate, setEstimate] = useState(null);
  const [samples, setSamples] = useState(null);
  const [previewInfo, setPreviewInfo] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const alive = useRef(true);

  const engine = status ? status.engine : null;
  const models = engine && engine.ok ? engine.list : [];
  const model = models.find(m => m.id === modelId) || models[0] || null;
  const how = scaleFor(model, scale);
  const kinds = groupsToKinds(groups);
  const counts = groupCounts(found && found.kinds);
  const chosenCount = Object.keys(counts).reduce((s, g) => s + (groups[g] ? counts[g].count : 0), 0);
  const chosenPixels = Object.keys(counts).reduce((s, g) => s + (groups[g] ? counts[g].pixels : 0), 0);
  const mods = useMemo(
    () =>
      gstate.mods
        .filter(m => !m.isMap)
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
    [gstate.mods]
  );
  const sourceName = (mods.find(m => m.path === source) || {}).name || modNameOf(source);

  // ---- start: settings, engine, a job that may already run ----------------
  useEffect(() => {
    alive.current = true;
    (async () => {
      try {
        const st = await call('upscaler/status');
        if (!alive.current) return;
        setStatus(st);
        setTest(st.engine.tested);
        setScale(st.settings.scale === 4 ? 4 : 2);
        setModelId(st.settings.model);
        setGroups(kindsToGroups(st.settings.kinds));
        setSmall(st.settings.small !== false);
        setDest(pickDestFolder(st.settings.destFolder, gstate.folders));
        if (st.job) setJob(st.job);
        if (st.engine.ok && !st.engine.tested) runTest();
      } catch (e) {
        setError({ code: 'failed', detail: e.message });
      }
    })();
    const onProgress = (e, state) => alive.current && setJob(state);
    const onDownload = (e, p) => alive.current && setDownloading(p);
    ipcRenderer.on('upscaler/progress', onProgress);
    ipcRenderer.on('upscaler/download-progress', onDownload);
    return () => {
      alive.current = false;
      ipcRenderer.removeListener('upscaler/progress', onProgress);
      ipcRenderer.removeListener('upscaler/download-progress', onDownload);
    };
  }, []);

  // the size of the new mod, again when the choice changes
  useEffect(() => {
    if (!source || !found || !found.supported || !chosenCount) {
      setEstimate(null);
      return;
    }
    let stale = false;
    call('upscaler/estimate', { source, kinds, scale, destDir: '', small })
      .then(r => !stale && alive.current && setEstimate(r))
      .catch(() => !stale && setEstimate(null));
    return () => {
      stale = true;
    };
  }, [source, found, scale, small, kinds.join(',')]);

  const saveSettings = changes => call('upscaler/saveSettings', changes).catch(() => null);

  // ---- the engine -------------------------------------------------------------
  const runTest = async () => {
    setTesting(true);
    try {
      const r = await call('upscaler/test');
      if (!alive.current) return;
      setStatus(r);
      setTest(r.test);
    } catch (e) {
      setTest({ ok: false, reason: 'engineFailed', detail: e.message });
    }
    setTesting(false);
  };

  const onDownload = async () => {
    let asset;
    try {
      asset = await call('upscaler/release');
    } catch (e) {
      toast('danger', t('common:error'), t(e.code === 'noRelease' ? 'tools:dlNoRelease' : 'tools:dlOffline'));
      return;
    }
    const sure = await dialog.confirm({
      title: t('tools:dlTitle'),
      message: t('tools:dlMessage', { tag: asset.tag, size: formatBytes(asset.size) }),
      lines: [t('tools:dlAddress', { url: asset.url }), '', t('tools:dlLicense')],
      confirmText: t('tools:dlYes'),
      cancelText: t('common:cancel'),
      wide: true
    });
    if (!sure) return;
    setDownloading({ done: 0, total: asset.size });
    setTesting(true);
    try {
      const r = await call('upscaler/download', asset);
      if (!alive.current) return;
      setStatus(r);
      setTest(r.test);
      toast('ok', t('common:success'), t('tools:dlDone'));
    } catch (e) {
      if (e.code !== 'stopped') toast('danger', t('common:error'), t('tools:dlFailed', { reason: e.code }));
    }
    setTesting(false);
    setDownloading(null);
  };

  const onCancelDownload = () => call('upscaler/cancelDownload').catch(() => null);

  const onChooseFolder = async () => {
    const res = await showOpenDialog({ properties: ['openDirectory'] });
    if (!res || res.canceled || !res.filePaths || !res.filePaths[0]) return;
    setTesting(true);
    try {
      const r = await call('upscaler/setEngineFolder', res.filePaths[0]);
      if (!alive.current) return;
      setStatus(r);
      setTest(r.test);
    } catch (e) {
      toast('danger', t('common:error'), e.message);
    }
    setTesting(false);
  };

  // ---- the source -------------------------------------------------------------
  const readSource = async file => {
    setSource(file);
    setFound(null);
    setSamples(null);
    setPreviewInfo(null);
    if (!file) return;
    setReading(true);
    try {
      const f = await call('upscaler/collect', file);
      if (alive.current) setFound(f);
    } catch (e) {
      if (alive.current) setFound({ supported: false, reason: 'missing', kinds: {} });
    }
    if (alive.current) setReading(false);
  };

  const onPickFolder = async () => {
    const res = await showOpenDialog({ properties: ['openDirectory'] });
    if (res && !res.canceled && res.filePaths && res.filePaths[0]) readSource(res.filePaths[0]);
  };

  const onGroup = g => ({ value }) => {
    const next = { ...groups, [g]: !!value };
    setGroups(next);
    setSamples(null);
    saveSettings({ kinds: groupsToKinds(next) });
  };

  // ---- preview ------------------------------------------------------------------
  const makePreview = async id => {
    const use = id || (model && model.id);
    setPreviewing(true);
    setError(null);
    try {
      const r = await call('upscaler/preview', { source, kinds, scale, model: use, small });
      if (!alive.current) return;
      setSamples(r.samples);
      setPreviewInfo({ model: r.model, sec: (r.ms / 1000).toFixed(1) });
    } catch (e) {
      if (alive.current) setError({ code: e.code });
    }
    if (alive.current) setPreviewing(false);
  };

  // the next model in the list, and a preview with it
  const tryAnother = () => {
    if (models.length < 2) return makePreview();
    const i = models.findIndex(m => model && m.id === model.id);
    const next = models[(i + 1) % models.length];
    setModelId(next.id);
    saveSettings({ model: next.id });
    makePreview(next.id);
  };

  // ---- the job --------------------------------------------------------------------
  const onStart = async () => {
    setError(null);
    let est = estimate;
    try {
      est = await call('upscaler/estimate', { source, kinds, scale, destDir: '', small });
    } catch (e) {
      est = null;
    }
    if (est && est.free !== null && est.free < est.bytes * 1.1) {
      await dialog.info({
        title: t('tools:errorTitle'),
        message: t('tools:noSpace', { size: formatBytes(est.bytes), free: formatBytes(est.free) }),
        okText: t('common:ok')
      });
      return;
    }
    if (est && est.big) {
      const sure = await dialog.confirm({
        title: t('tools:bigTitle'),
        message: t('tools:bigMessage', { size: formatBytes(est.bytes) }),
        confirmText: t('tools:goOn'),
        cancelText: t('common:cancel')
      });
      if (!sure) return;
    }
    saveSettings({ model: model.id, scale, kinds, destFolder: dest, small });
    try {
      const st = await call('upscaler/start', { source, modName: sourceName, kinds, scale, model: model.id, destFolder: dest, small });
      if (alive.current) setJob(st);
    } catch (e) {
      setError({ code: e.code });
    }
  };

  const onCancel = () => call('upscaler/cancel').catch(() => null);
  const onResume = () => call('upscaler/resume').catch(() => null);
  const onNewRun = async () => {
    await call('upscaler/forget').catch(() => null);
    setJob(null);
    setError(null);
  };

  // ---- what the screen shows -------------------------------------------------------
  const state = screenState({ engine, downloading, job, previewing, samples, error });
  const busy = isBusy(job);
  const canWork = !!(engine && engine.ok && found && found.supported && chosenCount && how && !busy);
  const labels = { before: t('tools:before'), after: t('tools:after') };
  const friendly = m => t('tools:models.' + (m.known || 'unknown')) + ' (' + m.id + ')';
  const errorCode = (job && job.phase === 'error' && job.error && job.error.code) || (error && error.code);

  const engineNote = () => {
    if (!engine) return null;
    if (!engine.ok) {
      const key = engine.problem === 'noExe' ? 'tools:engineNoExe' : engine.problem === 'noModels' ? 'tools:engineNoModels' : 'tools:engineMissing';
      return <Note bad={engine.problem !== 'noFolder'}>{t(key)}</Note>;
    }
    return (
      <>
        <Note good>{t('tools:engineReady', { n: models.length })}</Note>
        {testing ? <Note>{t('tools:engineTesting')}</Note> : null}
        {!testing && test && test.ok ? <Note good>{t('tools:engineTestOk')}</Note> : null}
        {!testing && test && !test.ok ? (
          <>
            <Note bad>{t(test.reason === 'noVulkan' ? 'tools:engineNoVulkan' : 'tools:engineTestFail')}</Note>
            {test.detail ? <Path dir="ltr">{test.detail}</Path> : null}
          </>
        ) : null}
      </>
    );
  };

  const sourcePart = () => {
    if (reading) return <Note>{t('tools:reading')}</Note>;
    if (!found) return null;
    if (!found.supported) {
      return (
        <Greyed data-unsupported={found.reason}>
          <strong>{t('tools:wadOnly')}</strong>
          {found.reason === 'wad' ? t('tools:wadOnlyText') : t('tools:nothingFound')}
        </Greyed>
      );
    }
    if (!found.total) {
      return found.reason === 'doomOnly' ? (
        <Greyed data-unsupported="doomOnly">
          <strong>{t('tools:wadOnly')}</strong>
          {t('tools:doomInside', { n: found.doomFormat })}
        </Greyed>
      ) : (
        <Note bad>{t('tools:nothingFound')}</Note>
      );
    }
    return (
      <>
        <Heading as="h3">{t('tools:found')}</Heading>
        <Kinds>
          <tbody>
            {Object.keys(counts).map(g => (
              <tr key={g} className={counts[g].count ? undefined : 'empty'} data-group={g}>
                <td>
                  <Checkbox
                    name={g}
                    value={!!groups[g]}
                    disabled={!counts[g].count || busy}
                    label={t('tools:group_' + g)}
                    onChange={onGroup(g)}
                  />
                </td>
                <td className="num" dir="ltr">
                  {counts[g].count} {t('tools:pictures')}
                </td>
                <td className="num" dir="ltr">
                  {megapixels(counts[g].pixels)} {t('tools:megapixels')}
                </td>
              </tr>
            ))}
          </tbody>
        </Kinds>
        <Note>{t('tools:total', { n: chosenCount, mp: megapixels(chosenPixels) })}</Note>
        {groups.other && counts.other.count ? <Note>{t('tools:otherNote')}</Note> : null}
        {counts.sprites.count ? (
          <Checkbox
            name="upscaleSmall"
            value={small}
            disabled={busy}
            label={t('tools:smallFiles')}
            onChange={({ value }) => {
              setSmall(!!value);
              setSamples(null);
              saveSettings({ small: !!value });
            }}
          />
        ) : null}
        {counts.sprites.count ? <Note>{t('tools:smallNote')}</Note> : null}
        {found.doomFormat ? (
          <Greyed data-unsupported="doomInside">
            <strong>{t('tools:wadOnly')}</strong>
            {t('tools:doomInside', { n: found.doomFormat })}
          </Greyed>
        ) : null}
      </>
    );
  };

  const runPart = () => {
    if (job && busy) {
      const pct = job.total ? Math.round((job.done / job.total) * 100) : 0;
      return (
        <div data-phase={job.phase}>
          <Note>{t('tools:progress', { done: job.done, total: job.total })}</Note>
          <Bar>
            <div style={{ width: pct + '%' }} />
          </Bar>
          {job.phase === 'paused' ? (
            <Note good>{job.pausedReason === 'game' ? t('tools:paused') : t('tools:pausedUser')}</Note>
          ) : (
            <Note>
              {typeof job.eta === 'number' && job.done > 0
                ? t('tools:timeLeft', { time: formatTime(job.eta) })
                : t('tools:calculating')}
            </Note>
          )}
          {job.current ? <Path dir="ltr">{job.current}</Path> : null}
          <Note>{t('tools:background')}</Note>
          <Buttons>
            {job.phase === 'paused' ? (
              <Button onClick={onResume} width="150px">
                {t('tools:resume')}
              </Button>
            ) : null}
            <Button onClick={onCancel} width="150px">
              {t('common:cancel')}
            </Button>
          </Buttons>
        </div>
      );
    }
    if (job && job.phase === 'done' && job.result) {
      return (
        <div data-phase="done">
          <Note good>{t('tools:doneMessage', { name: modNameOf(job.result.file) })}</Note>
          <Note>{t('tools:donePictures', { n: job.result.images })}</Note>
          <Note>{t('tools:doneSize', { size: formatBytes(job.result.bytes) })}</Note>
          {job.result.rejected && job.result.rejected.length ? (
            <Note bad data-rejected={job.result.rejected.length}>{t('tools:rejected', { n: job.result.rejected.length })}</Note>
          ) : null}
          <Path dir="ltr">{job.result.file}</Path>
          <Buttons>
            <Button onClick={() => showNewMod(job.result.file)} width="190px">
              {t('tools:showInList')}
            </Button>
            <Button onClick={onNewRun} width="150px">
              {t('tools:newRun')}
            </Button>
          </Buttons>
        </div>
      );
    }
    return (
      <div data-phase={job ? job.phase : 'idle'}>
        {job && job.phase === 'cancelled' ? <Note>{t('tools:cancelled')}</Note> : null}
        {errorCode ? (
          <>
            <Note bad>
              {t('tools:errorTitle')}: {t('tools:errors.' + errorCode, { defaultValue: t('tools:errors.failed') })}
            </Note>
            {job && job.error && job.error.detail ? <Path dir="ltr">{job.error.detail}</Path> : null}
          </>
        ) : null}
        {estimate ? <Note>{t('tools:estimate', { size: formatBytes(estimate.bytes) })}</Note> : null}
        {!samples && canWork ? <Note>{t('tools:previewHint')}</Note> : null}
        <Buttons>
          <Button onClick={onStart} disabled={!canWork || previewing} width="190px">
            {t('tools:start')}
          </Button>
          {job && ['cancelled', 'error'].indexOf(job.phase) > -1 ? (
            <Button onClick={onNewRun} width="150px">
              {t('common:close')}
            </Button>
          ) : null}
        </Buttons>
      </div>
    );
  };

  const choices = destChoices(gstate.folders, dest);

  return (
    <Flex.Grid data-upscaler={state}>
      <Flex.Col width="50%">
        <Box>
          <Buttons>
            <Button onClick={onBack} width="130px" data-back="tools">
              {t('tools:back')}
            </Button>
          </Buttons>
          <Part>
            <Heading>{t('tools:engine')}</Heading>
            <Note>{t('tools:engineFolder')}</Note>
            <Path dir="ltr">{status ? status.settings.engineFolder : ''}</Path>
            {engineNote()}
            {downloading ? (
              <>
                <Note>
                  {t('tools:downloading', { done: formatBytes(downloading.done), total: formatBytes(downloading.total) })}
                </Note>
                <Bar>
                  <div style={{ width: (downloading.total ? Math.round((downloading.done / downloading.total) * 100) : 0) + '%' }} />
                </Bar>
                <Buttons>
                  <Button onClick={onCancelDownload} width="130px">
                    {t('tools:cancelDownload')}
                  </Button>
                </Buttons>
              </>
            ) : (
              <Buttons>
                {!engine || !engine.ok ? (
                  <Button onClick={onDownload} width="220px" disabled={testing}>
                    {t('tools:download')}
                  </Button>
                ) : (
                  <Button onClick={runTest} width="150px" load={testing}>
                    {t('tools:testAgain')}
                  </Button>
                )}
                <Button onClick={onChooseFolder} width="240px" disabled={testing || busy}>
                  {t('tools:chooseFolder')}
                </Button>
              </Buttons>
            )}
          </Part>

          <Part>
            <Heading>{t('tools:source')}</Heading>
            <Dropdown
              name="upscaleSource"
              fluid
              placeholder={t('tools:sourcePick')}
              value={mods.some(m => m.path === source) ? source : ''}
              options={mods.map(m => ({ label: `${m.name} (${m.kind})`, value: m.path }))}
              onChange={({ value }) => !busy && readSource(value)}
            />
            <Buttons>
              <Button onClick={onPickFolder} width="200px" disabled={busy}>
                {t('tools:sourceFolder')}
              </Button>
            </Buttons>
            {source && !mods.some(m => m.path === source) ? <Path dir="ltr">{source}</Path> : null}
            {sourcePart()}
          </Part>

          <Part>
            <Dropdown
              name="upscaleScale"
              label={t('tools:scale')}
              fluid
              value={String(scale)}
              options={[
                { label: t('tools:scale2'), value: '2' },
                { label: t('tools:scale4'), value: '4' }
              ]}
              onChange={({ value }) => {
                setScale(Number(value));
                setSamples(null);
                saveSettings({ scale: Number(value) });
              }}
            />
            {models.length ? (
              <Dropdown
                name="upscaleModel"
                label={t('tools:model')}
                fluid
                value={model ? model.id : ''}
                options={models.map(m => ({ label: friendly(m), value: m.id }))}
                onChange={({ value }) => {
                  setModelId(value);
                  saveSettings({ model: value });
                }}
              />
            ) : null}
            {model && how && how.shrink ? <Note>{t('tools:shrinkNote')}</Note> : null}
            {model && !how ? <Note bad>{t('tools:cannotScale')}</Note> : null}
            <Dropdown
              name="upscaleDest"
              label={t('tools:destFolder')}
              fluid
              value={dest}
              options={choices.map(f => ({
                label: (gstate.folders || []).some(p => (Array.isArray(p) ? p.join('/') : p) === f) ? f : t('tools:destNew', { name: f }),
                value: f
              }))}
              onChange={({ value }) => {
                setDest(value);
                saveSettings({ destFolder: value });
              }}
            />
            {source && found && found.supported ? (
              <Note>{t('tools:resultName', { name: resultFileName(sourceName, scale) })}</Note>
            ) : null}
          </Part>
        </Box>
      </Flex.Col>
      <Flex.Col width="50%">
        <Box>
          <Notice>{t('tools:notice')}</Notice>
          <Part>
            <Heading>{t('tools:run')}</Heading>
            {runPart()}
          </Part>
          <Part>
            <Heading>{t('tools:preview')}</Heading>
            <Buttons>
              <Button onClick={() => makePreview()} disabled={!canWork} load={previewing} width="190px">
                {t('tools:makePreview')}
              </Button>
              <Button onClick={tryAnother} disabled={!canWork || previewing || models.length < 2} width="210px">
                {t('tools:tryAnother')}
              </Button>
            </Buttons>
            {previewing ? <Note>{t('tools:previewing')}</Note> : null}
            {previewInfo && samples ? <Note dir="ltr">{t('tools:previewOf', previewInfo)}</Note> : null}
            {samples && !samples.length ? <Note>{t('tools:noSamples')}</Note> : null}
            {(samples || []).map(s => (
              <div key={s.path} data-preview={s.kind}>
                {s.problem ? (
                  <Note bad>
                    {s.path}: {t('tools:previewWrong')}
                  </Note>
                ) : (
                  <Compare sample={s} scale={scale} labels={labels} />
                )}
                {s.bytesFull ? (
                  <Note dir="auto">
                    {s.small
                      ? t('tools:sizeSmall', { full: formatBytes(s.bytesFull), small: formatBytes(s.bytesSmall) })
                      : t('tools:sizeFull', { full: formatBytes(s.bytesFull), small: formatBytes(s.bytesSmall) })}
                  </Note>
                ) : null}
              </div>
            ))}
          </Part>
          <Part>
            <Heading>{t('tools:about')}</Heading>
            <Note>{t('tools:aboutEngine')}</Note>
            <Note>{t('tools:aboutModels')}</Note>
            <Note>{t('tools:aboutLocal')}</Note>
            <Buttons>
              <Button onClick={() => openExternal((status && status.project) || 'https://github.com/xinntao/Real-ESRGAN')} width="170px">
                {t('tools:projectPage')}
              </Button>
            </Buttons>
          </Part>
        </Box>
      </Flex.Col>
    </Flex.Grid>
  );
};

Upscaler.propTypes = {
  onBack: PropTypes.func.isRequired
};

export default Upscaler;
