import { lightTheme, darkTheme } from '../src/constants/theme';

describe('Theme constants', () => {
  describe('lightTheme', () => {
    it('has warm cream background', () => {
      expect(lightTheme.background).toBe('#F5F0E8');
    });

    it('has surface color for cards', () => {
      expect(lightTheme.surface).toBe('#FFFEF2');
    });

    it('has yellow primary accent', () => {
      expect(lightTheme.primary).toBe('#FFE500');
    });

    it('has teal accent color', () => {
      expect(lightTheme.accent).toBe('#00C2CB');
    });

    it('has black border', () => {
      expect(lightTheme.border).toBe('#111111');
    });

    it('has error color', () => {
      expect(lightTheme.error).toBe('#FF3B30');
    });

    it('has success color', () => {
      expect(lightTheme.success).toBe('#00C853');
    });

    it('has muted text color', () => {
      expect(lightTheme.textMuted).toBe('#666666');
    });
  });

  describe('darkTheme', () => {
    it('has dark background', () => {
      expect(darkTheme.background).toBe('#0F0F0F');
    });

    it('has cream text for readability on dark', () => {
      expect(darkTheme.text).toBe('#F5F0E8');
    });

    it('keeps same yellow primary accent', () => {
      expect(darkTheme.primary).toBe('#FFE500');
    });

    it('has cream border color for dark mode', () => {
      expect(darkTheme.border).toBe('#F5F0E8');
    });

    it('has dark card background', () => {
      expect(darkTheme.card).toBe('#222222');
    });

    it('has yellow shadow for dark mode', () => {
      expect(darkTheme.shadow).toBe('#FFE500');
    });

    it('has dark error color', () => {
      expect(darkTheme.error).toBe('#FF453A');
    });
  });

  describe('theme consistency', () => {
    it('both themes have the same set of keys', () => {
      const lightKeys = Object.keys(lightTheme).sort();
      const darkKeys = Object.keys(darkTheme).sort();
      expect(lightKeys).toEqual(darkKeys);
    });

    it('primary yellow is the same in both themes', () => {
      expect(lightTheme.primary).toBe(darkTheme.primary);
    });

    it('accent teal is the same in both themes', () => {
      expect(lightTheme.accent).toBe(darkTheme.accent);
    });

    it('success green is the same in both themes', () => {
      expect(lightTheme.success).toBe(darkTheme.success);
    });
  });
});

describe('ShareScreen helpers', () => {
  const isExpired = (expiresAt: string | null): boolean => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  it('returns false when expiresAt is null (never expires)', () => {
    expect(isExpired(null)).toBe(false);
  });

  it('returns true for a past date', () => {
    expect(isExpired('2020-01-01T00:00:00Z')).toBe(true);
  });

  it('returns false for a future date', () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
    expect(isExpired(future)).toBe(false);
  });
});
