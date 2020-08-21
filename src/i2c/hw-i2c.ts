import I2CPromisifiedBus from "./i2c-connection";
import i2c from "i2c-bus";

export default class HardwareI2C extends I2CPromisifiedBus {
    private _i2cBusP: Promise<i2c.PromisifiedBus>;

    protected setup(): void {
        console.log(`HardwareI2C(bus=${this._busNumber})`);
        this._i2cBusP = i2c.openPromisified(this._busNumber);
    }

    public close(): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.close();
        });
    }

    public readByte(addr: number, cmd: number): Promise<number> {
        return this._i2cBusP
        .then(bus => {
            return bus.readByte(addr, cmd);
        });
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.writeByte(addr, cmd, byte)
            .then(() => this._postWriteDelay());
        });
    }

    public readWord(addr: number, cmd: number): Promise<number> {
        return this._i2cBusP
        .then(bus => {
            return bus.readWord(addr, cmd);
        });
    }

    public writeWord(addr: number, cmd: number, word: number): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.writeWord(addr, cmd, word)
            .then(() => this._postWriteDelay());
        });
    }

    private _postWriteDelay(delayMs: number = 1): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, delayMs);
        });
    }
}
