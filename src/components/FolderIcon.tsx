import React from 'react';

interface FolderIconProps {
  size?: number;
  className?: string;
  primaryColor?: string; // Overrides the back wall fill color (e.g. Hex or tailwind color name)
  secondaryColor?: string; // Overrides the front flap fill color
  color?: string | null; // Base custom color (e.g. Hex color #3b82f6)
  open?: boolean;
}

export const FolderIcon: React.FC<FolderIconProps> = ({
  size = 20,
  className = "",
  primaryColor,
  secondaryColor,
  color,
  open = false,
}) => {
  const baseColor = color || "currentColor";
  const backFill = primaryColor || baseColor;
  const frontFill = secondaryColor || baseColor;
  const strokeColor = color ? color : "currentColor";
  
  // Use slightly custom opacity settings to ensure that hex custom colors display as high-quality double-tone folders
  const backOpacity = primaryColor ? "1.0" : "0.35";
  const frontOpacity = secondaryColor ? "1.0" : "0.80";

  return open ? (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ minWidth: size, minHeight: size }}
    >
      {/* Folder Back Wall and Tab */}
      <path
        d="M3 7V5C3 4.44772 3.44772 4 4 4H9.5L11.5 7.5H20C20.5523 7.5 21 7.94772 21 8.5V18.5C21 19.0523 20.5523 19.5 20 19.5H4C3.44772 19.5 3 19.0523 3 18.5V7Z"
        fill={backFill}
        fillOpacity={backOpacity}
      />
      {/* Inner Documents */}
      <path d="M7 5H17M9 7H15" stroke={strokeColor} strokeWidth="1.2" strokeOpacity="0.4" />
      {/* Folder Front Flap (Open) */}
      <path
        d="M3 10L4.5 19C4.6 19.3 4.85 19.5 5.15 19.5H18.85C19.15 19.5 19.4 19.3 19.5 19L21 10H3Z"
        fill={frontFill}
        fillOpacity={frontOpacity}
      />
    </svg>
  ) : (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={strokeColor}
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ minWidth: size, minHeight: size }}
    >
      {/* Folder Back Wall and Tab */}
      <path
        d="M3 7V5C3 4.44772 3.44772 4 4 4H9.5L11.5 7.5H20C20.5523 7.5 21 7.94772 21 8.5V18.5C21 19.0523 20.5523 19.5 20 19.5H4C3.44772 19.5 3 19.0523 3 18.5V7Z"
        fill={backFill}
        fillOpacity={backOpacity}
      />
      {/* Folder Front Flap (Closed) */}
      <path
        d="M3 8.5L3.5 18.5C3.5 19.0523 3.94772 19.5 4.5 19.5H19.5C20.0523 19.5 20.5 19.0523 20.5 18.5L21 8.5H3Z"
        fill={frontFill}
        fillOpacity={frontOpacity}
      />
      {/* Inner shadow */}
      <path d="M3.5 8.5H20.5" stroke={strokeColor} strokeWidth="1.2" strokeOpacity="0.25" />
    </svg>
  );
};
