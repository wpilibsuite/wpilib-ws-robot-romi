import WPILibWSRomiRobot from "./romi-robot";
import { DigitalChannelMode } from "wpilib-ws-robot";
import MockI2C from "./i2c/mock-i2c";
import I2CPromisifiedBus from "./i2c/i2c-connection";

const I2C_BUS_NUM: number = 1;

// Set up the i2c bus out here
let i2cBus: I2CPromisifiedBus;

try {
    const HardwareI2C = require("./i2c/hw-i2c").default;
    i2cBus = new HardwareI2C(I2C_BUS_NUM);
}
catch (err) {
    console.log("Error creating hardware I2C: ", err.message);
    console.log("Falling back to MockI2C");
    i2cBus = new MockI2C(I2C_BUS_NUM);
}

const robot: WPILibWSRomiRobot = new WPILibWSRomiRobot(i2cBus, 0x14);

