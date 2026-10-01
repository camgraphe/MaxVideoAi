import { useEffect, useRef, useState } from "react";
import { Check, Palette } from "lucide-react";

const palettes = [
  {
    id: "charcoal",
    name: "Charbon",
    description: "Sombre · champagne",
    background: "#19191c",
    accent: "#e5c994",
  },
  {
    id: "olive",
    name: "Olive",
    description: "Clair · ivoire et olive",
    background: "#f4f3ec",
    accent: "#596440",
  },
] as const;
type PaletteId = (typeof palettes)[number]["id"];
const validPalette = (value: string | null): PaletteId =>
  value === "porcelain"
    ? "olive"
    : (palettes.find((p) => p.id === value)?.id ?? "charcoal");

export function PalettePicker() {
  const [palette, setPalette] = useState<PaletteId>(() => {
    try {
      return validPalette(localStorage.getItem("studio-palette"));
    } catch {
      return "charcoal";
    }
  });
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    document.documentElement.dataset.palette = palette;
    try {
      localStorage.setItem("studio-palette", palette);
    } catch {}
  }, [palette]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div className="palette-picker" ref={container}>
      <button
        ref={button}
        className="icon-button"
        aria-label="Choisir l’apparence"
        title={`Palette : ${palettes.find((p) => p.id === palette)!.name}`}
        aria-expanded={open}
        aria-controls="studio-palettes"
        onClick={() => setOpen(!open)}
      >
        <Palette size={18} />
      </button>
      {open && (
        <fieldset id="studio-palettes" className="palette-menu">
          <legend>Apparence du Studio</legend>
          {palettes.map((p) => (
            <label key={p.id} className={palette === p.id ? "chosen" : ""}>
              <input
                type="radio"
                name="studio-palette"
                value={p.id}
                checked={palette === p.id}
                onChange={() => setPalette(p.id)}
              />
              <span
                className="palette-swatch"
                aria-hidden="true"
                style={{ background: p.background, color: p.accent }}
              >
                <span />
              </span>
              <span className="palette-label">
                {p.name}
                <small>{p.description}</small>
              </span>
              {palette === p.id && <Check size={15} aria-hidden="true" />}
            </label>
          ))}
        </fieldset>
      )}
    </div>
  );
}
