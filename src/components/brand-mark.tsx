import { BRAND } from "@/lib/brand";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`stone-mark ${className}`}
      dangerouslySetInnerHTML={{ __html: BRAND.mark }}
    />
  );
}
