import I2CPromisifiedBus from "./i2c-connection";

export default class MockI2C extends I2CPromisifiedBus {
    protected setup(): void {
        console.log(`MockI2C(bus=${this._busNumber})`);
    }

    public close(): Promise<void> {
        return Promise.resolve();
    }

    public readByte(addr: number, cmd: number): Promise<number> {
        console.log(`readByte(${addr}, ${cmd})`);
        return Promise.resolve(0);
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        console.log(`writeByte(${addr}, ${cmd}, ${byte})`);
        return Promise.resolve()
            .then(() => this._postWriteDelay());
    }

    public readWord(addr: number, cmd: number): Promise<number> {
        console.log(`readWord(${addr}, ${cmd})`);
        return Promise.resolve(0);
    }

    public writeWord(addr: number, cmd: number, word: number): Promise<void> {
        console.log(`writeWord(${addr}, ${cmd}, ${word})`);
        return Promise.resolve()
            .then(() => this._postWriteDelay());
    }

    private _postWriteDelay(delayMs: number = 1): Promise<void> {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve();
            }, delayMs);
        });
    }
}
