/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#F8F3F0',
    tint: '#E03F5D',
    background: '#090A0E',
    foreground: '#F8F3F0',
    card: '#15161D',
    cardForeground: '#F8F3F0',
    primary: '#E03F5D',
    primaryForeground: '#FFF9F5',
    secondary: '#22232C',
    secondaryForeground: '#F2E9E6',
    muted: '#1B1C24',
    mutedForeground: '#A69DA1',
    accent: '#D6A37B',
    accentForeground: '#160F0F',
    destructive: '#E25A5A',
    destructiveForeground: '#FFF9F5',
    border: '#2D2D38',
    input: '#22232C',
    surface: '#101117',
    surfaceRaised: '#1A1B23',
    canvas: '#090A0E',
    warm: '#D6A37B',
    success: '#7CB9A7',
  },
  dark: {
    text: '#F8F3F0',
    tint: '#E03F5D',
    background: '#090A0E',
    foreground: '#F8F3F0',
    card: '#15161D',
    cardForeground: '#F8F3F0',
    primary: '#E03F5D',
    primaryForeground: '#FFF9F5',
    secondary: '#22232C',
    secondaryForeground: '#F2E9E6',
    muted: '#1B1C24',
    mutedForeground: '#A69DA1',
    accent: '#D6A37B',
    accentForeground: '#160F0F',
    destructive: '#E25A5A',
    destructiveForeground: '#FFF9F5',
    border: '#2D2D38',
    input: '#22232C',
    surface: '#101117',
    surfaceRaised: '#1A1B23',
    canvas: '#090A0E',
    warm: '#D6A37B',
    success: '#7CB9A7',
  },
  radius: 14,
};

export default colors;
