export const brandLogoUrl = "/hakim-plus-logo.png";

export default function BrandLogo({ className = "h-11 w-11 rounded-2xl", alt = "" }) {
  return (
    <img
      src={brandLogoUrl}
      alt={alt}
      className={`shrink-0 object-cover ${className}`}
      width="1080"
      height="1080"
    />
  );
}
