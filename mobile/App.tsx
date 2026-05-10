import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import {
  useFonts,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { ActivityIndicator, View, Text } from 'react-native';

import { ThemeProvider } from './src/context/ThemeContext';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';

import { useTheme } from './src/context/ThemeContext';

function ToastWrapper() {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();

  const renderToast = (props: any, indicatorColor: string) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderWidth: 2, borderColor: colors.border, padding: 12, paddingHorizontal: 16, width: '90%', alignSelf: 'center', shadowColor: isDark ? 'transparent' : colors.shadow, shadowOffset: {width: 4, height: 4}, shadowOpacity: 1, shadowRadius: 0 }}>
      <View style={{ width: 14, height: 14, backgroundColor: indicatorColor, borderWidth: 2, borderColor: colors.border, marginRight: 14 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: 'SpaceGrotesk-Bold', color: colors.text, fontSize: 16 }}>{props.text1}</Text>
        {props.text2 ? <Text style={{ fontFamily: 'SpaceGrotesk-Regular', color: colors.text, fontSize: 14, marginTop: 2 }}>{props.text2}</Text> : null}
      </View>
    </View>
  );

  const toastConfig = {
    success: (props: any) => renderToast(props, colors.success),
    error: (props: any) => renderToast(props, colors.error),
    info: (props: any) => renderToast(props, colors.primary),
  };

  return <Toast config={toastConfig} position="bottom" bottomOffset={Math.max(insets.bottom + 10, 40)} />;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    'SpaceGrotesk-Regular': SpaceGrotesk_400Regular,
    'SpaceGrotesk-Medium': SpaceGrotesk_500Medium,
    'SpaceGrotesk-Bold': SpaceGrotesk_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
          <StatusBar style="auto" />
          <ToastWrapper />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
