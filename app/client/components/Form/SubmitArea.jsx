import styled from 'styled-components';

const SubmitArea = styled.div`
  position: absolute;
  right: 10px;
  bottom: 20px;

  [dir='rtl'] & {
    right: auto;
    left: 10px;
  }
  text-align: end;
`;

export default SubmitArea;
