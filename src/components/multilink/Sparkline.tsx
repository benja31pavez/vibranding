const WIDTH = 88;
const HEIGHT = 28;
const PAD = 2;

/** Mini tendencia (decorativa: la cifra al lado es el dato). SVG puro, sin librería. */
export function Sparkline({ values, tone }: { values: number[]; tone: string }) {
  if (values.length < 2) return null;
  const max = Math.max(1, ...values);
  const step = (WIDTH - PAD * 2) / (values.length - 1);
  const points = values.map((v, i) => {
    const x = PAD + i * step;
    const y = HEIGHT - PAD - (v / max) * (HEIGHT - PAD * 2);
    return [x, y] as const;
  });
  const line = points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
    .join("");
  const area = `${line}L${points[points.length - 1][0].toFixed(1)} ${HEIGHT}L${PAD} ${HEIGHT}Z`;
  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className="shrink-0 overflow-visible"
      aria-hidden="true"
    >
      <path d={area} fill={tone} opacity={0.12} />
      <path
        d={line}
        fill="none"
        stroke={tone}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
