import React, { useMemo } from "react";
import { icons as LucideIcons } from "lucide-react-native";
type LucideIconComponent = React.ComponentType<
  React.ComponentProps<(typeof LucideIcons)[keyof typeof LucideIcons]>
>;

type IconName = keyof typeof LucideIcons;

interface IconProps {
  name: IconName; // Allow any string for icon name
  size?: number;
  strokeWidth?: number;
  color?: string;
  [key: string]: any; // Allow other SVG props
}

const Icon: React.FC<IconProps> = ({
  name,
  strokeWidth = 2,
  color,
  ...props
}) => {
  const IconComponent = useMemo(() => {
    // eslint-disable-next-line import/namespace
    const icon = LucideIcons[name as IconName];
    if (!icon) {
      console.warn(`Icon "${name}" not found in Lucide icons.`);
      return () => null;
    }

    return icon as LucideIconComponent;
  }, [name]);

  return <IconComponent strokeWidth={strokeWidth} color={color} {...props} />;
};

export default Icon;
