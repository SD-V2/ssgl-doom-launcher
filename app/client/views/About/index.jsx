import { remote } from 'electron';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'styled-components';

import { BoxStyle } from '../../components/Box';
import Flex from '../../components/Flex';
import Logo from '../../components/Logo';
import { useTranslation } from '../../utils';
import AnimatedView from '../AnimatedView';
import { contact, techs, testers } from './data';

// backdrop:
const Box = styled(BoxStyle)`
  background: rgba(0, 0, 0, 0.7);

  .content {
    margin-bottom: 0;
  }
`;

const Text = styled.div`
  h1 {
    font-size: 20px;
    text-transform: uppercase;
    text-align: center;
  }

  h2 {
    font-size: 16px;
    text-transform: uppercase;
    text-align: center;
    margin-bottom: 10px;
  }

  h3 {
    font-size: 18px;
    text-transform: uppercase;
    margin-bottom: 10px;
  }

  .link {
    color: ${({ theme }) => theme.color.active};
    transition: ${({ theme }) => theme.transition.out};
    cursor: pointer;

    & .meta {
      font-size: 14px;
      opacity: 0.6;
    }

    &:hover {
      color: white;
    }
  }

  ul {
    color: red;
    list-style-type: square;
    padding-inline-start: 20px;
    margin: 10px;
    margin-bottom: 30px;
  }

  li {
    margin-bottom: 5px;
  }
`;

const Link = ({ children, to }) => {
  const onClick = () => remote.shell.openExternal(to);
  return (
    <span onClick={onClick} className="link">
      {children}
    </span>
  );
};

Link.propTypes = {
  children: PropTypes.any,
  to: PropTypes.string
};

// set while building (see configs/wp.*.base.js)
const BUILD_DATE =
  typeof __BUILD_TIME__ === 'undefined' ? '' : __BUILD_TIME__.slice(0, 10);

const About = () => {
  const { t } = useTranslation(['about']);
  return (
    <AnimatedView>
      <Box>
        <div className="scroll">
          <div className="content">
            <Text>
              <h1>
                {t('about:title', { version: remote.app.getVersion() })}
              </h1>
              {BUILD_DATE ? (
                <p style={{ textAlign: 'center', opacity: 0.7 }}>
                  {t('about:forkBuild', { date: BUILD_DATE })}
                </p>
              ) : null}
              <Logo height="90px" center />
              <br /> <br />
              <Flex.Grid>
                <Flex.Col>
                  <h3>{t('about:technologies')}</h3>
                  <ul>
                    {techs.map(i => (
                      <li key={i.name}>
                        <Link to={i.link}>{i.name}</Link>
                      </li>
                    ))}
                  </ul>
                </Flex.Col>
                <Flex.Col>
                  <h3>{t('about:testers')}</h3>
                  <ul>
                    {testers.map(i => (
                      <li key={i.name}>
                        <Link to={i.link}>
                          {i.name} <br />
                          <span className="meta">{t(`about:${i.roleKey}`, { defaultValue: i.role })}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Flex.Col>
                <Flex.Col>
                  <h3>{t('about:contact')}</h3>
                  <ul>
                    {contact.map(i => (
                      <li key={i.platform}>
                        <Link to={i.link}>
                          {i.key ? t(`about:${i.key}`) : i.platform}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Flex.Col>
              </Flex.Grid>
              <p style={{ textAlign: 'center', textTransform: 'uppercase' }}>
                {t('about:iconsLicense')} <br /> {t('about:iconsLicense2')}{' '}
                <Link to="https://creativecommons.org/licenses/by-nc/4.0/">
                  CC BY-NC 4.0
                </Link>{' '}
                <br />
                <br />
                {t('about:codeLicense')}{' '}
                <Link to="https://github.com/FreaKzero/ssgl-doom-launcher/blob/latest/app/LICENSE">
                  MIT License
                </Link>
                <br />
                {t('about:copyright')}
              </p>
              <p
                style={{
                  fontSize: '14px',
                  textAlign: 'center',
                  marginTop: '15px'
                }}
              >
                {t('about:trademark')}
              </p>
              <p style={{ textAlign: 'end' }}>
                {t('about:crafted')}
              </p>
            </Text>
          </div>
        </div>
      </Box>
    </AnimatedView>
  );
};
export default About;
