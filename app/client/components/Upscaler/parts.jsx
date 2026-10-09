import styled from 'styled-components';

// shared look of the Upscaler screen

export const Part = styled.section`
  margin: 0 0 18px 0;
  padding: 0 0 14px 0;
  border-bottom: 1px solid ${({ theme }) => theme.border.idle};

  &:last-child {
    border-bottom: none;
  }
`;

export const Heading = styled.h2`
  font-family: ${({ theme }) => theme.font.head};
  font-size: 15px;
  font-weight: normal;
  text-transform: uppercase;
  color: ${({ theme }) => theme.color.active};
  margin: 0 0 10px 0;
`;

export const Note = styled.p`
  margin: 0 0 10px 0;
  font-size: 15px;
  line-height: 1.35;
  color: ${p => (p.bad ? '#ff5a3c' : p.good ? p.theme.color.active : p.theme.color.meta)};
  overflow-wrap: anywhere;
`;

export const Path = styled.p`
  margin: 0 0 10px 0;
  padding: 6px 8px;
  font-size: 14px;
  background-color: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  overflow-wrap: anywhere;
`;

export const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px 0;
  margin: 0 0 10px 0;
`;

export const Bar = styled.div`
  height: 14px;
  margin: 8px 0;
  background-color: ${({ theme }) => theme.color.backdrop};
  border: 1px solid ${({ theme }) => theme.border.idle};
  border-radius: ${({ theme }) => theme.border.radius};
  overflow: hidden;

  div {
    height: 100%;
    background-color: ${({ theme }) => theme.color.active};
    box-shadow: 0 0 8px ${({ theme }) => theme.color.glow};
    transition: width 0.3s ease-out;
  }
`;

export const Kinds = styled.table`
  width: 100%;
  border-collapse: collapse;
  margin: 0 0 6px 0;
  font-size: 15px;

  td {
    padding: 2px 4px;
    vertical-align: middle;
  }

  td.num {
    text-align: right;
    white-space: nowrap;
    color: ${({ theme }) => theme.color.meta};
  }

  tr.empty {
    opacity: 0.45;
  }

  /* the checkbox component brings its own space below */
  td > div {
    margin-bottom: 0 !important;
  }
`;

export const Notice = styled.p`
  margin: 0 0 14px 0;
  padding: 8px 10px;
  font-size: 15px;
  border-inline-start: 3px solid ${({ theme }) => theme.color.active};
  background-color: ${({ theme }) => theme.color.backdrop};
`;

export const Greyed = styled.div`
  opacity: 0.6;
  padding: 8px 10px;
  margin: 0 0 10px 0;
  border: 1px dashed ${({ theme }) => theme.border.idle};

  strong {
    display: block;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
`;
