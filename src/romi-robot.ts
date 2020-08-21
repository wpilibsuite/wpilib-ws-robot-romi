import { WPILibWSRobotBase, DigitalChannelMode } from "wpilib-ws-robot";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import MockI2C from "./i2c/mock-i2c";

export default class WPILibWSRomiRobot extends WPILibWSRobotBase {
    private _i2cBus: I2CPromisifiedBus;
    private _i2cAddress: number;

    constructor(busNum: number, address: number) {
        super();

        this._i2cAddress = address;

        try {
            const HardwareI2C = require("./i2c/hw-i2c");
            this._i2cBus = new HardwareI2C(busNum);
        }
        catch(err) {
            console.log("Error creating hardware I2C: ", err);
            this._i2cBus = new MockI2C(busNum);
        };
    }

    public readyP(): Promise<void> {
        return Promise.resolve();
    }

    public get descriptor(): string {
        return "WPILibWS Reference Robot (Romi)";
    }

    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {

    }

    public setDIOValue(channel: number, value: boolean): void {

    }

    public getDIOValue(channel: number): boolean {
        return false;
    }

    public setAnalogOutVoltage(channel: number, voltage: number): void {

    }

    public getAnalogInVoltage(channel: number): number {
        return 0.0;
    }

    public setPWMValue(channel: number, value: number): void {

    }
}
