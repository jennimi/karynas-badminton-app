import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';
import { useTheme } from '../theme/ThemeProvider';

/** Toast notifications themed to match the app. Use: import { toast } from 'sonner'. */
export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();
  return (
    <SonnerToaster
      theme={theme}
      position="top-center"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-control)',
          fontFamily: 'var(--font-sans)',
          fontWeight: 700,
        },
      }}
      {...props}
    />
  );
}
