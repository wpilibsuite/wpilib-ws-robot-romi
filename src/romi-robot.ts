import { WPILibWSRobotBase, DigitalChannelMode } from "wpilib-ws-robot";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import MockI2C from "./i2c/mock-i2c";

import RomiDataBuffer from "./romi-shmem-buffer";

export default class WPILibWSRomiRobot extends WPILibWSRobotBase {
    private _i2cBus: I2CPromisifiedBus;
    private _i2cAddress: number;

    // TODO store input states
    // private _digitalInput

    // Take in the abstract bus, since this will allow us to
    // write unit tests more easily
    constructor(bus: I2CPromisifiedBus, address: number) {
        super();

        this._i2cBus = bus;
        this._i2cAddress = address;
    }

    public readyP(): Promise<void> {
        return Promise.resolve();
    }

    public get descriptor(): string {
        return "WPILibWS Reference Robot (Romi)";
    }

    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        // For DIO 0-3, we use the builtinConfig field
        if (channel < 0) {
            return;
        }

        const channelMode = (mode === DigitalChannelMode.INPUT) ? 1 : 0;

        if (channel < 4) {
            // Builtin
            let builtinModeConfig = (1 << 7);
            builtinModeConfig |= ((channel << 2) & 0xC);
            builtinModeConfig |= (channelMode & 0x3);

            this._writeByte(RomiDataBuffer.builtinConfig.offset, builtinModeConfig);
        }

        // Channels 4,5,6,7 are virtually "used" for the encoders

        if (channel === 8) {
            this._writeByte(RomiDataBuffer.dio8Input.offset, mode === DigitalChannelMode.INPUT ? 1 : 0);
        }
    }

    public setDIOValue(channel: number, value: boolean): void {
        if (channel < 4) {
            // Use the built in DIO
            this._writeByte(RomiDataBuffer.builtinDioValues.offset + channel, value ? 1 : 0);
        }

        if (channel === 8) {
            this._writeByte(RomiDataBuffer.dio8Value.offset, value ? 1 : 0);
        }
    }

    public getDIOValue(channel: number): boolean {
        return false;
    }

    public setAnalogOutVoltage(channel: number, voltage: number): void {
        // no-op
    }

    public getAnalogInVoltage(channel: number): number {
        return 0.0;
    }

    public setPWMValue(channel: number, value: number): void {
        if (channel < RomiDataBuffer.pwm.arraySize) {
            // We need to do some trickery to get a twos-complement number
            // Essentially we'll write a 16 bit signed int to the buffer
            // and read it out as an unsigned int
            // Mainly to work around the fact that the i2c-bus library's
            // writeBlock() doesn't work...
            const tmp = Buffer.alloc(2);
            tmp.writeInt16BE(value);
            this._writeWord(RomiDataBuffer.pwm.offset + channel, tmp.readUInt16BE());
        }
    }

    protected async _readByte(cmd: number): Promise<number> {
        return this._i2cBus.readByte(this._i2cAddress, cmd);
    }

    protected async _readWord(cmd: number): Promise<number> {
        return this._i2cBus.readWord(this._i2cAddress, cmd);
    }

    protected async _writeByte(cmd: number, byte: number): Promise<void> {
        return this._i2cBus.writeByte(this._i2cAddress, cmd, byte);
    }

    protected async _writeWord(cmd: number, word: number): Promise<void> {
        return this._i2cBus.writeWord(this._i2cAddress, cmd, word);
    }
}
