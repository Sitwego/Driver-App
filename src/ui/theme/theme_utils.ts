export const BLUE_HUE = 210;
export const RED_HUE = 346;
export const GREEN_HUE = 152;

/**
 * Smooth progression of lightness "stops" for generating HSL colors.
 */
export const COLOR_STOPS = [
  0, 0.05, 0.1, 0.15, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 1,
];

export function generateScale(start: number, end: number) {
  const range = end - start;
  return COLOR_STOPS.map((stop) => {
    return start + range * stop;
  });
}

export const defaultScale = generateScale(6, 100);
// dim shifted 6% lighter
export const dimScale = generateScale(12, 100);
export const themes = createThemeColors({
  primary: BLUE_HUE, // 211
  negative: RED_HUE, // 346
  positive: GREEN_HUE, // 152
  background: 197,
});

export function createThemeColors(hues: {
  primary: number;
  negative: number;
  positive: number;
  background: number;
}) {
  const colors = {
    green_25: `hsl(${hues.positive}, 82%, 97%)`,
    green_50: `hsl(${hues.positive}, 82%, 95%)`,
    green_100: `hsl(${hues.positive}, 82%, 90%)`,
    green_200: `hsl(${hues.positive}, 82%, 80%)`,
    green_300: `hsl(${hues.positive}, 82%, 70%)`,
    green_400: `hsl(${hues.positive}, 82%, 60%)`,
    green_500: `hsl(${hues.positive}, 82%, 50%)`,
    green_600: `hsl(${hues.positive}, 82%, 42%)`,
    green_700: `hsl(${hues.positive}, 82%, 34%)`,
    green_800: `hsl(${hues.positive}, 82%, 26%)`,
    green_900: `hsl(${hues.positive}, 82%, 18%)`,
    green_950: `hsl(${hues.positive}, 82%, 10%)`,
    green_975: `hsl(${hues.positive}, 82%, 7%)`,

    primary_25: `hsl(${hues.primary}, 100%, 97%)`,
    primary_50: `hsl(${hues.primary}, 100%, 95%)`,
    primary_100: `hsl(${hues.primary}, 100%, 90%)`,
    primary_200: `hsl(${hues.primary}, 100%, 80%)`,
    primary_300: `hsl(${hues.primary}, 100%, 70%)`,
    primary_400: `hsl(${hues.primary}, 100%, 60%)`,
    primary_500: `hsl(${hues.primary}, 100%, 52%)`,
    primary_600: `hsl(${hues.primary}, 100%, 42%)`,
    primary_700: `hsl(${hues.primary}, 100%, 34%)`,
    primary_800: `hsl(${hues.primary}, 100%, 26%)`,
    primary_900: `hsl(${hues.primary}, 100%, 18%)`,
    primary_950: `hsl(${hues.primary}, 100%, 10%)`,
    primary_975: `hsl(${hues.primary}, 100%, 7%)`,

    // 197°, 42%, 20%
    bg_50: `hsl(${hues.background}, 42%, 95%)`,
    bg_100: `hsl(${hues.background}, 42%, 90%)`,
    bg_200: `hsl(${hues.background}, 42%, 80%)`,
    bg_300: `hsl(${hues.background}, 42%, 70%)`,
    bg_400: `hsl(${hues.background}, 42%, 60%)`,
    bg_500: `hsl(${hues.background}, 42%, 52%)`,
    bg_600: `hsl(${hues.background}, 42%, 42%)`,
    bg_700: `hsl(${hues.background}, 42%, 34%)`,
    bg_800: `hsl(${hues.background}, 42%, 26%)`,
    bg_900: `hsl(${hues.background}, 42%, 18%)`,
    bg_950: `hsl(${hues.background}, 42%, 10%)`,
    bg_975: `hsl(${hues.background}, 42%, 7%)`,

    //import { connect } from 'react-redux'
    red_25: `hsl(${hues.negative}, 91%, 97%)`,
    red_50: `hsl(${hues.negative}, 91%, 95%)`,
    red_100: `hsl(${hues.negative}, 91%, 90%)`,
    red_200: `hsl(${hues.negative}, 91%, 80%)`,
    red_300: `hsl(${hues.negative}, 91%, 70%)`,
    red_400: `hsl(${hues.negative}, 91%, 60%)`,
    red_500: `hsl(${hues.negative}, 91%, 50%)`,
    red_600: `hsl(${hues.negative}, 91%, 42%)`,
    red_700: `hsl(${hues.negative}, 91%, 34%)`,
    red_800: `hsl(${hues.negative}, 91%, 26%)`,
    red_900: `hsl(${hues.negative}, 91%, 18%)`,
    red_950: `hsl(${hues.negative}, 91%, 10%)`,
    red_975: `hsl(${hues.negative}, 91%, 7%)`,

    gray_0: `hsl(${hues.primary}, 20%, ${defaultScale[14]}%)`,
    gray_25: `hsl(${hues.primary}, 20%, ${defaultScale[13]}%)`,
    gray_50: `hsl(${hues.primary}, 20%, ${defaultScale[12]}%)`,
    gray_100: `hsl(${hues.primary}, 20%, ${defaultScale[11]}%)`,
    gray_200: `hsl(${hues.primary}, 20%, ${defaultScale[10]}%)`,
    gray_300: `hsl(${hues.primary}, 20%, ${defaultScale[9]}%)`,
    gray_400: `hsl(${hues.primary}, 20%, ${defaultScale[8]}%)`,
    gray_500: `hsl(${hues.primary}, 20%, ${defaultScale[7]}%)`,
    gray_600: `hsl(${hues.primary}, 24%, ${defaultScale[6]}%)`,
    gray_700: `hsl(${hues.primary}, 24%, ${defaultScale[5]}%)`,
    gray_800: `hsl(${hues.primary}, 28%, ${defaultScale[4]}%)`,
    gray_900: `hsl(${hues.primary}, 28%, ${defaultScale[3]}%)`,
    gray_950: `hsl(${hues.primary}, 28%, ${defaultScale[2]}%)`,
    gray_975: `hsl(${hues.primary}, 28%, ${defaultScale[1]}%)`,
    gray_1000: `hsl(${hues.primary}, 28%, ${defaultScale[0]}%)`,
  };

  return {
    ...colors,
    transparent: "#0c0c0c5",
  };
}
