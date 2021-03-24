import RomiShmemBuffer, { ShmemDataType, ShmemElementDefinition } from "../robot/romi-shmem-buffer";
import MockI2CDevice from "../device-interfaces/i2c/mock-i2c-device";

function getDataTypeSize(type: ShmemDataType): number {
    switch (type) {
        case ShmemDataType.UINT8_T:
        case ShmemDataType.INT8_T:
        case ShmemDataType.BOOL:
            return 1;
        case ShmemDataType.UINT16_T:
        case ShmemDataType.INT16_T:
            return 2;
    }
}

export default class MockRomiI2C extends MockI2CDevice {
    /**
     * This is what gets written to from the bus
     */
    private _incomingBuffer: number[];

    /**
     * This is what the actual buffer data is
     */
    private _actualBuffer: number[];

    private _isError: boolean = false;

    constructor(address: number) {
        super(address);

        this.resetRomi();
    }

    public readByte(cmd: number): Promise<number> {
        if (this._isError) {
            return Promise.reject("IO Error");
        }

        if (cmd < this._actualBuffer.length) {
            return Promise.resolve(this._actualBuffer[cmd]);
        }

        return Promise.reject("IO Error");
    }

    public readWord(cmd: number): Promise<number> {
        if (this._isError) {
            return Promise.reject("IO Error");
        }

        if (cmd < this._actualBuffer.length - 1) {
            const value = Buffer.from(this._actualBuffer.slice(cmd, cmd + 2));
            return Promise.resolve(value.readUInt16LE(0));
        }

        return Promise.reject("IO Error");
    }

    public writeByte(cmd: number, byte: number): Promise<void> {
        if (this._isError) {
            return Promise.reject("IO Error");
        }

        if (cmd < this._incomingBuffer.length) {
            this._incomingBuffer[cmd] = byte;

            // TODO Process the byte

            return Promise.resolve();
        }

        return Promise.reject("IO Error");
    }

    public writeWord(cmd: number, word: number): Promise<void> {
        if (this._isError) {
            return Promise.reject("IO Error");
        }

        if (cmd < this._incomingBuffer.length) {
            // Read in as an unsigned 16 bit LE number
            const temp = Buffer.alloc(2);
            temp.writeUInt16LE(word);
            this._incomingBuffer[cmd] = temp[0];
            this._incomingBuffer[cmd + 1] = temp[1];

            // TODO Process the word

            return Promise.resolve();
        }

        return Promise.reject("IO Error");
    }

    public sendByte(cmd: number): Promise<void> {
        if (this._isError) {
            return Promise.reject("IO Error");
        }

        if (cmd < this._incomingBuffer.length) {
            // TODO do something?
            return Promise.resolve();
        }

        return Promise.reject("IO Error");
    }

    public receiveByte(): Promise<number> {
        if (this._isError) {
            return Promise.reject("IO Error");
        }

        // TODO Implement
        return Promise.resolve(0);
    }

    // Mock Romi functions
    public setFirmwareIdent(ident: number) {
        this._actualBuffer[RomiShmemBuffer.firmwareIdent.offset] = ident & 0xFF;
    }

    public resetRomi() {
        // Simulates a reset
        const shmemElements: ShmemElementDefinition[] = [];

        // Initialize the buffers
        Object.keys(RomiShmemBuffer).forEach(key => {
            shmemElements.push(RomiShmemBuffer[key]);
        });

        shmemElements.sort((a, b) => {
            return a.offset - b.offset;
        });

        // Compute the size of the buffer which is the offset of the
        // last element + its size
        const lastElem = shmemElements[shmemElements.length - 1];
        const bufferSize = ((lastElem.arraySize || 1) * getDataTypeSize(lastElem.type)) + lastElem.offset + 1;

        this._incomingBuffer = new Array(bufferSize);
        this._actualBuffer = new Array(bufferSize);
    }

    public setI2CBusError(isError: boolean) {
        this._isError = isError;
    }
}
