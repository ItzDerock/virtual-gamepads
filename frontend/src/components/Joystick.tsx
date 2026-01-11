import { useEffect, useRef } from "react";
import nipplejs from "nipplejs";

export type JoystickProps = {
  nippleConfig?: nipplejs.JoystickManagerOptions;
  onMove?: (
    event: nipplejs.EventData,
    data: nipplejs.JoystickOutputData,
  ) => void;
  onEnd?: () => void;
} & React.HTMLAttributes<HTMLDivElement>;

/**
 * A joystick component using nipplejs.
 * @param props - see JoystickProps
 */
export function Joystick({
  onMove,
  onEnd,
  nippleConfig,
  ...rest
}: JoystickProps) {
  const zoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zoneRef.current) return;

    const manager = nipplejs.create(
      nippleConfig ?? {
        zone: zoneRef.current,
        mode: "dynamic",
        color: "white",
      },
    );

    if (onMove) manager.on("move", (evt, data) => onMove(evt, data));
    if (onEnd) manager.on("end", () => onEnd());

    return () => manager.destroy();
  }, [nippleConfig, onEnd, onMove]);

  rest.style ??= {
    width: "100%",
    height: "100%",
  };

  return <div {...rest} ref={zoneRef} />;
}
