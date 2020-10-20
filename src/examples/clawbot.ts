import WPILibWSRomiRobot, { IPinConfiguration, IOPinMode } from "../romi-robot";
import HardwareI2C from "../i2c/hw-i2c";

const i2cBus = new HardwareI2C(1);
const hardwareConfig: IPinConfiguration[] = [
    { pinNumber: 11, mode: IOPinMode.PWM },
    { pinNumber: 4, analogChannel: 6, mode: IOPinMode.PWM },
    { pinNumber: 20, analogChannel: 2, mode: IOPinMode.PWM },
    { pinNumber: 21, analogChannel: 3, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 22, analogChannel: 4, mode: IOPinMode.ANALOG_IN }
];

const robot = new WPILibWSRomiRobot(i2cBus, 0x14, hardwareConfig);

let pwmVal = 0;
let delta = 5;
setInterval(() => {
    robot.setPWMValue(2, pwmVal);
    pwmVal += delta;
    if (pwmVal > 255) {
        pwmVal = 255;
        delta = -delta;
    }
    else if (pwmVal < 0) {
        pwmVal = 0;
        delta = -delta;
    }
}, 500);