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
          className="w-full h-full"
          onChange={({ x, y }) => {
            x = Math.floor(x * 32767);
            y = Math.floor(y * -32767);

            ws.send({ kind: "axis", code: 0, value: x });
            ws.send({ kind: "axis", code: 1, value: y });
          }}
        />
      </div>
      <div className="flex justify-center items-center">
        <ABXY
          size={80}
          onInteract={(e) => {
            // e.pressed is boolean (true = pressed, false = released)
            const value = e.pressed ? 1 : 0;

            ws.send({
              kind: "btn",
              code: e.code,
              value: value,
            });
          }}
        />
      </div>

      {/*start/select button in middle of screen*/}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
        <button
          className="bg-gray-800 text-white px-4 py-2 rounded"
          onClick={() => {
            ws.send({ kind: "btn", code: 315, value: 1 });
            setTimeout(() => {
              ws.send({ kind: "btn", code: 315, value: 0 });
            }, 100);
          }}
        >
          Select
        </button>
        <button
          className="bg-gray-800 text-white px-4 py-2 rounded"
          onClick={() => {
            ws.send({ kind: "btn", code: 314, value: 1 });
            setTimeout(() => {
              ws.send({ kind: "btn", code: 314, value: 0 });
            }, 100);
          }}
        >
          Start
        </button>
      </div>

      {/*connection stats*/}
      <div className="absolute bottom-0 left-1/2 m-2 p-2 bg-black bg-opacity-50 text-white text-sm rounded -translate-x-1/2">
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
