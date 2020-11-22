import I2CPromisifiedBus from "./i2c-connection";
import MockI2CDevice from "./mock-i2c-device";

export default class MockI2C extends I2CPromisifiedBus {
    private _shouldLog: boolean = false;

    private _devices: Map<number, MockI2CDevice> = new Map<number, MockI2CDevice>();

    constructor(busNum: number, shouldLog?: boolean) {
        super(busNum);
        this._shouldLog = !!shouldLog;
    }

    protected setup(): void {
        if (this._shouldLog) {
            console.log(`MockI2C(bus=${this._busNumber})`);
        }
    }

    public addDeviceToBus(device: MockI2CDevice) {
        if (this._devices.has(device.address)) {
            throw new Error(`[MOCK-I2C] Already have device address ${device.address} on the bus`);
        }

        this._devices.set(device.address, device);
    }

    public close(): Promise<void> {
        return Promise.resolve();
    }

    public readByte(addr: number, cmd: number): Promise<number> {
        if (this._shouldLog) {
            console.log(`readByte(${addr}, ${cmd})`);
        }

        if (this._devices.has(addr)) {
            return this._devices.get(addr).readByte(cmd);
        }

        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        if (this._shouldLog) {
            console.log(`writeByte(${addr}, ${cmd}, ${byte})`);
        }

        if (this._devices.has(addr)) {
            return this._devices.get(addr).writeByte(cmd, byte);
        }

        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }

    public readWord(addr: number, cmd: number): Promise<number> {
        if (this._shouldLog) {
            console.log(`readWord(${addr}, ${cmd})`);
        }

        if (this._devices.has(addr)) {
            return this._devices.get(addr).readWord(cmd);
        }

        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }

    public writeWord(addr: number, cmd: number, word: number): Promise<void> {
        if (this._shouldLog) {
            console.log(`writeWord(${addr}, ${cmd}, ${word})`);
        }

        if (this._devices.has(addr)) {
            return this._devices.get(addr).writeWord(cmd, word);
        }

        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }
}
