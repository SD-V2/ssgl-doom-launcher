import { ipcRenderer } from 'electron';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';

import { Box } from '../../components';
import { Button } from '../../components/Form';
import Upscaler from '../../components/Upscaler';
import { setTitle, useTranslation } from '../../utils';
import { isBusy } from '../../utils/upscale';
import AnimatedView from '../AnimatedView';

// Tools: one card per tool. The first one is the Upscaler.

const Intro = styled.p`
  font-size: 16px;
  margin: 0 0 16px 0;
  color: ${({ theme }) => theme.color.meta};
`;

const Cards = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
`;

const Card = styled.div.attrs({ className: 'ssgl-panel ssgl-tool' })`
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  background: ${({ theme }) => theme.color.backdrop};
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;

  h2 {
    font-family: ${({ theme }) => theme.font.head};
    font-size: 18px;
    font-weight: normal;
    text-transform: uppercase;
    color: ${({ theme }) => theme.color.active};
    text-shadow: ${({ theme }) => theme.font.glow};
    margin: 0;
  }

  p {
    margin: 0;
    font-size: 15px;
    line-height: 1.35;
  }

  p.steps {
    color: ${({ theme }) => theme.color.meta};
    font-size: 14px;
  }

  svg {
    width: 54px;
    height: 54px;
    stroke: ${({ theme }) => theme.color.active};
    fill: none;
    filter: ${({ theme }) => theme.svg.glow};
  }
`;

// a small square of pixels that grows into a big one
const UpscaleIcon = () => (
  <svg viewBox="0 0 54 54" aria-hidden="true">
    <rect x="3" y="33" width="18" height="18" strokeWidth="2" />
    <path d="M7 37h5v5H7zM12 42h5v5h-5z" strokeWidth="1.5" />
    <rect x="17" y="3" width="34" height="34" strokeWidth="2" strokeDasharray="4 3" />
    <path d="M22 32L42 12M34 12h8v8" strokeWidth="2.5" />
  </svg>
);

// the tool that was open stays open when you come back
let lastOpen = '';

const Tools = () => {
  setTitle('tools');
  const { t } = useTranslation(['tools', 'nav']);
  const [open, setOpen] = useState(lastOpen);

  // a running upscale: straight to it
  useEffect(() => {
    let alive = true;
    ipcRenderer
      .invoke('upscaler/state')
      .then(res => {
        if (alive && res && res.data && isBusy(res.data)) setOpen('upscaler');
      })
      .catch(() => null);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    lastOpen = open;
  }, [open]);

  return (
    <AnimatedView>
      {open === 'upscaler' ? (
        <Upscaler onBack={() => setOpen('')} />
      ) : (
        <Box>
          <Intro>{t('tools:intro')}</Intro>
          <Cards data-tools="cards">
            <Card data-tool="upscaler">
              <UpscaleIcon />
              <h2>{t('tools:upscalerName')}</h2>
              <p>{t('tools:upscalerText')}</p>
              <p className="steps">{t('tools:upscalerSteps')}</p>
              <div>
                <Button onClick={() => setOpen('upscaler')} width="150px">
                  {t('tools:open')}
                </Button>
              </div>
            </Card>
          </Cards>
        </Box>
      )}
    </AnimatedView>
  );
};

export default Tools;
