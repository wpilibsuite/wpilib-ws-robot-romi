import PromiseQueue from "promise-queue";
import I2CPromisifiedBus from "./i2c-connection";

/**
 * Implementation of a sequential I2C communication channel
 */
export default class QueuedI2CBus {
    private _bus: I2CPromisifiedBus;
    private _queue: PromiseQueue = new PromiseQueue(1);

    constructor(bus: I2CPromisifiedBus) {
        this._bus = bus;
    }

    get rawBus(): I2CPromisifiedBus {
        return this._bus;
    }

    public async readByte(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        return this._queue.add(() => {
            return this._bus.readByte(addr, cmd, romiMode);
        });
    }

    public async readWord(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        return this._queue.add(() => {
            return this._bus.readWord(addr, cmd, romiMode);
        });
    }

    public async writeByte(addr: number, cmd: number, byte: number, delayMs: number = 0): Promise<void> {
        return this._queue.add(() => {
            return this._bus.writeByte(addr, cmd, byte)
            .then(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, delayMs);
                });
            });
        });
    }

    public async writeWord(addr: number, cmd: number, word: number, delayMs: number = 0): Promise<void> {
        return this._queue.add(() => {
            return this._bus.writeWord(addr, cmd, word)
            .then(() => {
                return new Promise(resolve => {
                    setTimeout(() => {
                        resolve();
                    }, delayMs);
                });
            });
        });
    }

    public getNewAddressedHandle(addr: number, romiMode?: boolean): QueuedI2CHandle {
        return new QueuedI2CHandle(this, addr, romiMode);
    }
}

/**
 * Helper class to handle reads/writes to a specific address on a bus
 */
export class QueuedI2CHandle {
    private _queuedBus: QueuedI2CBus;
    private _address: number;
    private _romiMode: boolean = false;

    constructor(bus: QueuedI2CBus, addr: number, romiMode?: boolean) {
        this._queuedBus = bus;
        this._address = addr;

        if (romiMode !== undefined) {
            this._romiMode = romiMode;
        }
    }

    public async readByte(cmd: number): Promise<number> {
        return this._queuedBus.readByte(this._address, cmd, this._romiMode);
    }

    public async readWord(cmd: number): Promise<number> {
        return this._queuedBus.readWord(this._address, cmd, this._romiMode);
    }

    public async writeByte(cmd: number, byte: number, delayMs: number = 0): Promise<void> {
        return this._queuedBus.writeByte(this._address, cmd, byte, delayMs);
    }

    public async writeWord(cmd: number, word: number, delayMs: number = 0): Promise<void> {
        return this._queuedBus.writeWord(this._address, cmd, word, delayMs);
    }
}
