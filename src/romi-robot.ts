import { WPILibWSRobotBase, DigitalChannelMode } from "wpilib-ws-robot";
import I2CPromisifiedBus from "./i2c/i2c-connection";
import PromiseQueue from "promise-queue";

import RomiDataBuffer from "./romi-shmem-buffer";

interface IEncoderInfo {
    reportedValue: number; // This is the reading that is reported to usercode
    lastRobotValue: number; // The last robot-reported value
}

enum IOPinMode {
    DIO = "dio",
    ANALOG_IN = "ain",
    PWM = "pwm"
}

interface IPinConfiguration {
    pinNumber: number;
    analogChannel?: number;
    mode: IOPinMode
}

interface IPinCapability {
    pinNumber: number;
    analogChannel?: number;
    supportedModes: IOPinMode[];
}

// Supported modes for the Romi pins
const IO_CAPABILITIES: IPinCapability[] = [
    { pinNumber: 11, supportedModes: [IOPinMode.DIO, IOPinMode.PWM] },
    { pinNumber: 4, analogChannel: 6, supportedModes: [IOPinMode.DIO, IOPinMode.ANALOG_IN, IOPinMode.PWM] },
    { pinNumber: 20, analogChannel: 2, supportedModes: [IOPinMode.DIO, IOPinMode.ANALOG_IN, IOPinMode.PWM] },
    { pinNumber: 21, analogChannel: 3, supportedModes: [IOPinMode.DIO, IOPinMode.ANALOG_IN, IOPinMode.PWM] },
    { pinNumber: 22, analogChannel: 4, supportedModes: [IOPinMode.DIO, IOPinMode.ANALOG_IN, IOPinMode.PWM] },
];

const DEFAULT_IO_CONFIGURATION: IPinConfiguration[] = [
    { pinNumber: 11, mode: IOPinMode.DIO },
    { pinNumber: 4, analogChannel: 6, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 20, analogChannel: 2, mode: IOPinMode.ANALOG_IN },
    { pinNumber: 21, analogChannel: 3, mode: IOPinMode.PWM },
    { pinNumber: 22, analogChannel: 4, mode: IOPinMode.PWM }
];

export default class WPILibWSRomiRobot extends WPILibWSRobotBase {
    private _i2cBus: I2CPromisifiedBus;
    private _i2cAddress: number;

    private _batteryPct: number = 0;

    private _i2cQueue: PromiseQueue = new PromiseQueue(1);
    private _heartbeatTimer: NodeJS.Timeout;
    private _readTimer: NodeJS.Timeout;

    private _digitalInputValues: Map<number, boolean> = new Map<number, boolean>();
    private _analogInputValues: Map<number, number> = new Map<number, number>();
    private _encoderInputValues: Map<number, IEncoderInfo> = new Map<number, IEncoderInfo>();

    private _ioConfiguration: IPinConfiguration[] = DEFAULT_IO_CONFIGURATION;
    private _extDioPins: number[] = []; // Index maps to a DIO channel of (8 + idx). Value is the IO pin index
    private _extAnalogInPins: number[] = []; // Idx maps to Analog In channel of idx. Value is IO pin index
    private _extPwmPins: number[] = []; // Idx maps to PWM channel of (2 + idx). Value is the IO pin index

    // Take in the abstract bus, since this will allow us to
    // write unit tests more easily
    constructor(bus: I2CPromisifiedBus, address: number, ioConfig?: IPinConfiguration[]) {
        super();

        // TODO We should wrap HW initialization in a promise
        // that readyP() can return
        this._i2cBus = bus;
        this._i2cAddress = address;

        // Set up the overlay configuration
        if (ioConfig && this._verifyConfiguration(ioConfig)) {
            this._ioConfiguration = ioConfig;
        }

        this._configureIO();

        // Initial set up of digital inputs (we set DIO 0 to input because it's a button)
        this._digitalInputValues.set(0, false);

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

            this._readBattery();
        }, 50);

        // Set up the status check
        setInterval(() => {
            this._readByte(RomiDataBuffer.status.offset)
            .then(val => {
                if (val === 0) {
                    console.log("Status byte is 0. Assuming brown out. Rewriting IO config");
                    // If the status byte is 0, we might have browned out the romi
                    // So we write the IO configuration again
                    this._writeIOConfiguration();
                }
            })
        }, 500);
    }

    public readyP(): Promise<void> {
        return Promise.resolve();
    }

    public get descriptor(): string {
        return "WPILibWS Reference Robot (Romi)";
    }

    public getBatteryPercentage(): number {
        return this._batteryPct;
    }

    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        // For DIO 0-3, we use the builtinConfig field
        if (channel < 0) {
            return;
        }

        // Channels 4,5,6,7 are virtually "used" for the encoders
        if (channel >= 4 && channel <= 7) {
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



        if (channel >= 8) {
            // DIO channels 8 and above are external
            const extDioIdx = channel - 8;
            if (extDioIdx >= this._extDioPins.length) {
                // Out of bounds
                return;
            }

            let pinModeConfig = (1 << 7);
            pinModeConfig |= ((this._extDioPins[extDioIdx] << 2) & 0xC);
            pinModeConfig |= mode === DigitalChannelMode.INPUT ? 1 : 0;

            this._writeByte(RomiDataBuffer.ioConfig.offset, pinModeConfig);
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

        if (channel >= 8) {
            const extDioIdx = channel - 8;
            if (this._extDioPins[extDioIdx] !== undefined) {
                const ioIdx = this._extDioPins[extDioIdx];
                this._writeByte(RomiDataBuffer.extIoValues.offset + (ioIdx * 2), value ? 1 : 0);
            }
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
        const totalPwmPorts = 2 + this._extPwmPins.length;
        if (channel < totalPwmPorts) {
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

            let offset;
            if (channel === 0) {
                offset = RomiDataBuffer.leftMotor.offset;
            }
            else if (channel === 1) {
                offset = RomiDataBuffer.rightMotor.offset;
            }
            else {
                const pwmIoIdx = channel - 2;
                const ioIdx = this._extPwmPins[pwmIoIdx];
                offset = RomiDataBuffer.extIoValues.offset + (ioIdx * 2);
            }
            this._writeWord(offset, tmp.readUInt16BE());
        }
    }

    public getEncoderCount(channel: number): number {
        if (!this._encoderInputValues.has(channel)) {
            return 0;
        }

        return this._encoderInputValues.get(channel).reportedValue;
    }

    public resetEncoder(channel: number, keepLast?: boolean): void {
        if (channel !== 0 && channel !== 1) {
            return;
        }

        let offset = RomiDataBuffer.resetLeftEncoder.offset;
        if (channel === 1) {
            offset = RomiDataBuffer.resetRightEncoder.offset;
        }

        const encoderInfo = this._encoderInputValues.get(channel);
        encoderInfo.lastRobotValue = 0;

        if (!keepLast) {
            encoderInfo.reportedValue = 0;
        }

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

    protected async _writeByte(cmd: number, byte: number, delayMs?: number = 0): Promise<void> {
        return this._i2cQueue.add(() => {
            return this._i2cBus.writeByte(this._i2cAddress, cmd, byte)
            .then(() => {
                return new Promise(resolve => {
                    setTimeout(() =>{
                        resolve();
                    }, delayMs);
                });
            });
        });
    }

    protected async _writeWord(cmd: number, word: number, delayMs?: number = 0): Promise<void> {
        return this._i2cQueue.add(() => {
            return this._i2cBus.writeWord(this._i2cAddress, cmd, word)
            .then(() => {
                return new Promise(resolve => {
                    setTimeout(() =>{
                        resolve();
                    }, delayMs);
                });
            });
        });
    }

    private _verifyConfiguration(config: IPinConfiguration[]): boolean {
        if (config.length !== IO_CAPABILITIES.length) {
            console.log(`Incorrect number of pin config options. Expected ${IO_CAPABILITIES.length} but got ${config.length}`);
            return false;
        }

        for (let i = 0; i < config.length; i++) {
            // For each element, make sure that we are setting a mode that is supported
            const configOption = config[i];
            if (IO_CAPABILITIES[i].supportedModes.indexOf(configOption.mode) === -1) {
                console.log(`Invalid mode set for pin ${i}. Supported modes are ${JSON.stringify(IO_CAPABILITIES[i].supportedModes)}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Configure the IO pins on the romi
     */
    private _configureIO() {
        // Loop through the configuration array and write the pin config messages
        // Wipe out the IO maps
        this._extAnalogInPins = [];
        this._extDioPins = [];
        this._extPwmPins = [];

        this._ioConfiguration.forEach((pinConfig, ioIdx) => {
            switch (pinConfig.mode) {
                case IOPinMode.ANALOG_IN:
                    this._extAnalogInPins.push(ioIdx);
                    // We also need to add these to the input set
                    this._analogInputValues.set(this._extAnalogInPins.length - 1, 0.0);
                    break;
                case IOPinMode.DIO:
                    this._extDioPins.push(ioIdx);
                    break;
                case IOPinMode.PWM:
                    this._extPwmPins.push(ioIdx);
                    break;
            }
        });

        this._writeIOConfiguration();
    }

    /**
     * Do the actual configuration write to the romi
     */
    private _writeIOConfiguration() {
        this._ioConfiguration.forEach((pinConfig, ioIdx) => {
            let mode: number = 0;

            if (pinConfig.mode === IOPinMode.ANALOG_IN) {
                mode = 2;
            }
            else if (pinConfig.mode === IOPinMode.PWM) {
                mode = 3;
            }
            // Generate the byte
            let pinModeConfig = (1 << 7);
            pinModeConfig |= ((ioIdx << 2) & 0xC);
            pinModeConfig |= (mode & 0x3);

            // We're writing these VERY quickly, so give the AVR a little
            // breathing room to process
            this._writeByte(RomiDataBuffer.ioConfig.offset, pinModeConfig, 2);
        });
    }

    private _bulkAnalogRead() {
        // Loop through the _extAnalogInPins to find the index we want
        this._extAnalogInPins.forEach((extIoIdx, ainIdx) => {
            const offset = RomiDataBuffer.extIoValues.offset + (extIoIdx * 2);
            this._readWord(offset)
            .then(voltage => {
                // TODO verify that this is available?
                this._analogInputValues.set(ainIdx, voltage);
            });
        });

    }

    private _bulkDigitalRead() {
        this._digitalInputValues.forEach((val, channel) => {
            let offset = RomiDataBuffer.builtinDioValues.offset;

            if (channel < 4) {
                offset += channel;
            }
            else if (channel >= 8) {
                const dioIdx = channel - 8;
                if (this._extDioPins[dioIdx] !== undefined) {
                    // Little endian, so reading 1 byte is fine
                    offset = RomiDataBuffer.extIoValues.offset + (this._extDioPins[dioIdx] * 2);
                }
                else {
                    return;
                }
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
                // This comes in as a uint16_t
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(encoderValue);
                encoderValue = buf.readInt16LE();

                const lastValue = encoderInfo.lastRobotValue;
                const delta = encoderValue - lastValue;

                encoderInfo.reportedValue += delta;
                encoderInfo.lastRobotValue = encoderValue;

                // If we're getting close to the limits, reset the romi
                // encoder so we don't overflow
                if (Math.abs(encoderValue) > 30000) {
                    this.resetEncoder(channel, true);
                    encoderInfo.lastRobotValue = 0;
                }
            });
        });
    }

    private _readBattery(): void {
        this._readWord(RomiDataBuffer.batteryMillivolts.offset)
        .then(battMv => {
            this._batteryPct = battMv / 9000;
        });
    }
}
