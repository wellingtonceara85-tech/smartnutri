'use client';

export type BodySilhouette = 'MALE' | 'FEMALE' | 'NEUTRAL';
export type BodySegmentId = 'RIGHT_ARM' | 'LEFT_ARM' | 'TRUNK' | 'RIGHT_LEG' | 'LEFT_LEG';

interface SilhouetteLayout {
  shoulderWidth: number;
  hipWidth: number;
  waistWidth: number;
  armWidth: number;
  legWidth: number;
}

// Larguras relativas por variante — só a silhueta muda; o esqueleto (posições Y) é o mesmo.
const LAYOUTS: Record<BodySilhouette, SilhouetteLayout> = {
  MALE: { shoulderWidth: 76, hipWidth: 56, waistWidth: 52, armWidth: 20, legWidth: 26 },
  FEMALE: { shoulderWidth: 62, hipWidth: 68, waistWidth: 42, armWidth: 17, legWidth: 24 },
  NEUTRAL: { shoulderWidth: 66, hipWidth: 60, waistWidth: 50, armWidth: 18, legWidth: 25 },
};

const SEGMENT_LABELS: Record<BodySegmentId, string> = {
  RIGHT_ARM: 'Braço direito',
  LEFT_ARM: 'Braço esquerdo',
  TRUNK: 'Tronco',
  RIGHT_LEG: 'Perna direita',
  LEFT_LEG: 'Perna esquerda',
};

const DEFAULT_FILL = 'var(--muted)';
const STROKE = 'var(--border)';

interface BodySegmentMapProps {
  silhouette: BodySilhouette;
  segmentColors?: Partial<Record<BodySegmentId, string>>;
  selectedSegment?: BodySegmentId;
  onSegmentClick?: (segment: BodySegmentId) => void;
  size?: number;
  className?: string;
}

/**
 * Mapa corporal original em SVG — três variantes (masculino/feminino/neutro)
 * compartilhando o mesmo esqueleto de coordenadas, só a largura dos segmentos
 * muda. A escolha da variante é sempre manual (Patient.bodySilhouettePreference),
 * nunca inferida deste componente.
 */
export function BodySegmentMap({
  silhouette,
  segmentColors,
  selectedSegment,
  onSegmentClick,
  size = 220,
  className,
}: BodySegmentMapProps) {
  const layout = LAYOUTS[silhouette];
  const cx = 120;

  const shoulderY = 100;
  const waistY = 210;
  const hipY = 240;
  const kneeY = 340;
  const footY = 440;
  const handY = 300;

  function fillFor(segment: BodySegmentId) {
    if (selectedSegment === segment) return 'var(--primary)';
    return segmentColors?.[segment] ?? DEFAULT_FILL;
  }

  function segmentProps(segment: BodySegmentId) {
    return {
      fill: fillFor(segment),
      stroke: STROKE,
      strokeWidth: 1.5,
      onClick: onSegmentClick ? () => onSegmentClick(segment) : undefined,
      style: onSegmentClick ? { cursor: 'pointer' } : undefined,
      role: onSegmentClick ? 'button' : undefined,
      'aria-label': SEGMENT_LABELS[segment],
    };
  }

  return (
    <svg
      viewBox="0 0 240 460"
      width={size}
      height={size * (460 / 240)}
      className={className}
      role="img"
      aria-label={`Mapa corporal — silhueta ${silhouette === 'MALE' ? 'masculina' : silhouette === 'FEMALE' ? 'feminina' : 'neutra'}`}
    >
      {/* Cabeça e pescoço — neutros, não fazem parte de nenhum segmento mensurável */}
      <circle cx={cx} cy={40} r={26} fill="var(--muted)" stroke={STROKE} strokeWidth={1.5} />
      <rect x={cx - 10} y={62} width={20} height={22} fill="var(--muted)" stroke={STROKE} strokeWidth={1.5} />

      {/* Tronco */}
      <path
        {...segmentProps('TRUNK')}
        d={`M ${cx - layout.shoulderWidth / 2} ${shoulderY}
            L ${cx + layout.shoulderWidth / 2} ${shoulderY}
            L ${cx + layout.waistWidth / 2} ${waistY}
            L ${cx + layout.hipWidth / 2} ${hipY}
            L ${cx - layout.hipWidth / 2} ${hipY}
            L ${cx - layout.waistWidth / 2} ${waistY}
            Z`}
      />

      {/* Braço direito (anatômico) — aparece à esquerda de quem olha a figura de frente */}
      <rect
        {...segmentProps('RIGHT_ARM')}
        x={cx - layout.shoulderWidth / 2 - layout.armWidth}
        y={shoulderY}
        width={layout.armWidth}
        height={handY - shoulderY}
        rx={layout.armWidth / 2}
      />

      {/* Braço esquerdo (anatômico) — aparece à direita de quem olha a figura de frente */}
      <rect
        {...segmentProps('LEFT_ARM')}
        x={cx + layout.shoulderWidth / 2}
        y={shoulderY}
        width={layout.armWidth}
        height={handY - shoulderY}
        rx={layout.armWidth / 2}
      />

      {/* Perna direita (anatômica) */}
      <rect
        {...segmentProps('RIGHT_LEG')}
        x={cx - layout.hipWidth / 2 + 2}
        y={hipY}
        width={layout.legWidth}
        height={footY - hipY}
        rx={layout.legWidth / 2.4}
      />

      {/* Perna esquerda (anatômica) */}
      <rect
        {...segmentProps('LEFT_LEG')}
        x={cx + layout.hipWidth / 2 - layout.legWidth - 2}
        y={hipY}
        width={layout.legWidth}
        height={footY - hipY}
        rx={layout.legWidth / 2.4}
      />

      {/* Linha de referência dos joelhos, só estética */}
      <line
        x1={cx - layout.hipWidth / 2}
        y1={kneeY}
        x2={cx + layout.hipWidth / 2}
        y2={kneeY}
        stroke={STROKE}
        strokeDasharray="2 4"
        opacity={0.3}
      />
    </svg>
  );
}

export { SEGMENT_LABELS as BODY_SEGMENT_LABELS };
