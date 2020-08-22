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
            // For reading, we need to send a write at the
            // address that we want, wait a little, and then
            // receive a byte
            return bus.writeByte(addr, cmd, 0)
            .then(() => this._postWriteDelay())
            .then(() => {
                return bus.receiveByte(addr);
            })
        });
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.writeByte(addr, cmd, byte);
        });
    }

    public readWord(addr: number, cmd: number): Promise<number> {
        const buf = Buffer.alloc(2);
        return this.readByte(addr, cmd)
        .then(msb => {
            buf[0] = msb;
        })
        .then(() => {
            return this.readByte(addr, cmd + 1);
        })
        .then(lsb => {
            buf[1] = lsb;
            return buf.readUInt16BE();
        });
    }

    public writeWord(addr: number, cmd: number, word: number): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.writeWord(addr, cmd, word);
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
