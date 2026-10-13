import React, { useContext, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import styled from 'styled-components';
import { Route, Router } from 'wouter';

import routes from '#/routes';

import { StoreContext } from '../state';
import { useHashLocation } from '../utils';
import { isRouteShown } from './Nav/NavList';

const ViewStyle = styled.div`
  margin: 15px;
`;

const Routes = () => {
  // eslint-disable-next-line no-unused-vars
  const [loc, navigate] = useHashLocation();
  const { gstate } = useContext(StoreContext);
  // the keys are bound once: they read the newest state from here
  const latest = useRef(gstate);
  latest.current = gstate;
  return (
    <ViewStyle>
      <Router hook={useHashLocation}>
        {routes.map(route => {
          if (route.shortcut && route.shortcut.trim() !== '') {
            useHotkeys(route.shortcut, () => {
              // not to a page the menu hides (no mods, no save folder, Tools off)
              if (isRouteShown(route, latest.current)) navigate(route.href);
            });
          }

          return (
            <Route
              key={`route_${route.href}`}
              path={route.href}
              component={route.component}
            />
          );
        })}
      </Router>
    </ViewStyle>
  );
};

export default Routes;
