import { useEffect } from "react";
import { Joystick } from "./components/Joystick";
import { ABXY } from "./components/ABXY";
import { useSocket } from "./socket/context";

function App() {
  // prevent iOS zoom on double tap
  useEffect(() => {
    function preventZoom(event: Event) {
      event.preventDefault();
    }

    document.addEventListener("gesturestart", preventZoom);
    return () => document.removeEventListener("gesturestart", preventZoom);
  }, []);

  const ws = useSocket();

  return (
    <div className="w-full h-full grid grid-cols-1 landscape:grid-cols-2">
      <div>
        <Joystick
          onMove={(_evt, data) => {
            if (data.vector) {
              // Scale normalized vector (-1 to 1) to Int16 (-32768 to 32767)
              const x = Math.floor(data.vector.x * 32767);
              const y = Math.floor(data.vector.y * -32767); // Invert Y for standard flight/gamepad controls
              ws.send({ kind: "axis", code: 0, value: x });
              ws.send({ kind: "axis", code: 1, value: y });
            }
          }}
          onEnd={() => {
            // Reset to center when finger lifts
            ws.send({ kind: "axis", code: 0, value: 0 });
            ws.send({ kind: "axis", code: 1, value: 0 });
          }}
        />
      </div>
      <div className="flex justify-center items-center">
        <ABXY
          size={80}
          onInteract={(e) => {
            // e.pressed is boolean (true = pressed, false = released)
            // You likely want to send 1 for press, 0 for release
            const value = e.pressed ? 1 : 0;

            ws.send({
              kind: "btn",
              code: e.code,
              value: value,
            });
          }}
        />
      </div>

      {/*connection stats*/}
      <div className="absolute bottom-0 right-0 m-2 p-2 bg-black bg-opacity-50 text-white text-sm rounded">
        {ws.isConnected ? (
          <div className="text-green-400">Connected</div>
        ) : (
          <div className="text-red-400">Disconnected</div>
        )}
        <div>Ping: {ws.latency} ms</div>
      </div>
    </div>
  );
}

export default App;
