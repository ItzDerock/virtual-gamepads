use evdev::{AbsInfo, AttributeSet, InputId, Key, UinputAbsSetup, uinput::VirtualDeviceBuilder};
use tokio::time::Instant;
use uuid::Uuid;

pub struct VirtualGamepad {
    /// Unique identifier for the virtual gamepad
    id: Uuid,

    /// Time of the last received heartbeat from the client
    pub last_heartbeat: Instant,

    /// The virtual input device representing the gamepad
    device: evdev::uinput::VirtualDevice,
}

impl VirtualGamepad {
    /// Creates a new VirtualGamepad instance with a unique ID and the provided virtual device.
    pub fn new(id: Uuid) -> Result<Self, std::io::Error> {
        let mut keys = AttributeSet::<Key>::new();
        keys.insert(Key::BTN_SOUTH); // A
        keys.insert(Key::BTN_EAST); // B
        keys.insert(Key::BTN_NORTH); // X
        keys.insert(Key::BTN_WEST); // Y
        keys.insert(Key::BTN_START);
        keys.insert(Key::BTN_SELECT);

        // joysticks
        let abs_setup_x = UinputAbsSetup::new(
            evdev::AbsoluteAxisType::ABS_X,
            AbsInfo::new(0, -32768, 32767, 16, 128, 0),
        );
        let abs_setup_y = UinputAbsSetup::new(
            evdev::AbsoluteAxisType::ABS_Y,
            AbsInfo::new(0, -32768, 32767, 16, 128, 0),
        );

        let device = VirtualDeviceBuilder::new()?
            .name("Rust Web Controller")
            .input_id(InputId::new(
                // Xbox 360 IDs
                evdev::BusType::BUS_USB,
                0x045e,
                0x028e,
                0x0110,
            ))
            .with_keys(&keys)?
            .with_absolute_axis(&abs_setup_x)?
            .with_absolute_axis(&abs_setup_y)?
            .build()?;

        Ok(Self {
            id,
            last_heartbeat: Instant::now(),
            device,
        })
    }

    /// Updates the last heartbeat time to the current instant.
    pub fn update_heartbeat(&mut self) {
        self.last_heartbeat = Instant::now();
    }

    /// Passes input events to the virtual device.
    pub fn send_keypad_event(&mut self, key: Key, value: i32) -> Result<(), std::io::Error> {
        // Emit event (Type, Code, Value)
        self.device
            .emit(&[evdev::InputEvent::new(evdev::EventType::KEY, key.0, value)])
    }

    /// Passes axis events to the virtual device.
    pub fn send_axis_event(
        &mut self,
        axis: evdev::AbsoluteAxisType,
        value: i32,
    ) -> Result<(), std::io::Error> {
        // Emit event (Type, Code, Value)
        self.device.emit(&[evdev::InputEvent::new(
            evdev::EventType::ABSOLUTE,
            axis.0,
            value,
        )])
    }
}
