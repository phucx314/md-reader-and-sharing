import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { NavigationContainer } from '@react-navigation/native';

import { HomeScreen } from '../screens/HomeScreen';
import { EditorScreen } from '../screens/EditorScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ShareScreen } from '../screens/ShareScreen';
import { MermaidViewerScreen } from '../screens/MermaidViewerScreen';
import { TableViewerScreen } from '../screens/TableViewerScreen';
import { ExplainViewerScreen } from '../screens/ExplainViewerScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SettingsScreen } from '../screens/SettingsScreen';

const Stack = createStackNavigator();

export const AppNavigator = () => {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Editor" component={EditorScreen} />
        <Stack.Screen name="MermaidViewer" component={MermaidViewerScreen} />
        <Stack.Screen name="TableViewer" component={TableViewerScreen} />
        <Stack.Screen name="ExplainViewer" component={ExplainViewerScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="Auth" component={AuthScreen} />
        <Stack.Screen name="Share" component={ShareScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
