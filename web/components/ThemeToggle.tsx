'use client';

import { useEffect, useState } from 'react';
import { Button } from '@astryxdesign/core/Button';

type Mode = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function applyMode(mode: Mode) {
  document.documentElement.setAttribute('data-theme', mode);
  window.localStorage.setItem(STORAGE_KEY, mode);
}

// Toggles the light/dark mode Astryx resolves through `light-dark()`, via
// the `data-theme` attribute on <html> (see app/layout.tsx's blocking
// init script and node_modules/@astryxdesign/core/src/reset.css). Persists
// the choice to localStorage; defaults to prefers-color-scheme on first
// visit (handled by the init script, not here).
export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>('light');

  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setMode(current === 'dark' ? 'dark' : 'light');
    setMounted(true);
  }, []);

  const toggle = () => {
    const next: Mode = mode === 'dark' ? 'light' : 'dark';
    setMode(next);
    applyMode(next);
  };

  return (
    <Button
      label={mounted ? (mode === 'dark' ? 'Switch to light' : 'Switch to dark') : 'Theme'}
      variant="ghost"
      size="sm"
      onClick={toggle}
    />
  );
}
