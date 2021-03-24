export default abstract class MockI2CDevice {
    protected _address: number;

    constructor(address: number) {
        this._address = address;
    }

    get address(): number {
        return this._address;
    }

    public abstract readByte(cmd: number): Promise<number>;
    public abstract readWord(cmd: number): Promise<number>;
    public abstract writeByte(cmd: number, byte: number): Promise<void>;
    public abstract writeWord(cmd: number, word: number): Promise<void>;
    public abstract sendByte(cmd: number): Promise<void>;
    public abstract receiveByte(): Promise<number>;
}
