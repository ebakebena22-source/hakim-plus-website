export function GoogleIcon({ className = "h-5 w-5" }) {
  return <img src="/google-icon.png" alt="" aria-hidden="true" className={`shrink-0 object-contain ${className}`} />;
}

export function WhatsAppIcon({ variant = "green", className = "h-5 w-5" }) {
  const src = variant === "white" ? "/whatsapp-white.png" : "/whatsapp-green.png";
  return <img src={src} alt="" aria-hidden="true" className={`shrink-0 object-contain ${className}`} />;
}
