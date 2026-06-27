import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const useScreenInsets = (extraTop = 12) => {
  const insets = useSafeAreaInsets();

  return {
    top: insets.top + extraTop,
    bottom: insets.bottom,
    left: insets.left,
    right: insets.right,
  };
};
