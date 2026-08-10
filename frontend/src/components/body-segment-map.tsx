'use client';

/* eslint-disable @next/next/no-img-element */

export type BodySilhouette = 'MALE' | 'FEMALE' | 'NEUTRAL';
export type BodySegmentId = 'RIGHT_ARM' | 'LEFT_ARM' | 'TRUNK' | 'RIGHT_LEG' | 'LEFT_LEG';

const SEGMENT_LABELS: Record<BodySegmentId, string> = {
  RIGHT_ARM: 'Braço direito',
  LEFT_ARM: 'Braço esquerdo',
  TRUNK: 'Tronco',
  RIGHT_LEG: 'Perna direita',
  LEFT_LEG: 'Perna esquerda',
};

const ACCENT = 'var(--segmental-accent)';

const SEGMENTS: BodySegmentId[] = ['RIGHT_ARM', 'LEFT_ARM', 'TRUNK', 'RIGHT_LEG', 'LEFT_LEG'];

/** Ilustração-base (Camada 1) por variante — imagem fiel à referência aprovada pelo PO. Só
 * feminina e masculina têm arte aprovada até o momento; neutra fica pendente de referência. */
interface IllustrationAsset {
  src: string;
  /** Dimensões nativas do PNG — definem a proporção do componente. */
  width: number;
  height: number;
}

const ASSETS: Partial<Record<BodySilhouette, IllustrationAsset>> = {
  FEMALE: { src: '/illustrations/body-female.png', width: 1024, height: 1536 },
  MALE: { src: '/illustrations/body-male.png', width: 1024, height: 1536 },
};

/** Região de interação (Camada 2) — retângulo em % da largura/altura da imagem, calibrado a
 * partir dos pixels reais de cada ilustração (não é geometria anatômica própria: é um hitbox
 * aproximado sobre a arte já pronta). x/y em percentual 0–100 do canto superior esquerdo. */
interface OverlayRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const REGIONS: Partial<Record<BodySilhouette, Record<BodySegmentId, OverlayRegion>>> = {
  FEMALE: {
    TRUNK: { x0: 34.1, y0: 22.1, x1: 65.4, y1: 59.9 },
    RIGHT_ARM: { x0: 27.3, y0: 22.1, x1: 38.1, y1: 60.2 },
    LEFT_ARM: { x0: 61.0, y0: 22.1, x1: 72.8, y1: 60.2 },
    RIGHT_LEG: { x0: 34.7, y0: 59.9, x1: 48.8, y1: 99.1 },
    LEFT_LEG: { x0: 50.3, y0: 59.9, x1: 64.5, y1: 99.1 },
  },
  MALE: {
    TRUNK: { x0: 33.2, y0: 20.2, x1: 66.4, y1: 62.8 },
    RIGHT_ARM: { x0: 24.9, y0: 20.2, x1: 36.6, y1: 62.2 },
    LEFT_ARM: { x0: 62.5, y0: 20.2, x1: 74.2, y1: 62.2 },
    RIGHT_LEG: { x0: 30.8, y0: 62.8, x1: 48.8, y1: 98.0 },
    LEFT_LEG: { x0: 50.3, y0: 62.8, x1: 68.8, y1: 98.0 },
  },
};

interface BodySegmentMapProps {
  silhouette: BodySilhouette;
  /** Segmentos com pelo menos uma medida registrada — os demais aparecem esmaecidos na figura. */
  dataSegments?: Partial<Record<BodySegmentId, boolean>>;
  selectedSegment?: BodySegmentId;
  hoveredSegment?: BodySegmentId | null;
  onSegmentClick?: (segment: BodySegmentId) => void;
  onSegmentHover?: (segment: BodySegmentId | null) => void;
  /** Largura de renderização em px — a altura é derivada da proporção nativa da ilustração. */
  size?: number;
  className?: string;
  interactive?: boolean;
}

/**
 * Ilustração corporal — Camada 1 é a arte aprovada pelo PO (imagem estática, fiel à referência
 * visual); Camada 2 é um overlay SVG transparente por cima, responsável somente pela interação
 * (hover/seleção por segmento). A arte nunca é recolorida — o destaque é sempre um overlay verde
 * translúcido + contorno, para não sujar a roupa/pele já ilustrada.
 *
 * Feminina e masculina usam a arte aprovada; neutra ainda não tem referência visual e cai para
 * `null` até que uma seja fornecida.
 */
export function BodySegmentMap({
  silhouette,
  dataSegments,
  selectedSegment,
  hoveredSegment,
  onSegmentClick,
  onSegmentHover,
  size = 220,
  className,
  interactive = false,
}: BodySegmentMapProps) {
  const asset = ASSETS[silhouette];
  const regions = REGIONS[silhouette];

  if (!asset || !regions) {
    return null;
  }

  const height = size * (asset.height / asset.width);
  const clickable = interactive || !!onSegmentClick;

  function isActive(segment: BodySegmentId) {
    return hoveredSegment === segment || selectedSegment === segment;
  }

  function hasData(segment: BodySegmentId) {
    return dataSegments?.[segment] ?? false;
  }

  return (
    <div
      className={className}
      style={{ position: 'relative', width: size, height, lineHeight: 0 }}
      role="img"
      aria-label={`Silhueta corporal — variante ${silhouette === 'MALE' ? 'masculina' : silhouette === 'FEMALE' ? 'feminina' : 'neutra'}`}
    >
      <img src={asset.src} alt="" width={asset.width} height={asset.height} style={{ display: 'block', width: '100%', height: '100%' }} draggable={false} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} aria-hidden>
        {SEGMENTS.map((segment) => {
          const r = regions[segment];
          const active = isActive(segment);
          return (
            <rect
              key={segment}
              x={r.x0}
              y={r.y0}
              width={r.x1 - r.x0}
              height={r.y1 - r.y0}
              rx={2.5}
              ry={2.5}
              fill={ACCENT}
              fillOpacity={active ? 0.24 : 0}
              stroke={ACCENT}
              strokeOpacity={active ? 0.9 : 0}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              opacity={hasData(segment) ? 1 : 0.5}
              className="transition-[fill-opacity,stroke-opacity] duration-200 print:transition-none"
              style={{ cursor: clickable ? 'pointer' : onSegmentHover ? 'default' : undefined, pointerEvents: onSegmentHover || onSegmentClick ? 'auto' : 'none' }}
              onClick={onSegmentClick ? () => onSegmentClick(segment) : undefined}
              onMouseEnter={onSegmentHover ? () => onSegmentHover(segment) : undefined}
              onMouseLeave={onSegmentHover ? () => onSegmentHover(null) : undefined}
            />
          );
        })}
      </svg>
    </div>
  );
}

export { SEGMENT_LABELS as BODY_SEGMENT_LABELS };
