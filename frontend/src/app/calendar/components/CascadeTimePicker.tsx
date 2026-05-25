"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

interface CascadeTimePickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function parseDateTime(v: string) {
  if (!v) return { dateStr: "", hour: "", minute: "" };
  if (v.includes("T")) {
    const [datePart = "", timePart = ""] = v.split("T");
    const [hour = "", minute = ""] = timePart.split(":");
    return { dateStr: datePart, hour, minute };
  }
  return { dateStr: v, hour: "", minute: "" };
}

export default function CascadeTimePicker({ label, value, onChange }: CascadeTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sel, setSel] = useState({ hour: "", minute: "" });
  const containerRef = useRef<HTMLDivElement>(null);
  const hourColRef = useRef<HTMLDivElement>(null);
  const minuteColRef = useRef<HTMLDivElement>(null);

  const parts = parseDateTime(value);
  const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
  const minuteOptions = Array.from({ length: 6 }, (_, i) => String(i * 10).padStart(2, "0"));

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const timeStage = !sel.hour ? 0 : 1;

  const scrollToSelected = (colRef: React.RefObject<HTMLDivElement | null>, selector: string) => {
    if (!colRef.current) return;
    const selected = colRef.current.querySelector(selector);
    if (selected) {
      selected.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    }
  };

  useEffect(() => {
    if (isOpen && sel.hour) {
      requestAnimationFrame(() => scrollToSelected(hourColRef, '[data-selected="true"]'));
    }
  }, [isOpen, sel.hour]);

  useEffect(() => {
    if (isOpen && sel.minute) {
      requestAnimationFrame(() => scrollToSelected(minuteColRef, '[data-selected="true"]'));
    }
  }, [isOpen, sel.minute]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      setSel({ hour: parts.hour, minute: parts.minute });
    }
  };

  const handleHourClick = (h: string) => {
    setSel({ hour: h, minute: "" });
  };

  const handleMinuteClick = (m: string) => {
    const timeStr = `${sel.hour}:${m}`;
    const fullValue = parts.dateStr ? `${parts.dateStr}T${timeStr}` : timeStr;
    onChange(fullValue);
    setIsOpen(false);
  };

  const displayValue = () => {
    if (!parts.hour) return "";
    return `${parts.hour}:${parts.minute || "--"}`;
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1.5 block font-bold uppercase tracking-[0.14em] text-[11px] text-black/65">
        {label}
      </label>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between border-2 border-black bg-white px-3 py-2.5 shadow-[3px_3px_0_0_#121212] transition-all hover:shadow-[4px_4px_0_0_#121212]"
      >
        <span className={`text-sm font-medium ${displayValue() ? "text-black" : "text-black/45"}`}>
          {displayValue() || `选择${label}`}
        </span>
        <ChevronDown size={16} className={`text-black/60 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 border-2 border-black bg-white shadow-[4px_4px_0_0_#121212]">
          <div className="flex h-44">
            <div
              className="h-full overflow-hidden border-r border-black/10"
              style={{
                width: timeStage === 0 ? "100%" : "50%",
                flex: "none",
                transition: "width 300ms ease-out",
              }}
            >
              <div ref={hourColRef} className="h-full overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-black/50">
                  时
                </div>
                {hourOptions.map((h) => (
                  <button
                    key={h}
                    type="button"
                    data-selected={sel.hour === h ? "true" : undefined}
                    onClick={() => handleHourClick(h)}
                    className={`block w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                      sel.hour === h
                        ? "bg-[#f3ead2] font-bold text-black"
                        : "text-black/70 hover:bg-black/5"
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="h-full overflow-hidden"
              style={{
                width: timeStage === 1 ? "50%" : "0%",
                flex: "none",
                opacity: timeStage >= 1 ? 1 : 0,
                transition: "width 300ms ease-out, opacity 300ms ease-out",
              }}
            >
              <div ref={minuteColRef} className="h-full overflow-y-auto">
                <div className="sticky top-0 z-10 bg-[var(--surface-muted)] px-2 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-black/50">
                  分
                </div>
                {minuteOptions.map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-selected={sel.minute === m ? "true" : undefined}
                    onClick={() => handleMinuteClick(m)}
                    className={`block w-full px-3 py-2 text-left text-sm font-medium transition-colors ${
                      sel.minute === m
                        ? "bg-[#f3ead2] font-bold text-black"
                        : "text-black/70 hover:bg-black/5"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
