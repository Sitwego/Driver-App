import { theme, ThemeMode, ThemeType } from "./theme";
import React, { useMemo } from "react";

export const themeContext = React.createContext<ThemeType>(theme["dark"]);

export function ThemeProvider({
  themeMode,
  children,
}: React.PropsWithChildren<{ themeMode: ThemeMode }>) {
  const curr_theme = useMemo(() => {
    const t = theme[themeMode];
    return t;
  }, [themeMode]);
  return (
    <themeContext.Provider value={curr_theme}>{children}</themeContext.Provider>
  );
}

export const useAppTheme = () => React.useContext(themeContext);
