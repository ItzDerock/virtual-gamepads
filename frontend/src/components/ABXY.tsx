import { useState } from "react";

export interface ButtonEvent {
  code: number;
  pressed: boolean;
}

interface ABXYProps {
  onInteract: (event: ButtonEvent) => void;
  size?: number;
}

const BUTTONS = [
  {
    label: "Y",
    code: 308,
    color: "#ffff5c",
    borderColor: "#55552a",
    gridArea: "1 / 2 / 2 / 3",
  },
  {
    label: "X",
    code: 307,
    color: "#5c5cff",
    borderColor: "#2a2a55",
    gridArea: "2 / 1 / 3 / 2",
  },
  {
    label: "B",
    code: 305,
    color: "#ff5c5c",
    borderColor: "#552a2a",
    gridArea: "2 / 3 / 3 / 4",
  },
  {
    label: "A",
    code: 304,
    color: "#5cff5c",
    borderColor: "#2a552a",
    gridArea: "3 / 2 / 4 / 3",
  },
];

export const ABXY = ({ onInteract, size = 80 }: ABXYProps) => {
  // We track currently pressed buttons in a Set for O(1) lookups
  const [pressedCodes, setPressedCodes] = useState<Set<number>>(new Set());

  const handlePress = (code: number) => {
    if (pressedCodes.has(code)) return;

    // Haptic feedback for mobile feel
    if (navigator.vibrate) navigator.vibrate(15);

    const newSet = new Set(pressedCodes);
    newSet.add(code);
    setPressedCodes(newSet);

    onInteract({ code, pressed: true });
  };

  const handleRelease = (code: number) => {
    if (!pressedCodes.has(code)) return;

    const newSet = new Set(pressedCodes);
    newSet.delete(code);
    setPressedCodes(newSet);

    onInteract({ code, pressed: false });
  };

  return (
    <div
      style={{
        display: "grid",
        // 3x3 Grid
        gridTemplateColumns: `${size}px ${size}px ${size}px`,
        gridTemplateRows: `${size}px ${size}px ${size}px`,
        gap: "10px",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
      }}
    >
      {BUTTONS.map((btn) => {
        const isPressed = pressedCodes.has(btn.code);

        return (
          <div
            key={btn.code}
            // Mouse Events
            onMouseDown={() => handlePress(btn.code)}
            onMouseUp={() => handleRelease(btn.code)}
            onMouseLeave={() => handleRelease(btn.code)}
            // Touch Events
            // passive: false is required to prevent scrolling while pressing
            onTouchStart={(e) => {
              e.preventDefault();
              handlePress(btn.code);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleRelease(btn.code);
            }}
            style={{
              gridArea: btn.gridArea,
              width: size,
              height: size,

              // Flex centering for text
              display: "flex",
              justifyContent: "center",
              alignItems: "center",

              // Visual Styling
              borderRadius: "50%",
              backgroundColor: isPressed ? "#444" : "#333",
              border: `4px solid ${isPressed ? "#666" : "#444"}`,
              borderColor: isPressed ? btn.borderColor : "#444",
              color: btn.color,
              fontSize: `${size * 0.35}px`,
              fontWeight: "bold",
              cursor: "pointer",

              // 3D Press Animation
              boxShadow: isPressed ? "0 0 0 #111" : "0 6px 0 #111",
              transform: isPressed ? "translateY(6px)" : "translateY(0)",
              transition:
                "transform 0.05s, box-shadow 0.05s, border-color 0.1s",
            }}
          >
            {btn.label}
          </div>
        );
      })}
    </div>
  );
};
