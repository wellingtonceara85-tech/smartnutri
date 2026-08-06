'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getProfessionalProfile } from '@/lib/api/professional-profile';
import { useAuth } from '@/lib/auth-context';

const THEME_CSS_VARS = [
  '--primary',
  '--primary-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--ring',
  '--sidebar-ring',
] as const;

function hexToRgb(hex: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Escolhe texto claro ou escuro pelo brilho percebido da cor de fundo — nunca assume contraste. */
function contrastingForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'oklch(0.985 0 0)';
  const [r, g, b] = rgb;
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? 'oklch(0.205 0 0)' : 'oklch(0.985 0 0)';
}

/**
 * Aplica a paleta do profissional (ProfessionalProfile.primaryColor/secondaryColor)
 * como override das CSS custom properties do tema — sem paleta configurada,
 * os valores padrão do globals.css continuam valendo.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { accessToken, status } = useAuth();

  const profileQuery = useQuery({
    queryKey: ['professional-profile'],
    queryFn: () => getProfessionalProfile(accessToken!),
    enabled: status === 'authenticated' && !!accessToken,
    staleTime: 60_000,
  });

  useEffect(() => {
    const profile = profileQuery.data;
    if (!profile) {
      return;
    }
    const root = document.documentElement;
    const foreground = contrastingForeground(profile.primaryColor);
    root.style.setProperty('--primary', profile.primaryColor);
    root.style.setProperty('--primary-foreground', foreground);
    root.style.setProperty('--sidebar-primary', profile.primaryColor);
    root.style.setProperty('--sidebar-primary-foreground', foreground);
    root.style.setProperty('--ring', profile.secondaryColor);
    root.style.setProperty('--sidebar-ring', profile.secondaryColor);

    return () => {
      for (const cssVar of THEME_CSS_VARS) {
        root.style.removeProperty(cssVar);
      }
    };
  }, [profileQuery.data]);

  return <>{children}</>;
}
