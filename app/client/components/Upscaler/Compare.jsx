import PropTypes from 'prop-types';
import React, { useState } from 'react';
import styled from 'styled-components';

// Before / after of one picture: the "before" covers the left part, a slider moves
// the line. Both are shown at the same size (the small one with sharp pixels).
// (overflow + width, no clip-path)

const Wrap = styled.figure`
  margin: 0 0 14px 0;

  figcaption {
    font-size: 14px;
    color: ${({ theme }) => theme.color.meta};
    margin: 4px 0 0 0;
    overflow-wrap: anywhere;
  }
`;

const Frame = styled.div`
  position: relative;
  max-width: 100%;
  border: 1px solid ${({ theme }) => theme.border.idle};
  background-color: #111;
  background-image: linear-gradient(45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(-45deg, #1c1c1c 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #1c1c1c 75%),
    linear-gradient(-45deg, transparent 75%, #1c1c1c 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
  overflow: hidden;
  user-select: none;

  img {
    display: block;
    width: 100%;
    height: 100%;
  }

  .before {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    overflow: hidden;
    border-right: 2px solid ${({ theme }) => theme.color.active};
  }

  .before img {
    image-rendering: pixelated;
  }

  .tag {
    position: absolute;
    top: 4px;
    padding: 1px 6px;
    font-size: 12px;
    text-transform: uppercase;
    background-color: rgba(0, 0, 0, 0.7);
    color: ${({ theme }) => theme.color.active};
    pointer-events: none;
  }

  input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    opacity: 0;
    cursor: ew-resize;
  }
`;

const Compare = ({ sample, scale, labels, maxWidth = 420 }) => {
  const [pos, setPos] = useState(50);
  const w = sample.width * scale;
  const h = sample.height * scale;
  const shown = Math.min(maxWidth, Math.max(w, 240));
  const height = Math.round((shown / w) * h);

  return (
    <Wrap data-sample={sample.path}>
      <Frame style={{ width: shown + 'px', height: height + 'px' }}>
        <img className="after" src={sample.after} alt="" draggable={false} />
        <div className="before" style={{ width: pos + '%' }}>
          <img src={sample.before} alt="" draggable={false} style={{ width: shown + 'px', height: height + 'px', maxWidth: 'none' }} />
        </div>
        <span className="tag" style={{ left: '4px' }}>
          {labels.before}
        </span>
        <span className="tag" style={{ right: '4px' }}>
          {labels.after}
        </span>
        <input
          type="range"
          min="0"
          max="100"
          value={pos}
          aria-label={labels.before + ' / ' + labels.after}
          onChange={e => setPos(Number(e.target.value))}
        />
      </Frame>
      <figcaption dir="ltr">
        {sample.path} - {sample.width}x{sample.height} → {w}x{h}
      </figcaption>
    </Wrap>
  );
};

Compare.propTypes = {
  labels: PropTypes.object.isRequired,
  maxWidth: PropTypes.number,
  sample: PropTypes.object.isRequired,
  scale: PropTypes.number.isRequired
};

export default Compare;
