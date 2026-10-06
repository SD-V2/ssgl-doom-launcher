import { motion } from 'framer-motion';
import PropTypes from 'prop-types';
import React, { useContext } from 'react';
import styled from 'styled-components';

import { StoreContext } from '../../state';
import { useTranslation } from '../../utils';
import Check from './Checkmarks';
import Icon from './Icon';
import TagList from './TagList';

const Divider = styled.div`
  width: 5px;
`;
const Content = styled.div`
  width: 100%;

  span {
    transition: ${({ theme }) => theme.transition.out};
  }

  h1 {
    white-space: nowrap;
    transition: ${({ theme }) => theme.transition.out};
    font-size: 18px;
    margin-top: 5px;
    margin-bottom: 5px;
    text-transform: uppercase;
  }

  &.active h1 {
    color: ${({ theme }) => theme.color.active};
  }

  &.active span {
    color: #fff;
  }

  &.active li {
    border: 1px solid white;
    color: white;
  }
`;

const NewTag = styled.span`
  display: inline-block;
  margin-inline-end: 8px;
  padding: 0 6px;
  font-size: 11px;
  line-height: 16px;
  text-transform: uppercase;
  border-radius: 4px;
  color: ${({ theme }) => theme.color.active};
  border: 1px solid ${({ theme }) => theme.color.active};
`;

const WarnTag = styled(NewTag)`
  cursor: pointer;
  color: #f5b945;
  border: 1px solid #f5b945;
  text-transform: none;

  &:hover {
    background: rgba(245, 185, 69, 0.15);
  }
`;

const Meta = styled.span`
  color: ${({ theme }) => theme.color.meta};
  font-size: 14px;
  margin-bottom: 5px;
  margin-inline-end: 5px;
`;

const ActionsStyle = styled.div`
  display: flex;
  flex-direction: ${({ compact }) => (compact ? 'row' : 'column')};
  justify-content: space-between;
  align-items: center;
  margin-inline-start: 8px;
  ${({ compact }) => (compact ? 'gap: 6px;' : '')}

  button {
    background: none;
    border: none;
    padding: 0;
    margin: 0;
    width: 15px;
    height: 15px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  svg {
    width: 15px;
    height: 15px;
    fill: none;
    stroke: ${({ theme }) => theme.border.idle};
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
    transition: ${({ theme }) => theme.transition.out};
  }

  button:hover svg {
    stroke: ${({ theme }) => theme.border.active};
    filter: ${({ theme }) => theme.svg.glow};
  }

  button.fav svg {
    stroke: ${({ theme }) => theme.color.active};
    fill: ${({ theme }) => theme.color.active};
  }

  button.danger:hover svg {
    stroke: #f55945;
    filter: drop-shadow(0 -1px 4px #ff2f00) drop-shadow(0 0 10px #ff2f00);
  }
`;

const StarSvg = () => (
  <svg viewBox="0 0 24 24">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const FolderSvg = () => (
  <svg viewBox="0 0 24 24">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </svg>
);

const TrashSvg = () => (
  <svg viewBox="0 0 24 24">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconContainer = styled.div`
  text-align: center;
  display: flex;
  justify-content: space-between;
  flex-direction: column;
`;

const ItemStyle = styled.div`
  overflow: hidden;
  background: ${({ theme }) => theme.color.backdrop};
  border-radius: ${({ theme }) => theme.border.radius};
  border: 1px solid ${({ theme }) => theme.border.idle};
  transition: ${({ theme }) => theme.transition.out};
  padding: ${({ compact }) => (compact ? '4px 10px' : '10px')};
  height: ${({ compact }) => (compact ? '30px' : '50px')};
  display: flex;
  align-items: ${({ compact }) => (compact ? 'center' : 'stretch')};

  ${({ compact }) =>
    compact
      ? `
    h1 {
      display: inline-block;
      margin: 0 10px 0 0;
      font-size: 15px;
    }
    span, ul {
      margin-bottom: 0;
    }
  `
      : ''}
  user-select: none;
  margin-bottom: 5px;

  &:hover {
    border: 1px solid ${({ theme }) => theme.border.active};
  }

  &:hover h1 {
    color: ${({ theme }) => theme.color.active};
  }

  ${({ dragState, theme }) => {
    switch (dragState) {
      case 'dragging':
        return 'opacity: 0.35;';
      case 'above':
        return `box-shadow: 0 -4px 0 0 ${theme.color.active};`;
      case 'below':
        return `box-shadow: 0 4px 0 0 ${theme.color.active};`;
      default:
        return '';
    }
  }}
`;

const ModItem = ({
  style,
  item,
  onSelect,
  onUp,
  onDown,
  onCircle = () => null,
  onTag = null,
  selected = false,
  dragProps = {},
  dragState = null,
  fav = false,
  onFav = null,
  onShow = null,
  onDelete = null,
  isNew = false,
  compact = false,
  conflicts = 0,
  onConflicts = () => {},
  twin = false,
  onTwin = () => {}
}) => {
  const { gstate } = useContext(StoreContext);
  const { t } = useTranslation(['wads']);

  return (
    <motion.li
      style={style}
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        scale: 1
      }}
      exit={{ opacity: 0 }}
      layoutTransition={{
        type: 'tween'
      }}
    >
      <ItemStyle {...dragProps} dragState={dragState} compact={compact}>
        <Check
          theme={gstate.settings.theme}
          size={compact ? '30' : '50'}
          active={item.active}
          onClick={onSelect}
        />
        <Divider />
        <Content className={item.active ? 'active' : undefined}>
          <h1>{item.name}</h1>
          {isNew && !selected ? <NewTag>{t('wads:newBadge')}</NewTag> : null}
          {selected && conflicts > 0 ? (
            <WarnTag
              title={t('wads:conflictBadgeTitle', { count: conflicts })}
              onClick={onConflicts}
            >
              ⚠ {conflicts}
            </WarnTag>
          ) : null}
          {selected && twin ? (
            <WarnTag title={t('wads:twinBadgeTitle')} onClick={onTwin}>
              {t('wads:twinBadge')}
            </WarnTag>
          ) : null}
          <Meta>
            {item.size} {item.kind}{' '}
          </Meta>
          <TagList item={item} onTag={onTag} />
        </Content>
        {!selected && onFav ? (
          <ActionsStyle compact={compact}>
            <button
              type="button"
              className={fav ? 'fav' : undefined}
              title={t('wads:favorite')}
              onClick={onFav}
            >
              <StarSvg />
            </button>
            <button type="button" title={t('wads:showInFolder')} onClick={onShow}>
              <FolderSvg />
            </button>
            <button
              type="button"
              className="danger"
              title={t('wads:deleteMod')}
              onClick={onDelete}
            >
              <TrashSvg />
            </button>
          </ActionsStyle>
        ) : null}
        {selected ? (
          <IconContainer>
            <Icon name="up" width="13" onClick={onUp} />
            <Icon name="circle" width="13" onClick={onCircle} />
            <Icon name="down" width="13" onClick={onDown} />
          </IconContainer>
        ) : (
          false
        )}
      </ItemStyle>
    </motion.li>
  );
};

ModItem.propTypes = {
  item: PropTypes.shape({
    name: PropTypes.string.isRequired,
    active: PropTypes.bool.isRequired,
    lastdir: PropTypes.string.isRequired,
    kind: PropTypes.string.isRequired,
    size: PropTypes.string.isRequired
  }),
  style: PropTypes.any,
  onDown: PropTypes.func,
  onUp: PropTypes.func,
  onCircle: PropTypes.func,
  onSelect: PropTypes.func.isRequired,
  onTag: PropTypes.any,
  selected: PropTypes.bool,
  dragProps: PropTypes.object,
  dragState: PropTypes.string,
  fav: PropTypes.bool,
  onFav: PropTypes.func,
  onShow: PropTypes.func,
  onDelete: PropTypes.func,
  isNew: PropTypes.bool,
  compact: PropTypes.bool,
  conflicts: PropTypes.number,
  onConflicts: PropTypes.func,
  twin: PropTypes.bool,
  onTwin: PropTypes.func
};

export default ModItem;
