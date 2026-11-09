import icons from "./icons.json";

// SVG paths are static assets captured from the supplied visual reference.
export function Icon({ name, size = 16, className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icons[name] || icons.clipboard }}
    />
  );
}
