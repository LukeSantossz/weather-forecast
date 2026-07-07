// Self-hosted Google Fonts for the locked type system (.ulpi/design/DESIGN.md § Type).
// Fraunces = display (serif), Hanken Grotesk = body/UI, IBM Plex Mono = data/mono.
// Each is exposed as a CSS variable and bound to Astryx's font-family tokens
// in `theme.css` (--font-family-heading / --font-family-body / --font-family-code).
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from 'next/font/google';

export const display = Fraunces({
  subsets: ['latin'],
  weight: ['500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});

export const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});
