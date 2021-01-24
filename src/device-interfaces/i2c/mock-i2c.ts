import I2CPromisifiedBus from "./i2c-connection";
import MockI2CDevice from "./mock-i2c-device";

export enum MockI2CBusEventType {
    READ_BYTE = "READ_BYTE",
    READ_WORD = "READ_WORD",
    WRITE_BYTE = "WRITE_BYTE",
    WRITE_WORD = "WROTE_WORD",
    IO_ERROR = "IO_ERROR",
    BUS_CLOSE = "BUS_CLOSE"
}
export interface MockI2CBusEvent {
    address?: number;
    eventType: MockI2CBusEventType;
    cmd?: number;
    data?: number;
    errDescription?: string;
}

export type MockI2CEventListener = (event: MockI2CBusEvent) => void;

export default class MockI2C extends I2CPromisifiedBus {
    private _shouldLog: boolean = false;

    private _devices: Map<number, MockI2CDevice> = new Map<number, MockI2CDevice>();

    private _eventListeners: MockI2CEventListener[] = [];

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

    public clearListeners(): void {
        this._eventListeners = [];
    }

    public addListener(listener: MockI2CEventListener): void {
        this._eventListeners.push(listener);
    }

    private _notifyListeners(evt: MockI2CBusEvent): void {
        this._eventListeners.forEach(listener => {
            listener(evt);
        });
    }

    public close(): Promise<void> {
        this._notifyListeners({
            eventType: MockI2CBusEventType.BUS_CLOSE,
        });

        return Promise.resolve();
    }

    public readByte(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        if (this._shouldLog) {
            console.log(`readByte(${addr}, ${cmd})`);
        }

        if (this._devices.has(addr)) {
            this._notifyListeners({
                eventType: MockI2CBusEventType.READ_BYTE,
                address: addr,
                cmd
            });
            return this._devices.get(addr).readByte(cmd);
        }

        this._notifyListeners({
            eventType: MockI2CBusEventType.IO_ERROR,
            address: addr,
            cmd,
            errDescription: "No Device Associated With Address"
        });
        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }

    public writeByte(addr: number, cmd: number, byte: number): Promise<void> {
        if (this._shouldLog) {
            console.log(`writeByte(${addr}, ${cmd}, ${byte})`);
        }

        if (this._devices.has(addr)) {
            this._notifyListeners({
                eventType: MockI2CBusEventType.WRITE_BYTE,
                address: addr,
                cmd,
                data: byte
            });
            return this._devices.get(addr).writeByte(cmd, byte);
        }

        this._notifyListeners({
            eventType: MockI2CBusEventType.IO_ERROR,
            address: addr,
            cmd,
            errDescription: "No Device Associated With Address"
        });
        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }

    public readWord(addr: number, cmd: number, romiMode?: boolean): Promise<number> {
        if (this._shouldLog) {
            console.log(`readWord(${addr}, ${cmd})`);
        }

        if (this._devices.has(addr)) {
            this._notifyListeners({
                eventType: MockI2CBusEventType.READ_WORD,
                address: addr,
                cmd
            });
            return this._devices.get(addr).readWord(cmd);
        }

        this._notifyListeners({
            eventType: MockI2CBusEventType.IO_ERROR,
            address: addr,
            cmd,
            errDescription: "No Device Associated With Address"
        });
        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }

    public writeWord(addr: number, cmd: number, word: number): Promise<void> {
        if (this._shouldLog) {
            console.log(`writeWord(${addr}, ${cmd}, ${word})`);
        }

        if (this._devices.has(addr)) {
            this._notifyListeners({
                eventType: MockI2CBusEventType.WRITE_WORD,
                address: addr,
                cmd,
                data: word
            });
            return this._devices.get(addr).writeWord(cmd, word);
        }

        this._notifyListeners({
            eventType: MockI2CBusEventType.IO_ERROR,
            address: addr,
            cmd,
            errDescription: "No Device Associated With Address"
        });
        return Promise.reject(`[MOCK-I2C] IO Error - No device with address ${addr}`);
    }
}
