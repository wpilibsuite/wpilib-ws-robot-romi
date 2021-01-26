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

    public readByte(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        return this._i2cBusP
        .then(bus => {
            if (romiMode) {
                // For reading, we need to send a write at the
                // address that we want, wait a little, and then
                // receive a byte
                return bus.sendByte(addr, cmd)
                .then(() => this._postWriteDelay())
                .then(() => {
                    return bus.receiveByte(addr);
                })
            }
            else {
                return bus.readByte(addr, cmd);
            }
        });
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.writeByte(addr, cmd, byte);
        });
    }

    public readWord(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        const buf = Buffer.alloc(2);

        return this._i2cBusP
        .then(bus => {
            if (romiMode) {
                return bus.sendByte(addr, cmd)
                .then(async () => {
                    buf[0] = await bus.receiveByte(addr);
                    buf[1] = await bus.receiveByte(addr);

                    return buf.readUInt16LE();
                });
            }
            else {
                return bus.readWord(addr, cmd);
            }
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
