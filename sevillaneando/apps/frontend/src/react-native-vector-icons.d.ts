declare module 'react-native-vector-icons/MaterialIcons' {
  import { ComponentType } from 'react';
  import { ViewStyle } from 'react-native';
  interface MaterialIconsProps {
    name: string;
    size?: number;
    color?: string;
    style?: ViewStyle;
  }
  const MaterialIcons: ComponentType<MaterialIconsProps>;
  export default MaterialIcons;
}

declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import { ComponentType } from 'react';
  import { ViewStyle } from 'react-native';
  interface MaterialCommunityIconsProps {
    name: string;
    size?: number;
    color?: string;
    style?: ViewStyle;
  }
  const MaterialCommunityIcons: ComponentType<MaterialCommunityIconsProps>;
  export default MaterialCommunityIcons;
}