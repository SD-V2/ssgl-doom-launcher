import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const Tags = styled.ul`
  user-select: none;
  list-style: none;
  display: inline-block;
`;

const Tag = styled.li.attrs({ className: 'ssgl-tag' })`
  transition: ${({ theme }) => theme.transition.out};
  color: ${({ theme }) => theme.color.meta};
  display: inline;
  margin-inline-end: 5px;
  font-size: 12px;
  border: ${({ theme }) => `1px solid ${theme.color.meta}`};
  border-radius: 4px;
  padding: 0 6px 0 6px;

  &.clickable {
    cursor: pointer;
  }

  &.clickable:hover {
    border: ${({ theme }) => `1px solid ${theme.color.active}`};
    color: ${({ theme }) => theme.color.active};
  }

  /* where the mod goes in the load order: in the color of the accent */
  &.section {
    color: ${({ theme }) => theme.color.active};
    border-style: dashed;
    border-color: ${({ theme }) => theme.color.active};
  }

  &.section:hover {
    border-style: solid;
  }
`;

const TagList = ({ item, onTag, sectionTag = null }) => {
  return item.tags.length || sectionTag ? (
    <Tags>
      {item.tags.length ? (
        <Tag
          key={`${item.id}_##BACK##`}
          className={onTag ? 'clickable' : ''}
          onClick={onTag ? onTag('##BACK##') : null}
        >
          /
        </Tag>
      ) : null}
      {item.tags.map((tag, idx) => {
        return (
          <Tag
            key={`${item.id}_${idx}_${tag}`}
            className={onTag ? 'clickable' : ''}
            onClick={onTag ? onTag(tag) : null}
          >
            {tag}
          </Tag>
        );
      })}
      {sectionTag ? (
        <Tag
          key={`${item.id}_##SECTION##`}
          className="clickable section"
          title={sectionTag.title}
          onClick={sectionTag.onClick}
        >
          {sectionTag.label}
        </Tag>
      ) : null}
    </Tags>
  ) : null;
};

TagList.propTypes = {
  sectionTag: PropTypes.object,
  item: PropTypes.any,
  onTag: PropTypes.any
};

export default TagList;
