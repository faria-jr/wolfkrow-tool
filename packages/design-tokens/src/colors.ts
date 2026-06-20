/**
 * Wolfkrow Design Tokens — Colors
 *
 * Single source of truth for all color values.
 * Use these tokens instead of hardcoding hex/oklch values.
 */

export const palette = {
  amber: {
    50: 'oklch(0.98 0.016 73.684)',
    100: 'oklch(0.962 0.044 73.684)',
    200: 'oklch(0.924 0.092 75.164)',
    300: 'oklch(0.879 0.141 75.945)',
    400: 'oklch(0.828 0.189 75.764)',
    500: 'oklch(0.769 0.188 70.08)',
    600: 'oklch(0.666 0.179 58.318)',
    700: 'oklch(0.553 0.166 47.085)',
    800: 'oklch(0.47 0.146 40.124)',
    900: 'oklch(0.414 0.116 35.084)',
    950: 'oklch(0.279 0.077 30.084)',
  },
  zinc: {
    50: 'oklch(0.985 0 0)',
    100: 'oklch(0.967 0.001 286.375)',
    200: 'oklch(0.92 0.004 286.32)',
    300: 'oklch(0.871 0.006 286.286)',
    400: 'oklch(0.705 0.015 286.067)',
    500: 'oklch(0.552 0.016 285.938)',
    600: 'oklch(0.442 0.017 285.786)',
    700: 'oklch(0.37 0.013 285.805)',
    800: 'oklch(0.274 0.006 286.033)',
    900: 'oklch(0.21 0.006 285.885)',
    950: 'oklch(0.141 0.005 285.823)',
  },
  blue: {
    50: 'oklch(0.97 0.014 254.604)',
    100: 'oklch(0.932 0.032 255.585)',
    200: 'oklch(0.882 0.059 254.128)',
    300: 'oklch(0.809 0.105 251.813)',
    400: 'oklch(0.707 0.165 254.624)',
    500: 'oklch(0.623 0.214 259.815)',
    600: 'oklch(0.546 0.245 262.881)',
    700: 'oklch(0.488 0.243 264.376)',
    800: 'oklch(0.424 0.199 265.638)',
    900: 'oklch(0.38 0.176 265.522)',
    950: 'oklch(0.282 0.091 267.935)',
  },
  green: {
    50: 'oklch(0.982 0.018 155.826)',
    100: 'oklch(0.962 0.044 156.756)',
    200: 'oklch(0.925 0.084 155.995)',
    300: 'oklch(0.871 0.143 164.978)',
    400: 'oklch(0.792 0.171 152.069)',
    500: 'oklch(0.696 0.17 162.48)',
    600: 'oklch(0.596 0.143 163.225)',
    700: 'oklch(0.508 0.118 165.612)',
    800: 'oklch(0.432 0.095 166.913)',
    900: 'oklch(0.378 0.077 168.94)',
    950: 'oklch(0.262 0.051 172.42)',
  },
  red: {
    50: 'oklch(0.971 0.013 17.38)',
    100: 'oklch(0.936 0.032 17.717)',
    200: 'oklch(0.885 0.062 18.334)',
    300: 'oklch(0.808 0.114 19.571)',
    400: 'oklch(0.704 0.191 22.216)',
    500: 'oklch(0.637 0.237 25.331)',
    600: 'oklch(0.577 0.245 27.325)',
    700: 'oklch(0.505 0.213 27.518)',
    800: 'oklch(0.444 0.177 26.899)',
    900: 'oklch(0.396 0.141 25.723)',
    950: 'oklch(0.258 0.092 26.042)',
  },
} as const;

export const semanticColors = {
  background: 'var(--background)',
  foreground: 'var(--foreground)',
  primary: 'var(--primary)',
  'primary-foreground': 'var(--primary-foreground)',
  secondary: 'var(--secondary)',
  'secondary-foreground': 'var(--secondary-foreground)',
  muted: 'var(--muted)',
  'muted-foreground': 'var(--muted-foreground)',
  accent: 'var(--accent)',
  'accent-foreground': 'var(--accent-foreground)',
  destructive: 'var(--destructive)',
  'destructive-foreground': 'var(--destructive-foreground)',
  success: palette.green[500],
  warning: palette.amber[500],
  info: palette.blue[500],
  border: 'var(--border)',
  input: 'var(--input)',
  ring: 'var(--ring)',
} as const;

export type ColorToken = keyof typeof semanticColors;
