import { WPILibWSRobotBase, DigitalChannelMode } from "@wpilib/wpilib-ws-robot";

import RomiDataBuffer, { FIRMWARE_IDENT } from "./romi-shmem-buffer";
import I2CErrorDetector from "../device-interfaces/i2c/i2c-error-detector";
import LSM6 from "./devices/core/lsm6/lsm6";
import RomiConfiguration, { DEFAULT_IO_CONFIGURATION, IOPinMode, PinCapability, PinConfiguration } from "./romi-config";
import RomiAccelerometer from "./romi-accelerometer";
import RomiGyro from "./romi-gyro";
import QueuedI2CBus, { QueuedI2CHandle } from "../device-interfaces/i2c/queued-i2c-bus";

interface IEncoderInfo {
    reportedValue: number; // This is the reading that is reported to usercode
    reportedPeriod: number; // This is the period that is reported to usercode
    lastRobotValue: number; // The last robot-reported value
    isHardwareReversed?: boolean;
    isSoftwareReversed?: boolean;
    lastReportedTime?: number;
}

// Supported modes for the Romi pins
const IO_CAPABILITIES: PinCapability[] = [
    { supportedModes: [IOPinMode.DIO, IOPinMode.PWM] },
    { supportedModes: [IOPinMode.DIO, IOPinMode.PWM, IOPinMode.ANALOG_IN] },
    { supportedModes: [IOPinMode.DIO, IOPinMode.PWM, IOPinMode.ANALOG_IN] },
    { supportedModes: [IOPinMode.DIO, IOPinMode.PWM, IOPinMode.ANALOG_IN] },
    { supportedModes: [IOPinMode.DIO, IOPinMode.PWM, IOPinMode.ANALOG_IN] },
];

export const NUM_CONFIGURABLE_PINS: number = 5;

export default class WPILibWSRomiRobot extends WPILibWSRobotBase {
    private _queuedBus: QueuedI2CBus;
    private _i2cHandle: QueuedI2CHandle;

    private _firmwareIdent: number = -1;

    private _batteryPct: number = 0;

    private _heartbeatTimer: NodeJS.Timeout;
    private _readTimer: NodeJS.Timeout;
    private _gyroReadTimer: NodeJS.Timeout;

    private _digitalInputValues: Map<number, boolean> = new Map<number, boolean>();
    private _analogInputValues: Map<number, number> = new Map<number, number>();
    private _encoderInputValues: Map<number, IEncoderInfo> = new Map<number, IEncoderInfo>();

    // These store the HAL-registered encoder channels. -1 implies uninitialized
    private _leftEncoderChannel: number = -1;
    private _rightEncoderChannel: number = -1;

    private _ioConfiguration: PinConfiguration[] = DEFAULT_IO_CONFIGURATION;
    private _extDioPins: number[] = []; // Index maps to a DIO channel of (8 + idx). Value is the IO pin index
    private _extAnalogInPins: number[] = []; // Idx maps to Analog In channel of idx. Value is IO pin index
    private _extPwmPins: number[] = []; // Idx maps to PWM channel of (2 + idx). Value is the IO pin index

    private _extPinConfiguration: number[] = [];
    private _onboardPinConfiguration: number[] = [1, 0, 0, 0];

    private _readyP: Promise<void>;
    private _i2cErrorDetector: I2CErrorDetector = new I2CErrorDetector(10, 500, 100);

    private _lsm6: LSM6;

    private _romiAccelerometer: RomiAccelerometer;
    private _romiGyro: RomiGyro;

    // Keep track of the number of active WS connections
    private _numWsConnections: number = 0;

    // Keep track of whether or not the robot is DS enabled/disabled
    private _dsEnabled: boolean = false;

    // Keep track of the DS heartbeat
    private _dsHeartbeatPresent: boolean = false;

    // Take in the abstract bus, since this will allow us to
    // write unit tests more easily
    constructor(bus: QueuedI2CBus, address: number, romiConfig?: RomiConfiguration) {
        super();

        // By default, we'll use a queued I2C bus
        this._queuedBus = bus;
        this._i2cHandle = this._queuedBus.getNewAddressedHandle(address, true);

        // Set up the LSM6DS33 (and associated Romi IMU devices-s)
        this._lsm6 = new LSM6(this._queuedBus.rawBus, 0x6B);
        this._romiAccelerometer = new RomiAccelerometer(this._lsm6);
        this._romiGyro = new RomiGyro(this._lsm6);

        this.registerAccelerometer(this._romiAccelerometer);
        this.registerGyro(this._romiGyro);

        // Configure the onboard hardware
        if (romiConfig) {
            if (romiConfig.externalIOConfig) {
                if(this._verifyConfiguration(romiConfig.externalIOConfig)) {
                    this._ioConfiguration = romiConfig.externalIOConfig;
                }
                else {
                    console.log("[ROMI] Error verifying pin configuration. Reverting to default");
                }
            }

            if (romiConfig.gyroZeroOffset) {
                this._lsm6.gyroOffset = romiConfig.gyroZeroOffset;
            }
        }

        // Set up the ready indicator
        this._readyP =
            this._configureIO()
            .then(() => {
                // Read firmware identifier
                return this.queryFirmwareIdent();
            })
            .then(() => {
                // Verify firmware
                if (this._firmwareIdent !== FIRMWARE_IDENT) {
                    console.log(`[ROMI] Firmware Identifier Mismatch. Expected ${FIRMWARE_IDENT} but got ${this._firmwareIdent}`);
                }
            })
            .then(() => {
                // Initialize LSM6
                return this._lsm6.init()
                .then(() => {
                    // Enable the LSM6 at default values to start
                    // These can be reconfigured later
                    return this._lsm6.enableDefault();
                })
                .then(() => {
                    console.log("[ROMI] LSM6DS33 Initialized");
                })
                .catch(err => {
                    console.log("[ROMI] Failed to initialize IMU: " + err.message);
                });
            })
            .then(() => {
                this._resetToCleanState();

                // Set up the heartbeat. Only send the heartbeat if we have
                // an active WS connection, the robot is in enabled state
                // AND we have a recent-ish DS packet
                this._heartbeatTimer = setInterval(() => {
                    if (this._numWsConnections > 0 && this._dsEnabled && this._dsHeartbeatPresent) {
                        this._i2cHandle.writeByte(RomiDataBuffer.heartbeat.offset, 1)
                        .catch(err => {
                            this._i2cErrorDetector.addErrorInstance();
                        });
                    }
                }, 100);

                // Set up the read timer
                this._readTimer = setInterval(() => {
                    this._bulkAnalogRead();
                    this._bulkDigitalRead();
                    this._bulkEncoderRead();

                    this._readBattery();
                }, 50);

                // Set up the IMU read timer
                this._gyroReadTimer = setInterval(() => {
                    this._lsm6.readAccelerometer();
                    this._lsm6.readGyro();

                    this._romiAccelerometer.update();
                    this._romiGyro.update();
                }, 20);

                // Set up the status check
                setInterval(() => {
                    this._i2cHandle.readByte(RomiDataBuffer.status.offset)
                    .then(val => {
                        if (val === 0) {
                            console.log("[ROMI] Status byte is 0. Assuming brown out. Rewriting IO config");
                            // If the status byte is 0, we might have browned out the romi
                            // So we write the IO configuration again
                            this._writeOnboardIOConfiguration()
                            .then(() => {
                                this._writeIOConfiguration();
                            })
                            .then(() => {
                                // While we're at it... re-query the firmware
                                // Doing this on a timeout to give the 32U4 time
                                // to finish booting
                                setTimeout(() => {
                                    this.queryFirmwareIdent()
                                    .then((fwIdent) => {
                                        console.log("[ROMI] Firmware Identifier: " + fwIdent);
                                    });
                                }, 2000);
                            });

                        }
                    })
                    .catch(err => {
                        this._i2cErrorDetector.addErrorInstance();
                    });
                }, 500);
            })
            .catch(err => {
                console.log("[ROMI] Failed to initialize robot: ", err);
            });
    }

    public getIMU(): LSM6 {
        return this._lsm6;
    }

    public readyP(): Promise<void> {
        return this._readyP;
    }

    public get descriptor(): string {
        return "WPILibWS Reference Robot (Romi)";
    }

    public get firmwareIdent(): number {
        return this._firmwareIdent;
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

        // For onboard IO, only channels 1 and 2 are configurable
        if (channel == 1 || channel == 2) {
            this._onboardPinConfiguration[channel] = channelMode;
            this._writeOnboardIOConfiguration();
        }

        if (channel >= 8) {
            // DIO channels 8 and above are external
            const extDioIdx = channel - 8;
            if (extDioIdx >= this._extDioPins.length) {
                // Out of bounds
                return;
            }

            // Update the _extPinConfiguration array
            const ioPin: number = this._extDioPins[extDioIdx];
            this._extPinConfiguration[ioPin] = channelMode;

            // Write the configuration
            this._writeIOConfiguration();
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
            this._i2cHandle.writeByte(RomiDataBuffer.builtinDioValues.offset + channel, value ? 1 : 0)
            .catch(err => {
                this._i2cErrorDetector.addErrorInstance();
            });
        }

        if (channel >= 8) {
            const extDioIdx = channel - 8;
            if (this._extDioPins[extDioIdx] !== undefined) {
                const ioIdx = this._extDioPins[extDioIdx];
                this._i2cHandle.writeByte(RomiDataBuffer.extIoValues.offset + (ioIdx * 2), value ? 1 : 0)
                .catch(err => {
                    this._i2cErrorDetector.addErrorInstance();
                });
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
            // Positive values here correspond to forward motion
            const romiValue = Math.floor(((value / 255) * 800) - 400);

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
            this._i2cHandle.writeWord(offset, tmp.readUInt16BE())
            .catch(err => {
                this._i2cErrorDetector.addErrorInstance();
            });
        }
    }

    public registerEncoder(encoderChannel: number, channelA: number, channelB: number) {
        // Left encoder uses dio 4/5, right uses 6/7
        // If the channels are reversed, we'll set the hardware reversed flag
        if (channelA === 4 && channelB === 5) {
            this._encoderInputValues.set(encoderChannel, {
                reportedValue: 0,
                reportedPeriod: Number.MAX_VALUE,
                lastRobotValue: 0,
                isHardwareReversed: false
            });
            this._leftEncoderChannel = encoderChannel;
        }
        else if (channelA === 5 && channelB === 4) {
            this._encoderInputValues.set(encoderChannel, {
                reportedValue: 0,
                reportedPeriod: Number.MAX_VALUE,
                lastRobotValue: 0,
                isHardwareReversed: true
            });
            this._leftEncoderChannel = encoderChannel;
        }
        else if (channelA === 6 && channelB === 7) {
            this._encoderInputValues.set(encoderChannel, {
                reportedValue: 0,
                reportedPeriod: Number.MAX_VALUE,
                lastRobotValue: 0,
                isHardwareReversed: false
            });
            this._rightEncoderChannel = encoderChannel;
        }
        else if (channelA === 7 && channelB === 6) {
            this._encoderInputValues.set(encoderChannel, {
                reportedValue: 0,
                reportedPeriod: Number.MAX_VALUE,
                lastRobotValue: 0,
                isHardwareReversed: false
            });
            this._rightEncoderChannel = encoderChannel;
        }

        // If we have the wrong combination of pins, we ignore the encoder
    }

    public getEncoderCount(channel: number): number {
        if (!this._encoderInputValues.has(channel)) {
            return 0;
        }

        return this._encoderInputValues.get(channel).reportedValue;
    }

    public getEncoderPeriod(channel: number): number {
        if (!this._encoderInputValues.has(channel)) {
            return Number.MAX_VALUE;
        }

        return this._encoderInputValues.get(channel).reportedPeriod;
    }

    public resetEncoder(channel: number, keepLast?: boolean): void {
        let offset;
        if (channel === this._leftEncoderChannel) {
            offset = RomiDataBuffer.resetLeftEncoder.offset;
        }
        else if (channel === this._rightEncoderChannel) {
            offset = RomiDataBuffer.resetRightEncoder.offset;
        }
        else {
            return;
        }

        const encoderInfo = this._encoderInputValues.get(channel);
        encoderInfo.lastRobotValue = 0;

        if (!keepLast) {
            encoderInfo.reportedValue = 0;
        }

        this._i2cHandle.writeByte(offset, 1)
        .catch(err => {
            this._i2cErrorDetector.addErrorInstance();
        });
    }

    public setEncoderReverseDirection(channel: number, reverse: boolean): void {
        const encoderInfo = this._encoderInputValues.get(channel);
        if (encoderInfo) {
            encoderInfo.isSoftwareReversed = reverse;
        }
    }

    /**
     * Called when a new WebSocket connection occurs
     */
    public onWSConnection(remoteAddrV4?: string): void {
        // If this is the first WS connection
        if (this._numWsConnections === 0) {
            // Reset the gyro. This will ensure that the gyro will
            // read 0 (or close to it) as the robot program starts up
            this._romiGyro.reset();
        }

        this._numWsConnections++;

        console.log(`[ROMI] New WS Connection from ${remoteAddrV4}`);
        this.emit("wsConnection", {
            remoteAddrV4
        });
    }

    /**
     * Called when a WebSocket disconnects
     */
    public onWSDisconnection(): void {
        this._numWsConnections--;

        // If this was our last disconnection, clear out all the state
        if (this._numWsConnections === 0) {
            this._resetToCleanState();
            this.emit("wsNoConnections");
        }
    }

    public onRobotEnabled(): void {
        console.log("[ROMI] Robot ENABLED");
        this._dsEnabled = true;
    }

    public onRobotDisabled(): void {
        console.log("[ROMI] Robot DISABLED");
        this._dsEnabled = false;
    }

    public onDSPacketTimeoutOccurred(): void {
        console.log("[ROMI] DS Packet Heartbeat Lost");
        this._dsHeartbeatPresent = false;
    }

    public onDSPacketTimeoutCleared(): void {
        console.log("[ROMI] DS Packet Heartbeat Acquired");
        this._dsHeartbeatPresent = true;
    }

    public async queryFirmwareIdent(): Promise<number> {
        return this._i2cHandle.readByte(RomiDataBuffer.firmwareIdent.offset)
        .then(fwIdent => {
            this._firmwareIdent = fwIdent;
            return fwIdent;
        })
        .catch(err => {
            this._i2cErrorDetector.addErrorInstance();
            this._firmwareIdent = -1;
            return -1;
        });
    }

    private _verifyConfiguration(config: PinConfiguration[]): boolean {
        if (config.length !== IO_CAPABILITIES.length) {
            console.log(`[ROMI] Incorrect number of pin config options. Expected ${IO_CAPABILITIES.length} but got ${config.length}`);
            return false;
        }

        for (let i = 0; i < config.length; i++) {
            // For each element, make sure that we are setting a mode that is supported
            const configOption = config[i];
            if (IO_CAPABILITIES[i].supportedModes.indexOf(configOption.mode) === -1) {
                console.log(`[ROMI] Invalid mode set for pin ${i}. Supported modes are ${JSON.stringify(IO_CAPABILITIES[i].supportedModes)}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Configure the IO pins on the romi
     */
    private async _configureIO(): Promise<void> {
        // Loop through the configuration array and write the pin config messages
        // Wipe out the IO maps
        this._extAnalogInPins = [];
        this._extDioPins = [];
        this._extPwmPins = [];
        this._extPinConfiguration = [];

        this._ioConfiguration.forEach((pinConfig, ioIdx) => {
            switch (pinConfig.mode) {
                case IOPinMode.ANALOG_IN:
                    this._extPinConfiguration.push(2);
                    this._extAnalogInPins.push(ioIdx);
                    // We also need to add these to the input set
                    this._analogInputValues.set(this._extAnalogInPins.length - 1, 0.0);
                    break;
                case IOPinMode.DIO:
                    // Default to OUTPUT for digital pins
                    this._extPinConfiguration.push(0);
                    this._extDioPins.push(ioIdx);
                    break;
                case IOPinMode.PWM:
                    this._extPinConfiguration.push(3);
                    this._extPwmPins.push(ioIdx);
                    break;
            }
        });

        return this._writeIOConfiguration();
    }

    /**
     * Write the onboard IO configuration in oneshot
     */
    private async _writeOnboardIOConfiguration(): Promise<void> {
        let configRegister: number = (1 << 7);
        this._onboardPinConfiguration.forEach((pinMode, ioIdx) => {
            let pinModeConfig: number = (pinMode & 0x1) << ioIdx;
            configRegister |= pinModeConfig;
        });

        return this._i2cHandle.writeByte(RomiDataBuffer.builtinConfig.offset, configRegister, 3)
        .catch(err => {
            this._i2cErrorDetector.addErrorInstance();
        });
    }

    /**
     * Do the actual configuration write to the romi
     */
    private async _writeIOConfiguration(): Promise<void> {
        let configRegister: number = (1 << 15);

        this._extPinConfiguration.forEach((pinMode, ioIdx) => {
            let pinModeConfig: number = (pinMode & 0x3) << (13 - (2 * ioIdx));
            configRegister |= pinModeConfig;
        });

        return this._i2cHandle.writeWord(RomiDataBuffer.ioConfig.offset, configRegister, 3)
        .catch(err => {
            this._i2cErrorDetector.addErrorInstance();
        });
    }

    private _bulkAnalogRead() {
        // Loop through the _extAnalogInPins to find the index we want
        this._extAnalogInPins.forEach((extIoIdx, ainIdx) => {
            const offset = RomiDataBuffer.extIoValues.offset + (extIoIdx * 2);
            this._i2cHandle.readWord(offset)
            .then(adcVal => {
                // The value sent over the wire is a 10-bit ADC value
                // We'll need to convert it to 5V
                const voltage = (adcVal / 1023.0) * 5.0;
                this._analogInputValues.set(ainIdx, voltage);
            })
            .catch(err => {
                this._i2cErrorDetector.addErrorInstance();
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

            this._i2cHandle.readByte(offset)
            .then(value => {
                this._digitalInputValues.set(channel, value !== 0);
            })
            .catch(err => {
                this._i2cErrorDetector.addErrorInstance();
            });
        });
    }

    private _bulkEncoderRead() {
        this._encoderInputValues.forEach((encoderInfo, channel) => {
            let offset: number;
            if (channel === this._leftEncoderChannel) {
                offset = RomiDataBuffer.leftEncoder.offset;
            }
            else if (channel === this._rightEncoderChannel) {
                offset = RomiDataBuffer.rightEncoder.offset;
            }
            else {
                // Invalid encoder channel (shouldn't happen)
                // bail out
                return;
            }

            this._i2cHandle.readWord(offset)
            .then(encoderValue => {
                // This comes in as a uint16_t
                const buf = Buffer.alloc(2);
                buf.writeUInt16LE(encoderValue);
                encoderValue = buf.readInt16LE();

                const lastValue = encoderInfo.lastRobotValue;

                // Figure out if we should be reporting flipped values
                const reverseMultiplier = (encoderInfo.isHardwareReversed ? -1 : 1) *
                                          (encoderInfo.isSoftwareReversed ? -1 : 1);
                const delta = (encoderValue - lastValue) * reverseMultiplier;

                encoderInfo.reportedValue += delta;
                encoderInfo.lastRobotValue = encoderValue;

                const currTimestamp = Date.now();

                // Calculate the period
                if (encoderInfo.lastReportedTime !== undefined) {
                    const timespanMs = currTimestamp - encoderInfo.lastReportedTime;
                    // Period = (approx) timespan / delta
                    if (delta === 0) {
                        encoderInfo.reportedPeriod = Number.MAX_VALUE;
                    }
                    else {
                        encoderInfo.reportedPeriod = (timespanMs / delta) / 1000.0;
                    }
                }

                encoderInfo.lastReportedTime = currTimestamp;

                // If we're getting close to the limits, reset the romi
                // encoder so we don't overflow
                if (Math.abs(encoderValue) > 30000) {
                    this.resetEncoder(channel, true);
                    encoderInfo.lastRobotValue = 0;
                }
            })
            .catch(err => {
                this._i2cErrorDetector.addErrorInstance();
            })
        });
    }

    private _readBattery(): void {
        this._i2cHandle.readWord(RomiDataBuffer.batteryMillivolts.offset)
        .then(battMv => {
            this._batteryPct = battMv / 9000;
        })
        .catch(err => {
            this._i2cErrorDetector.addErrorInstance();
        })
    }

    /**
     * Resets the Romi to a known clean state
     * This does NOT reset any IO configuration
     */
    private _resetToCleanState(): void {
        this._digitalInputValues.clear();
        this._encoderInputValues.clear();
        this._analogInputValues.clear();

        this._leftEncoderChannel = -1;
        this._rightEncoderChannel = -1;

        // Set up DIO 0 as an input because it's a button
        this._digitalInputValues.set(0, false);

        // Reset our ds enabled state
        this._dsEnabled = false;
    }
}
