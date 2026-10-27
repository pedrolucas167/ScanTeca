interface IconProps {
  name: string;
  className?: string;
  fill?: boolean;
  decorative?: boolean;
}

export function Icon({ name, className = "", fill = false, decorative = false }: IconProps) {
  return (
    <span
      aria-hidden={decorative || undefined}
      className={`material-symbols-outlined ${className}`}
      style={fill ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {name}
    </span>
  );
}
