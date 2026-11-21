import { useEffect, useRef, useState } from 'preact/hooks';

interface Props {
  onSave: (dataUrl: string) => void;
}

/** Finger or mouse signature on a canvas. Scaled for high-DPI screens. */
export function SignaturePad({ onSave }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ratio = Math.max(1, devicePixelRatio || 1);
    const rect = c.getBoundingClientRect();
    c.width = Math.round(rect.width * ratio);
    c.height = Math.round(rect.height * ratio);
    const g = c.getContext('2d');
    if (!g) return;
    g.scale(ratio, ratio);
    g.lineWidth = 2.4;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = '#1c1a17';
  }, []);

  const pos = (e: PointerEvent) => {
    const r = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const down = (e: PointerEvent) => {
    const g = ref.current?.getContext('2d');
    if (!g) return;
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pos(e);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + 0.01, y + 0.01);
    g.stroke();
    setDrawn(true);
  };
  const move = (e: PointerEvent) => {
    if (!drawing.current) return;
    const g = ref.current?.getContext('2d');
    if (!g) return;
    const { x, y } = pos(e);
    g.lineTo(x, y);
    g.stroke();
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = ref.current;
    c?.getContext('2d')?.clearRect(0, 0, c.width, c.height);
    setDrawn(false);
  };

  return (
    <div class="sigwrap">
      <canvas
        ref={ref}
        class="sigpad"
        data-testid="signature-canvas"
        aria-label="Signature area. Draw with a finger or mouse."
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      {!drawn && <span class="sighint">Sign here</span>}
      <div class="row">
        <button type="button" class="btn ghost" onClick={clear} disabled={!drawn}>Clear</button>
        <button type="button" class="btn primary" disabled={!drawn} onClick={() => ref.current && onSave(ref.current.toDataURL('image/png'))}>
          Save signature
        </button>
      </div>
    </div>
  );
}
