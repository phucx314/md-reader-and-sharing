import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { StackNavigationProp } from '@react-navigation/stack';

import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { BrutalInput } from '../components/BrutalInput';
import { BrutalButton } from '../components/BrutalButton';
import { apiClient } from '../api/client';

type AuthScreenProps = { navigation: StackNavigationProp<any, any> };

export const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const { login } = useAuth();
  const { colors } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!username || !password || (!isLogin && !email)) {
      Toast.show({ position: 'bottom', type: 'error', text1: 'Please fill all required fields' });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const formBody = `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
        const response = await apiClient.post('/api/auth/login', formBody, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        await login(response.data.access_token);
        Toast.show({ position: 'bottom', type: 'success', text1: 'Logged in!' });
        navigation.goBack();
      } else {
        await apiClient.post('/api/auth/register', { username, email, password });
        Toast.show({ position: 'bottom', type: 'success', text1: 'Account created! Please log in.' });
        setIsLogin(true);
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMessage = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || error.message || 'Unknown error';
      Toast.show({ position: 'bottom', type: 'error', text1: 'Authentication failed', text2: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* ─── Back button ───────────────── */}
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>

          {/* ─── Hero icon ─────────────────── */}
          <View style={[styles.iconWrap, { backgroundColor: colors.primary, borderColor: colors.border }]}>
            <Ionicons name="logo-markdown" size={48} color="#111" />
          </View>

          {/* ─── Title ─────────────────────── */}
          <ThemedText type="display" style={styles.title}>
            {isLogin ? 'Welcome\nBack.' : 'Create\nAccount.'}
          </ThemedText>

          {/* ─── Tab selector ──────────────── */}
          <View style={[styles.tabBar, { borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.tabItem, isLogin && { backgroundColor: colors.primary }]}
              onPress={() => setIsLogin(true)}
            >
              <ThemedText type="label" style={{ color: isLogin ? '#111' : colors.text }}>Log In</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tabItem, !isLogin && { backgroundColor: colors.primary }]}
              onPress={() => setIsLogin(false)}
            >
              <ThemedText type="label" style={{ color: !isLogin ? '#111' : colors.text }}>Sign Up</ThemedText>
            </TouchableOpacity>
          </View>

          {/* ─── Form card ─────────────────── */}
          <ThemedView card style={styles.card}>
            <BrutalInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              icon="person-outline"
              placeholder="your_username"
            />

            {!isLogin && (
              <BrutalInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                icon="mail-outline"
                placeholder="you@example.com"
              />
            )}

            <BrutalInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              icon="lock-closed-outline"
              placeholder="••••••••"
            />

            <BrutalButton
              title={isLogin ? 'Log In →' : 'Create Account →'}
              onPress={handleSubmit}
              loading={loading}
              fullWidth
              style={{ marginTop: 8 }}
            />
          </ThemedView>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 40 },
  backBtn: { marginBottom: 24, padding: 4, alignSelf: 'flex-start' },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    // Hard shadow
    shadowColor: '#111',
    shadowOffset: { width: 5, height: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  title: {
    marginBottom: 28,
    lineHeight: 48,
  },
  tabBar: {
    flexDirection: 'row',
    borderWidth: 2,
    marginBottom: 24,
    overflow: 'hidden',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { padding: 20 },
});
