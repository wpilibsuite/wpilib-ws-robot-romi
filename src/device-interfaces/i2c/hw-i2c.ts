import I2CPromisifiedBus from "./i2c-connection";
import i2c from "i2c-bus";
import LogUtil from "../../utils/logging/log-util";
import winston from "winston";

export default class HardwareI2C extends I2CPromisifiedBus {
    private _i2cBusP: Promise<i2c.PromisifiedBus>;
    private _logger: winston.Logger;

    protected setup(): void {
        this._logger = LogUtil.getLogger(`I2C-HW-${this._busNumber}`);
        this._logger.info(`HardwareI2C(bus=${this._busNumber})`);
        this._i2cBusP = i2c.openPromisified(this._busNumber);
    }

    public close(): Promise<void> {
        return this._i2cBusP
        .then(bus => {
            return bus.close();
        });
    }

    public readByte(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        this._logger.silly(`readByte(addr=0x${addr.toString(16)}, cmd=0x${cmd.toString(16)}, ${romiMode ? "true": "false"})`);
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
        this._logger.silly(`writeBute(addr=0x${addr.toString(16)}, cmd=0x${cmd.toString(16)}, byte=0x${byte.toString(16)})`);
        return this._i2cBusP
        .then(bus => {
            return bus.writeByte(addr, cmd, byte);
        });
    }

    public readWord(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        const buf = Buffer.alloc(2);

        this._logger.silly(`readWord(addr=0x${addr.toString(16)}, cmd=0x${cmd.toString(16)}, ${romiMode ? "true": "false"})`);
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
        this._logger.silly(`writeBute(addr=0x${addr.toString(16)}, cmd=0x${cmd.toString(16)}, word=0x${word.toString(16)})`);
        return this._i2cBusP
        .then(bus => {
            return bus.writeWord(addr, cmd, word);
        });
    }

    public sendByte(addr: number, cmd: number): Promise<void> {
        this._logger.silly(`sendByte(addr=0x${addr.toString(16)}, cmd=0x${cmd.toString(16)})`);
        return this._i2cBusP
        .then(bus => {
            return bus.sendByte(addr, cmd);
        });
    }

    public receiveByte(addr: number): Promise<number> {
        this._logger.silly(`receiveByte(addr=0x${addr.toString(16)})`);
        return this._i2cBusP
        .then(bus => {
            return bus.receiveByte(addr);
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
