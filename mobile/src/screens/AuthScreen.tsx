import React, { useState } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { ThemedView } from '../components/ThemedView';
import { ThemedText } from '../components/ThemedText';
import { BrutalInput } from '../components/BrutalInput';
import { BrutalButton } from '../components/BrutalButton';
import { apiClient } from '../api/client';
import Toast from 'react-native-toast-message';
import { StackNavigationProp } from '@react-navigation/stack';

type AuthScreenProps = {
  navigation: StackNavigationProp<any, any>;
};

export const AuthScreen: React.FC<AuthScreenProps> = ({ navigation }) => {
  const { login } = useAuth();
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
        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);
        
        const response = await apiClient.post('/api/auth/login', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        await login(response.data.access_token);
        Toast.show({ position: 'bottom', type: 'success', text1: 'Logged in successfully' });
        navigation.goBack(); // Go back to previous screen
      } else {
        await apiClient.post('/api/auth/register', { username, email, password });
        Toast.show({ position: 'bottom', type: 'success', text1: 'Registered successfully. Please log in.' });
        setIsLogin(true);
      }
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      const errorMessage = Array.isArray(detail) 
        ? detail.map((d: any) => d.msg).join(', ') 
        : (detail || 'Unknown error');

      Toast.show({ position: 'bottom', 
        type: 'error', 
        text1: 'Authentication failed', 
        text2: errorMessage 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <ThemedView card style={styles.card}>
            <ThemedText type="title" style={styles.title}>
              {isLogin ? 'Welcome Back' : 'Join Us'}
            </ThemedText>
            
            <BrutalInput
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
            
            {!isLogin && (
              <BrutalInput
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            )}
            
            <BrutalInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            
            <View style={styles.actions}>
              <BrutalButton 
                title={isLogin ? 'Log In' : 'Sign Up'} 
                onPress={handleSubmit} 
                loading={loading}
              />
              <BrutalButton 
                title={isLogin ? 'Create Account' : 'Have an account? Log In'} 
                variant="secondary"
                onPress={() => setIsLogin(!isLogin)} 
              />
            </View>
          </ThemedView>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    padding: 24,
  },
  title: {
    marginBottom: 24,
    textAlign: 'center',
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
});
