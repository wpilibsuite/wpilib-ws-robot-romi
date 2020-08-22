import I2CPromisifiedBus from "./i2c-connection";

export default class MockI2C extends I2CPromisifiedBus {
    private _shouldLog: boolean = false;

    constructor(busNum: number, shouldLog?: boolean) {
        super(busNum);
        this._shouldLog = !!shouldLog;
    }
    protected setup(): void {
        if (this._shouldLog) {
            console.log(`MockI2C(bus=${this._busNumber})`);
        }
    }

    public close(): Promise<void> {
        return Promise.resolve();
    }

    public readByte(addr: number, cmd: number): Promise<number> {
        if (this._shouldLog) {
            console.log(`readByte(${addr}, ${cmd})`);
        }
        return Promise.resolve(0);
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        if (this._shouldLog) {
            console.log(`writeByte(${addr}, ${cmd}, ${byte})`);
        }
        return Promise.resolve();
    }

    public readWord(addr: number, cmd: number): Promise<number> {
        if (this._shouldLog) {
            console.log(`readWord(${addr}, ${cmd})`);
        }
        return Promise.resolve(0);
    }

    public writeWord(addr: number, cmd: number, word: number): Promise<void> {
        if (this._shouldLog) {
            console.log(`writeWord(${addr}, ${cmd}, ${word})`);
        }
        return Promise.resolve();
    }
}
