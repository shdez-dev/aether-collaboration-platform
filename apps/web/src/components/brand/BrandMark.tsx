import Image from 'next/image';

type BrandMarkProps = {
  size?: number;
  tone?: 'violet' | 'light' | 'adaptive';
  className?: string;
};

/** The supplied AETHER symbol. Its accessible name belongs on the surrounding link. */
export function BrandMark({ size = 32, tone = 'violet', className }: BrandMarkProps) {
  if (tone === 'adaptive') {
    return (
      <span className={`brand-mark-adaptive${className ? ` ${className}` : ''}`} style={{ display: 'block', width: size, height: size, flexShrink: 0 }}>
        <Image src="/brand/logo-violeta.svg" alt="" aria-hidden="true" width={size} height={size} unoptimized className="brand-mark-for-light" />
        <Image src="/brand/logo-claro.svg" alt="" aria-hidden="true" width={size} height={size} unoptimized className="brand-mark-for-dark" />
      </span>
    );
  }

  return (
    <Image
      src={`/brand/logo-${tone === 'light' ? 'claro' : 'violeta'}.svg`}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      unoptimized
      className={className}
      style={{ display: 'block', width: size, height: size, objectFit: 'contain', flexShrink: 0 }}
    />
  );
}
