const React = require('react');
const { View } = require('react-native');

const VirtualViewMode = {
  Visible: 0,
  Prerender: 1,
  Hidden: 2,
  cast(value) {
    return value;
  },
};

const VirtualViewRenderState = {
  Unknown: 0,
  Rendered: 1,
  None: 2,
  cast(value) {
    return value;
  },
};

const VirtualView = React.forwardRef(function VirtualView(
  { children, hiddenStyle, onModeChange, removeClippedSubviews, ...props },
  ref,
) {
  return React.createElement(
    View,
    {
      ref,
      ...props,
      removeClippedSubviews,
    },
    children,
  );
});

function createHiddenVirtualView(style) {
  return React.forwardRef(function HiddenVirtualView(props, ref) {
    return React.createElement(VirtualView, {
      ...props,
      ref,
      style: [props.style, style],
    });
  });
}

module.exports = VirtualView;
module.exports.default = VirtualView;
module.exports.VirtualViewMode = VirtualViewMode;
module.exports.VirtualViewRenderState = VirtualViewRenderState;
module.exports.createHiddenVirtualView = createHiddenVirtualView;
module.exports._logs = {};
