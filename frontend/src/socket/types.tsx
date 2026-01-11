export type JoystickPayload = {
  kind: "axis";
  code: number;
  value: number;
};

export type ButtonPayload = {
  kind: "btn";
  code: number;
  value: number;
};

export type PingPayload = {
  kind: "ping";
};

export type MessagePayload = JoystickPayload | ButtonPayload | PingPayload;
