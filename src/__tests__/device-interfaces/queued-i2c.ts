import MockI2CDevice from "../../device-interfaces/i2c/mock-i2c-device";
import MockI2C, { MockI2CBusEvent, MockI2CBusEventType } from "../../device-interfaces/i2c/mock-i2c";
import QueuedI2CBus from "../../device-interfaces/i2c/queued-i2c-bus";

enum DataSize {
    BYTE,
    WORD
}

interface ReadWriteOperation {
    dataSize: DataSize;
    cmd: number;
    data: number;
}

class TestDevice extends MockI2CDevice {
    private _nextByteToRead: ReadWriteOperation = {
        dataSize: DataSize.BYTE,
        cmd: 0,
        data: 0
    };

    private _nextWordToRead: ReadWriteOperation = {
        dataSize: DataSize.WORD,
        cmd: 0,
        data: 0
    };

    private _lastByteWritten: ReadWriteOperation = {
        dataSize: DataSize.BYTE,
        cmd: 0,
        data: 0
    };

    private _lastWordWritten: ReadWriteOperation = {
        dataSize: DataSize.WORD,
        cmd: 0,
        data: 0
    };

    public setNextByteToRead(cmd: number, byte: number) {
        this._nextByteToRead.cmd = cmd;
        this._nextByteToRead.data = byte;
    }

    public setNextWordToRead(cmd: number, word: number) {
        this._nextWordToRead.cmd = cmd;
        this._nextWordToRead.data = word;
    }

    public getLastByteWritten(): ReadWriteOperation {
        return this._lastByteWritten;
    }

    public getLastWordWritten(): ReadWriteOperation {
        return this._lastWordWritten;
    }

    public readByte(cmd: number): Promise<number> {
        if (this._nextByteToRead.cmd !== cmd) {
            return Promise.reject();
        }
        return Promise.resolve(this._nextByteToRead.data);
    }
    public readWord(cmd: number): Promise<number> {
        if (this._nextWordToRead.cmd !== cmd) {
            return Promise.reject();
        }
        return Promise.resolve(this._nextWordToRead.data);
    }
    public writeByte(cmd: number, byte: number): Promise<void> {
        this._lastByteWritten.cmd = cmd;
        this._lastByteWritten.data = byte;

        return Promise.resolve();
    }
    public writeWord(cmd: number, word: number): Promise<void> {
        this._lastWordWritten.cmd = cmd;
        this._lastWordWritten.data = word;

        return Promise.resolve();
    }

    public sendByte(cmd: number): Promise<void> {
        return Promise.resolve();
    }

    public receiveByte(): Promise<number> {
        return Promise.resolve(0);
    }
}

describe("Queued I2C Bus", () => {
    let mockBus: MockI2C;
    let queuedBus: QueuedI2CBus;

    beforeEach(() => {
        mockBus = new MockI2C(1);
        queuedBus = new QueuedI2CBus(mockBus);
    });

    afterEach(() => {
        mockBus.clearListeners();
    });

    it("should handle reads appropriately", async (done) => {
        const addr = 0x10;

        const testDevice: TestDevice = new TestDevice(addr);
        mockBus.addDeviceToBus(testDevice);

        testDevice.setNextByteToRead(0x1, 0xDE);
        const firstRead = await queuedBus.readByte(addr, 0x1);
        expect(firstRead).toEqual(0xDE);

        testDevice.setNextByteToRead(0x2, 0xAD);
        const secondRead = await queuedBus.readByte(addr, 0x2);
        expect(secondRead).toEqual(0xAD);

        testDevice.setNextWordToRead(0x4, 0xBEEF);
        const thirdRead = await queuedBus.readWord(addr, 0x4);
        expect(thirdRead).toEqual(0xBEEF);

        done();
    });

    it("should handle writes appropriately", async (done) => {
        const addr = 0x10;

        const testDevice: TestDevice = new TestDevice(addr);
        mockBus.addDeviceToBus(testDevice);

        await queuedBus.writeByte(addr, 0x1, 0xDE);
        expect(testDevice.getLastByteWritten().cmd).toEqual(0x1);
        expect(testDevice.getLastByteWritten().data).toEqual(0xDE);

        await queuedBus.writeByte(addr, 0x2, 0xAD);
        expect(testDevice.getLastByteWritten().cmd).toEqual(0x2);
        expect(testDevice.getLastByteWritten().data).toEqual(0xAD);

        await queuedBus.writeWord(addr, 0x4, 0xBEEF);
        expect(testDevice.getLastWordWritten().cmd).toEqual(0x4);
        expect(testDevice.getLastWordWritten().data).toEqual(0xBEEF);

        done();
    });

    it("should handle missing devices accordingly", async (done) => {
        let lastEvent: MockI2CBusEvent = undefined;

        const testDevice: TestDevice = new TestDevice(0x11);
        mockBus.addDeviceToBus(testDevice);

        mockBus.addListener(evt => {
            lastEvent = evt;
        });

        try {
            await queuedBus.readByte(0x10, 0x1);
        }
        catch (err) {}
        finally {
            expect(lastEvent).not.toBeUndefined();
            expect(lastEvent.eventType).toBe(MockI2CBusEventType.IO_ERROR);
        }

        try {
            await queuedBus.writeByte(0x11, 0x1, 0x1);
        }
        catch (err) {}
        finally {
            expect(lastEvent).not.toBeUndefined();
            expect(lastEvent.eventType).toBe(MockI2CBusEventType.WRITE_BYTE);
        }

        done();
    });

    it("should work with a generated handle", async (done) => {
        const addr = 0x10;

        const testDevice: TestDevice = new TestDevice(addr);
        mockBus.addDeviceToBus(testDevice);

        const handle = queuedBus.getNewAddressedHandle(addr);

        testDevice.setNextByteToRead(0x1, 0xDE);
        const firstRead = await handle.readByte(0x1);
        expect(firstRead).toEqual(0xDE);

        testDevice.setNextByteToRead(0x2, 0xAD);
        const secondRead = await handle.readByte(0x2);
        expect(secondRead).toEqual(0xAD);

        testDevice.setNextWordToRead(0x4, 0xBEEF);
        const thirdRead = await handle.readWord(0x4);
        expect(thirdRead).toEqual(0xBEEF);

        await handle.writeByte(0x1, 0xDE);
        expect(testDevice.getLastByteWritten().cmd).toEqual(0x1);
        expect(testDevice.getLastByteWritten().data).toEqual(0xDE);

        await handle.writeByte(0x2, 0xAD);
        expect(testDevice.getLastByteWritten().cmd).toEqual(0x2);
        expect(testDevice.getLastByteWritten().data).toEqual(0xAD);

        await handle.writeWord(0x4, 0xBEEF);
        expect(testDevice.getLastWordWritten().cmd).toEqual(0x4);
        expect(testDevice.getLastWordWritten().data).toEqual(0xBEEF);

        done();
    });
});
