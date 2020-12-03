import MockI2CDevice from "../i2c/mock-i2c-device";

export default class MockRomiImu extends MockI2CDevice {
    public readByte(cmd: number): Promise<number> {
        return Promise.resolve(0);
    }
    public readWord(cmd: number): Promise<number> {
        return Promise.resolve(0);
    }
    public writeByte(cmd: number, byte: number): Promise<void> {
        return Promise.resolve();
    }
    public writeWord(cmd: number, word: number): Promise<void> {
        return Promise.resolve();
    }

}
