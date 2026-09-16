"use client";

export function Slider({
  label,
  value,
  onChange,
  readout,
  min,
  max,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** The current band, e.g. "WARM" or "≈290 WORDS". */
  readout: string;
  /** End-of-scale captions. */
  min: string;
  max: string;
  disabled?: boolean;
}) {
  const id = `slider-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="slider">
      <div className="slider__top">
        <label htmlFor={id} className="mono-label" style={{ margin: 0 }}>
          {label}
        </label>
        <span className="slider__value">{readout}</span>
      </div>

      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />

      <div className="slider__scale">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
