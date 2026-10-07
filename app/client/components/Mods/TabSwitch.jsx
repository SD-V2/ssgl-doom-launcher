import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

const SwitchStyle = styled.div`
  display: flex;
  margin-bottom: 8px;
  border-radius: ${({ theme }) => theme.border.radius};
  border: 1px solid ${({ theme }) => theme.border.idle};
  overflow: hidden;

  button {
    position: relative;
    flex: 1;
    padding: 8px 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 16px;
    letter-spacing: 1px;
    text-transform: uppercase;
    color: ${({ theme }) => theme.button.idle};
    background: ${({ theme }) => theme.color.backdrop};
    border: none;
    transition: ${({ theme }) => theme.transition.short};
  }

  /* the line: grows from the middle to both sides, like the line of the main menu */
  button::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    width: 0;
    height: 3px;
    background-color: ${({ theme }) => theme.color.active};
    box-shadow: ${({ theme }) => theme.font.glow};
    transition: ${({ theme }) => theme.transition.short};
  }

  button:hover {
    color: ${({ theme }) => theme.color.active};
  }

  /* same background as the other tab - only the line marks the open one */
  button.on {
    color: ${({ theme }) => theme.color.active};
    text-shadow: ${({ theme }) => theme.font.glow};
  }

  button:hover::after,
  button.on::after {
    left: 0;
    width: 100%;
  }

  small {
    margin-inline-start: 8px;
    font-size: 13px;
    opacity: 0.7;
  }
`;

// tabs = [{ value, label, count? }]
const TabSwitch = ({ tabs, value, onChange }) => (
  <SwitchStyle>
    {tabs.map(tab => (
      <button
        key={tab.value}
        type="button"
        className={tab.value === value ? 'on' : undefined}
        onClick={() => onChange(tab.value)}
      >
        {tab.label}
        {tab.count !== undefined ? <small>{tab.count}</small> : null}
      </button>
    ))}
  </SwitchStyle>
);

TabSwitch.propTypes = {
  tabs: PropTypes.array.isRequired,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired
};

export default TabSwitch;
