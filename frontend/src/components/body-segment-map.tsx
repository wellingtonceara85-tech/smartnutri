'use client';

export type BodySilhouette = 'MALE' | 'FEMALE' | 'NEUTRAL';
export type BodySegmentId = 'RIGHT_ARM' | 'LEFT_ARM' | 'TRUNK' | 'RIGHT_LEG' | 'LEFT_LEG';

interface SilhouetteMetrics {
  shoulderWidth: number;
  waistWidth: number;
  hipWidth: number;
  bicepWidth: number;
  wristWidth: number;
  thighWidth: number;
  calfWidth: number;
}

// Larguras relativas por variante — só a silhueta muda; o esqueleto (posições Y) é o mesmo.
const METRICS: Record<BodySilhouette, SilhouetteMetrics> = {
  MALE: { shoulderWidth: 100, waistWidth: 64, hipWidth: 68, bicepWidth: 26, wristWidth: 15, thighWidth: 32, calfWidth: 19 },
  FEMALE: { shoulderWidth: 78, waistWidth: 52, hipWidth: 82, bicepWidth: 20, wristWidth: 13, thighWidth: 32, calfWidth: 17 },
  NEUTRAL: { shoulderWidth: 88, waistWidth: 58, hipWidth: 74, bicepWidth: 23, wristWidth: 14, thighWidth: 31, calfWidth: 18 },
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

const CX = 100;
const SHOULDER_Y = 66;
const WAIST_Y = 172;
const HIP_Y = 200;
const ARM_TOP_Y = 72;
const WRIST_Y = 236;
const LEG_TOP_Y = 196;
const ANKLE_Y = 380;
const FOOT_Y = 392;

/** Cápsula cônica (topo/base arredondados, lados curvos) usada para braços e pernas. */
function taperedCapsulePath(cxLimb: number, yTop: number, yBottom: number, widthTop: number, widthBottom: number): string {
  const rTop = widthTop / 2;
  const rBottom = widthBottom / 2;
  const midTopY = yTop + (yBottom - yTop) * 0.38;
  const midBottomY = yTop + (yBottom - yTop) * 0.62;
  return `
    M ${cxLimb - rTop} ${yTop + rTop}
    A ${rTop} ${rTop} 0 0 1 ${cxLimb + rTop} ${yTop + rTop}
    C ${cxLimb + rTop} ${midTopY}, ${cxLimb + rBottom} ${midBottomY}, ${cxLimb + rBottom} ${yBottom - rBottom}
    A ${rBottom} ${rBottom} 0 0 1 ${cxLimb - rBottom} ${yBottom - rBottom}
    C ${cxLimb - rBottom} ${midBottomY}, ${cxLimb - rTop} ${midTopY}, ${cxLimb - rTop} ${yTop + rTop}
    Z
  `;
}

/** Torso com ombros arredondados e cintura marcada, via curvas de Bézier. */
function trunkPath(m: SilhouetteMetrics): string {
  const { shoulderWidth: sw, waistWidth: ww, hipWidth: hw } = m;
  return `
    M ${CX - sw / 2} ${SHOULDER_Y}
    C ${CX - sw / 2 - 6} ${SHOULDER_Y + 30}, ${CX - ww / 2 - 14} ${WAIST_Y - 46}, ${CX - ww / 2} ${WAIST_Y}
    C ${CX - ww / 2 - 3} ${WAIST_Y + 16}, ${CX - hw / 2} ${HIP_Y - 20}, ${CX - hw / 2} ${HIP_Y}
    L ${CX + hw / 2} ${HIP_Y}
    C ${CX + hw / 2} ${HIP_Y - 20}, ${CX + ww / 2 + 3} ${WAIST_Y + 16}, ${CX + ww / 2} ${WAIST_Y}
    C ${CX + ww / 2 + 14} ${WAIST_Y - 46}, ${CX + sw / 2 + 6} ${SHOULDER_Y + 30}, ${CX + sw / 2} ${SHOULDER_Y}
    C ${CX + sw / 2 - 14} ${SHOULDER_Y - 10}, ${CX + 20} ${SHOULDER_Y - 16}, ${CX} ${SHOULDER_Y - 14}
    C ${CX - 20} ${SHOULDER_Y - 16}, ${CX - sw / 2 + 14} ${SHOULDER_Y - 10}, ${CX - sw / 2} ${SHOULDER_Y}
    Z
  `;
}

interface LimbGeometry {
  path: string;
  footCx: number;
}

function armGeometry(m: SilhouetteMetrics, side: 'RIGHT_ARM' | 'LEFT_ARM'): string {
  const armCx = side === 'RIGHT_ARM' ? CX - m.shoulderWidth / 2 : CX + m.shoulderWidth / 2;
  return taperedCapsulePath(armCx, ARM_TOP_Y, WRIST_Y, m.bicepWidth, m.wristWidth);
}

function legGeometry(m: SilhouetteMetrics, side: 'RIGHT_LEG' | 'LEFT_LEG'): LimbGeometry {
  const legCx = side === 'RIGHT_LEG' ? CX - m.hipWidth / 2 + m.thighWidth / 2 - 1 : CX + m.hipWidth / 2 - m.thighWidth / 2 + 1;
  return { path: taperedCapsulePath(legCx, LEG_TOP_Y, ANKLE_Y, m.thighWidth, m.calfWidth), footCx: legCx };
}

interface BodySegmentMapProps {
  silhouette: BodySilhouette;
  segmentColors?: Partial<Record<BodySegmentId, string>>;
  selectedSegment?: BodySegmentId;
  hoveredSegment?: BodySegmentId | null;
  onSegmentClick?: (segment: BodySegmentId) => void;
  onSegmentHover?: (segment: BodySegmentId | null) => void;
  size?: number;
  className?: string;
  interactive?: boolean;
}

/**
 * Silhueta corporal original em SVG — três variantes (masculino/feminino/neutro) compartilhando o
 * mesmo esqueleto de coordenadas; só a largura/afunilamento dos segmentos muda. A escolha da
 * variante é sempre manual (Patient.bodySilhouettePreference), nunca inferida deste componente.
 */
export function BodySegmentMap({
  silhouette,
  segmentColors,
  selectedSegment,
  hoveredSegment,
  onSegmentClick,
  onSegmentHover,
  size = 220,
  className,
  interactive = false,
}: BodySegmentMapProps) {
  const m = METRICS[silhouette];
  const rightLeg = legGeometry(m, 'RIGHT_LEG');
  const leftLeg = legGeometry(m, 'LEFT_LEG');

  function fillFor(segment: BodySegmentId) {
    if (hoveredSegment === segment || selectedSegment === segment) return 'var(--primary)';
    return segmentColors?.[segment] ?? DEFAULT_FILL;
  }

  function segmentProps(segment: BodySegmentId) {
    const active = interactive || !!onSegmentClick;
    return {
      fill: fillFor(segment),
      stroke: STROKE,
      strokeWidth: 1.5,
      className: 'transition-colors duration-200 print:transition-none',
      onClick: onSegmentClick ? () => onSegmentClick(segment) : undefined,
      onMouseEnter: onSegmentHover ? () => onSegmentHover(segment) : undefined,
      onMouseLeave: onSegmentHover ? () => onSegmentHover(null) : undefined,
      style: active ? { cursor: onSegmentClick ? 'pointer' : 'default' } : undefined,
      'aria-hidden': true as const,
    };
  }

  return (
    <svg
      viewBox="0 0 200 400"
      width={size}
      height={size * 2}
      className={className}
      role="img"
      aria-label={`Silhueta corporal — variante ${silhouette === 'MALE' ? 'masculina' : silhouette === 'FEMALE' ? 'feminina' : 'neutra'}`}
    >
      {/* Cabeça e pescoço — neutros, não fazem parte de nenhum segmento mensurável */}
      <circle cx={CX} cy={30} r={20} fill="var(--muted)" stroke={STROKE} strokeWidth={1.5} />
      <path
        d={taperedCapsulePath(CX, 46, 68, 18, 22)}
        fill="var(--muted)"
        stroke={STROKE}
        strokeWidth={1.5}
      />

      {/* Braço direito (anatômico) — aparece à esquerda de quem olha a figura de frente */}
      <path d={armGeometry(m, 'RIGHT_ARM')} {...segmentProps('RIGHT_ARM')} />

      {/* Braço esquerdo (anatômico) — aparece à direita de quem olha a figura de frente */}
      <path d={armGeometry(m, 'LEFT_ARM')} {...segmentProps('LEFT_ARM')} />

      {/* Perna direita (anatômica) */}
      <path d={rightLeg.path} {...segmentProps('RIGHT_LEG')} />
      <ellipse cx={rightLeg.footCx} cy={FOOT_Y} rx={m.calfWidth / 2 + 4} ry={7} fill={fillFor('RIGHT_LEG')} stroke={STROKE} strokeWidth={1.5} aria-hidden />

      {/* Perna esquerda (anatômica) */}
      <path d={leftLeg.path} {...segmentProps('LEFT_LEG')} />
      <ellipse cx={leftLeg.footCx} cy={FOOT_Y} rx={m.calfWidth / 2 + 4} ry={7} fill={fillFor('LEFT_LEG')} stroke={STROKE} strokeWidth={1.5} aria-hidden />

      {/* Tronco — desenhado por cima da inserção dos membros para uma junção limpa nos ombros/quadril */}
      <path d={trunkPath(m)} {...segmentProps('TRUNK')} />
    </svg>
  );
}

export { SEGMENT_LABELS as BODY_SEGMENT_LABELS };
