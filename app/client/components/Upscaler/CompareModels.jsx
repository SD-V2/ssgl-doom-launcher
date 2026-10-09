import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { modelKind } from '../../utils/upscale';

// "Compare models": every sample picture as the original (made bigger with its pixels
// kept, so they show) and through each model, side by side. A click on a picture
// chooses its model for that kind of picture (textures / sprites / graphics).
// Background: a light checkerboard (shows halos at see-through edges) or dark.

const CHECKER = `
  background-color: #cfcfcf;
  background-image: linear-gradient(45deg, #9a9a9a 25%, transparent 25%),
    linear-gradient(-45deg, #9a9a9a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #9a9a9a 75%),
    linear-gradient(-45deg, transparent 75%, #9a9a9a 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
`;

const Sample = styled.div`
  margin: 0 0 16px 0;

  h4 {
    margin: 0 0 6px 0;
    font-size: 14px;
    font-weight: normal;
    color: ${({ theme }) => theme.color.meta};
    overflow-wrap: anywhere;
  }
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  ${({ theme }) => theme.scrollbar};

  &::-webkit-scrollbar {
    height: 6px;
  }
`;

const Cell = styled.button`
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 3px;
  margin: 0;
  font: inherit;
  color: inherit;
  text-align: start;
  background: transparent;
  border: 2px solid ${({ theme, chosen }) => (chosen ? theme.color.active : theme.border.idle)};
  box-shadow: ${({ theme, chosen }) => (chosen ? `0 0 8px ${theme.color.glow}` : 'none')};
  cursor: ${({ original }) => (original ? 'default' : 'pointer')};

  &:hover {
    border-color: ${({ theme, original }) => (original ? theme.border.idle : theme.color.active)};
  }

  .pic {
    ${({ bg }) => (bg === 'checker' ? CHECKER : 'background-color: #101012;')}
    min-width: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  img {
    display: block;
  }

  img.pixels {
    image-rendering: pixelated;
  }

  span {
    display: block;
    min-width: 130px;
    max-width: 100%;
    margin-top: 4px;
    font-size: 13px;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }

  b {
    color: ${({ theme }) => theme.color.active};
    font-weight: normal;
  }
`;

// the size every picture of a sample is shown at: the result size, at most 240 wide
const shownSize = (s, scale) => {
  const w = s.width * scale;
  const h = s.height * scale;
  const k = Math.min(1, 240 / w, 200 / h);
  return { width: Math.round(w * k), height: Math.round(h * k) };
};

const CompareModels = ({ result, scale, bg, chosen, onChoose, nameOf, labels }) => (
  <div data-compare="models">
    {result.samples.map((s, i) => {
      const size = shownSize(s, scale);
      const kind = modelKind(s.kind);
      return (
        <Sample key={s.path} data-compare-sample={s.kind}>
          <h4 dir="ltr">
            {labels.kind(kind)}: {s.path}
          </h4>
          <Row>
            <Cell type="button" original bg={bg} tabIndex={-1} data-compare-cell="original">
              <div className="pic" style={size}>
                <img className="pixels" src={s.before} alt="" style={size} />
              </div>
              <span style={{ width: size.width }}>{labels.original}</span>
            </Cell>
            {result.results.map(r => {
              const item = r.items[i] || {};
              const isChosen = chosen[kind] === r.model;
              return (
                <Cell
                  key={r.model}
                  type="button"
                  bg={bg}
                  chosen={isChosen}
                  data-compare-cell={r.model}
                  data-chosen={isChosen ? 'yes' : 'no'}
                  onClick={() => item.after && onChoose(kind, r.model)}
                  title={nameOf(r.model)}
                >
                  <div className="pic" style={size}>
                    {item.after ? <img src={item.after} alt="" style={size} /> : null}
                  </div>
                  <span style={{ width: size.width }}>
                    {r.model}
                    {item.problem ? ' - ' + labels.failed : ''}
                    {isChosen ? (
                      <>
                        {' - '}
                        <b>{labels.chosen}</b>
                      </>
                    ) : null}
                  </span>
                </Cell>
              );
            })}
          </Row>
        </Sample>
      );
    })}
  </div>
);

CompareModels.propTypes = {
  result: PropTypes.shape({ samples: PropTypes.array, results: PropTypes.array }).isRequired,
  scale: PropTypes.number.isRequired,
  bg: PropTypes.oneOf(['checker', 'dark']).isRequired,
  chosen: PropTypes.object.isRequired,
  onChoose: PropTypes.func.isRequired,
  nameOf: PropTypes.func.isRequired,
  labels: PropTypes.shape({ kind: PropTypes.func, original: PropTypes.string, chosen: PropTypes.string, failed: PropTypes.string })
    .isRequired
};

export default CompareModels;
