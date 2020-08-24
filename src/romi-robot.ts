import { WPILibWSRobotBase, DigitalChannelMode } from "wpilib-ws-robot";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import PromiseQueue from "promise-queue";

import RomiDataBuffer from "./romi-shmem-buffer";

interface IEncoderInfo {
    reportedValue: number; // This is the reading that is reported to usercode
    lastRobotValue: number; // The last robot-reported value
}

export default class WPILibWSRomiRobot extends WPILibWSRobotBase {
    private _i2cBus: I2CPromisifiedBus;
    private _i2cAddress: number;

    private _i2cQueue: PromiseQueue = new PromiseQueue(1);
    private _heartbeatTimer: NodeJS.Timeout;
    private _readTimer: NodeJS.Timeout;

    private _digitalInputValues: Map<number, boolean> = new Map<number, boolean>();
    private _analogInputValues: Map<number, number> = new Map<number, number>();
    private _encoderInputValues: Map<number, IEncoderInfo> = new Map<number, IEncoderInfo>();

    // Take in the abstract bus, since this will allow us to
    // write unit tests more easily
    constructor(bus: I2CPromisifiedBus, address: number) {
        super();

        this._i2cBus = bus;
        this._i2cAddress = address;

        // Initial set up of digital and analog inputs
        this._digitalInputValues.set(0, false);
        this._analogInputValues.set(0, 0.0);
        this._analogInputValues.set(1, 0.0);

        // Set up encoders
        this._encoderInputValues.set(0, {
            reportedValue: 0,
            lastRobotValue: 0
        });

        this._encoderInputValues.set(1, {
            reportedValue: 0,
            lastRobotValue: 0
        });

        // Set up the heartbeat
        this._heartbeatTimer = setInterval(() => {
            this._writeByte(RomiDataBuffer.heartbeat.offset, 1);
        }, 100);

        // Set up the read timer
        this._readTimer = setInterval(() => {
            this._bulkAnalogRead();
            this._bulkDigitalRead();
            this._bulkEncoderRead();
        }, 50);
    }

    public readyP(): Promise<void> {
        return Promise.resolve();
    }

    public get descriptor(): string {
        return "WPILibWS Reference Robot (Romi)";
    }

    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        // For DIO 0-3, we use the builtinConfig field
        if (channel < 0) {
            return;
        }

        const channelMode = (mode === DigitalChannelMode.INPUT) ? 1 : 0;

        if (channel < 4) {
            // Builtin
            let builtinModeConfig = (1 << 7);
            builtinModeConfig |= ((channel << 2) & 0xC);
            builtinModeConfig |= (channelMode & 0x3);

            this._writeByte(RomiDataBuffer.builtinConfig.offset, builtinModeConfig);
        }

        // Channels 4,5,6,7 are virtually "used" for the encoders

        if (channel === 8) {
            this._writeByte(RomiDataBuffer.dio8Input.offset, mode === DigitalChannelMode.INPUT ? 1 : 0);
        }

        if (mode !== DigitalChannelMode.INPUT) {
            this._digitalInputValues.delete(channel);
        }
        else if (!this._digitalInputValues.has(channel)) {
            this._digitalInputValues.set(channel, false);
        }
    }

    public setDIOValue(channel: number, value: boolean): void {
        if (channel < 4) {
            // Use the built in DIO
            this._writeByte(RomiDataBuffer.builtinDioValues.offset + channel, value ? 1 : 0);
        }

        if (channel === 8) {
            this._writeByte(RomiDataBuffer.dio8Value.offset, value ? 1 : 0);
        }
    }

    public getDIOValue(channel: number): boolean {
        if (!this._digitalInputValues.has(channel)) {
            return false;
        }

        return this._digitalInputValues.get(channel);
    }

    public setAnalogOutVoltage(channel: number, voltage: number): void {
        // no-op
    }

    public getAnalogInVoltage(channel: number): number {
        if (!this._analogInputValues.has(channel)) {
            return 0.0;
        }

        return this._analogInputValues.get(channel);
    }

    public setPWMValue(channel: number, value: number): void {
        if (channel < RomiDataBuffer.pwm.arraySize) {
            // We get the value in the range 0-255 but the romi
            // expects -400 to 400
            // (Also, we need to flip the signs to get the robot driving
            // in the correct orientation)
            const romiValue = -Math.floor(((value / 255) * 800) - 400);

            // We need to do some trickery to get a twos-complement number
            // Essentially we'll write a 16 bit signed int to the buffer
            // and read it out as an unsigned int
            // Mainly to work around the fact that the i2c-bus library's
            // writeBlock() doesn't work...
            const tmp = Buffer.alloc(2);
            tmp.writeInt16BE(romiValue);
            this._writeWord(RomiDataBuffer.pwm.offset + (channel * 2), tmp.readUInt16BE());
        }
    }

    public getEncoderCount(channel: number): number {
        if (!this._encoderInputValues.has(channel)) {
            return 0;
        }

        return this._encoderInputValues.get(channel).reportedValue;
    }

    public resetEncoder(channel: number): void {
        if (channel !== 0 && channel !== 1) {
            return;
        }

        let offset = RomiDataBuffer.resetLeftEncoder.offset;
        if (channel === 1) {
            offset = RomiDataBuffer.resetRightEncoder.offset;
        }

        const encoderInfo = this._encoderInputValues.get(channel);
        encoderInfo.lastRobotValue = 0;
        encoderInfo.reportedValue = 0;

        this._writeByte(offset, 1);
    }

    public setEncoderReverseDirection(channel: number, reverse: boolean): void {
        // TODO Implement
    }

    protected async _readByte(cmd: number): Promise<number> {
        return this._i2cQueue.add(() => {
            return this._i2cBus.readByte(this._i2cAddress, cmd);
        });
    }

    protected async _readWord(cmd: number): Promise<number> {
        return this._i2cQueue.add(() => {
            return this._i2cBus.readWord(this._i2cAddress, cmd);
        });
    }

    protected async _writeByte(cmd: number, byte: number): Promise<void> {
        return this._i2cQueue.add(() => {
            return this._i2cBus.writeByte(this._i2cAddress, cmd, byte);
        });
    }

    protected async _writeWord(cmd: number, word: number): Promise<void> {
        return this._i2cQueue.add(() => {
            return this._i2cBus.writeWord(this._i2cAddress, cmd, word)
        });
    }

    private _bulkAnalogRead() {
        this._analogInputValues.forEach((val, channel) => {
            // Offset by 2 bytes for each element
            this._readWord(RomiDataBuffer.analog.offset + (channel * 2))
            .then(voltage => {
                this._analogInputValues.set(channel, voltage);
            });
        });
    }

    private _bulkDigitalRead() {
        this._digitalInputValues.forEach((val, channel) => {
            let offset = RomiDataBuffer.builtinDioValues.offset;

            if (channel < 4) {
                offset += channel;
            }
            else if (channel === 8) {
                offset = RomiDataBuffer.dio8Value.offset;
            }
            else {
                return;
            }

            this._readByte(offset)
            .then(value => {
                this._digitalInputValues.set(channel, value !== 0);
            });
        });
    }

    private _bulkEncoderRead() {
        this._encoderInputValues.forEach((encoderInfo, channel) => {
            if (channel !== 0 && channel !== 1) {
                return;
            }

            let offset = RomiDataBuffer.leftEncoder.offset;
            if (channel === 1) {
                offset = RomiDataBuffer.rightEncoder.offset;
            }

            this._readWord(offset)
            .then(encoderValue => {
                const lastValue = encoderInfo.lastRobotValue;
                const delta = encoderValue - lastValue;

                encoderInfo.reportedValue += delta;
                encoderInfo.lastRobotValue = encoderValue;

                // If we're getting close to the limits, reset the romi
                // encoder so we don't overflow
                if (Math.abs(encoderValue) > 65000) {
                    this.resetEncoder(channel);
                    encoderInfo.lastRobotValue = 0;
                }
            });
        });
    }
}
