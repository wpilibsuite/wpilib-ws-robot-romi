export default abstract class I2CPromisifiedBus {
    protected _busNumber: number;

    constructor(busNumber: number) {
        this._busNumber = busNumber;
        this.setup();
    }

    protected abstract setup(): void;

    public abstract close(): Promise<void>;

    public abstract readByte(addr: number, cmd: number, romiMode?: boolean): Promise<number>;
    public abstract readWord(addr: number, cmd: number, romiMode?: boolean): Promise<number>;
    public abstract writeByte(addr: number, cmd: number, byte: number): Promise<void>;
    public abstract writeWord(addr: number, cmd: number, word: number): Promise<void>;

    public abstract sendByte(addr: number, cmd: number): Promise<void>;
    public abstract receiveByte(addr: number): Promise<number>;
}
