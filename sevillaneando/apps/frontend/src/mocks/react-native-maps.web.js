import React from 'react';
import { View } from 'react-native';

const MapView = ({ children, style }) => React.createElement(View, { style }, children);
MapView.Animated = MapView;

const Marker = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
const Callout = ({ children }) => React.createElement(React.Fragment, null, children ?? null);
const Circle = () => null;
const Polyline = () => null;
const UrlTile = () => null;

export default MapView;
export { Marker, Callout, Circle, Polyline, UrlTile };
export const MapPressEvent = undefined;
