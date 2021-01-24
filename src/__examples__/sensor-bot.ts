import MockI2C from "../device-interfaces/i2c/mock-i2c";
import I2CPromisifiedBus from "../device-interfaces/i2c/i2c-connection";
import WPILibWSRomiRobot, { IOPinMode, IPinConfiguration } from "../robot/romi-robot";
import { DigitalChannelMode } from "@wpilib/wpilib-ws-robot";
import RomiConfiguration from "../robot/romi-config";
import QueuedI2CBus from "../device-interfaces/i2c/queued-i2c-bus";

let hardwareConfig: IPinConfiguration[] = [
    { pinNumber: 11, mode: IOPinMode.DIO },
    { pinNumber: 4, analogChannel: 6, mode: IOPinMode.DIO },
    { pinNumber: 20, analogChannel: 2, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 21, analogChannel: 3, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 22, analogChannel: 4, mode: IOPinMode.ANALOG_IN }
];

const romiConfig: RomiConfiguration = new RomiConfiguration();
romiConfig.externalIOConfig = hardwareConfig;
romiConfig.gyroZeroOffset = { x: 0, y: 0, z: 0}

const I2C_BUS_NUM: number = 1;

let i2cBus: I2CPromisifiedBus;
try {
    const HardwareI2C = require("../i2c/hw-i2c").default;
    i2cBus = new HardwareI2C(I2C_BUS_NUM);
}
catch (err) {
    console.log("Error creating hardware I2C: ", err.message);
    console.log("Falling back to MockI2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
}

const queuedI2CBus: QueuedI2CBus = new QueuedI2CBus(i2cBus);

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(queuedI2CBus, 0x14, romiConfig);

setTimeout(() => {
    console.log("READY");

    // Set the DIO to input
    robot.setDigitalChannelMode(8, DigitalChannelMode.INPUT);
    robot.setDigitalChannelMode(9, DigitalChannelMode.INPUT);

    // Set up the sensor read loop
    setInterval(() => {
        // DIO 8 is the right bumper
        // DIO 9 is the left bumper
        // Analog 0 is right distance
        // Analog 1 is center distance
        // Analog 2 is left distance
        console.log(`LeftBumper: ${robot.getDIOValue(9)}, RightBumper: ${robot.getDIOValue(8)}, ` +
                    `LeftDist: ${robot.getAnalogInVoltage(2)}, CtrDist: ${robot.getAnalogInVoltage(1)}, RightDist: ${robot.getAnalogInVoltage(0)}`);
    }, 500);
}, 1000);
