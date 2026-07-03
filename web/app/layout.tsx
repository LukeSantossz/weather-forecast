import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';

export const metadata = { title: 'Weather Dashboard — Astryx spike' };

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-astryx-theme="neutral">
      <body>{children}</body>
    </html>
  );
}
