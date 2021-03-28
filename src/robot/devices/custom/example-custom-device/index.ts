import { DigitalChannelMode } from "@wpilib/wpilib-ws-robot";
import LogUtil from "../../../../utils/logging/log-util";
import CustomDevice, { IOInterfaces, RobotHardwareInterfaces } from "../custom-device";

export enum ExampleDevicePortModes {
    DIO = "DIO",
    ANALOG_IN = "ANALOG_IN",
    PWM = "PWM"
}

export interface ExampleDeviceConfig {
    portConfigs: ExampleDevicePortModes[];
}

const logger = LogUtil.getLogger("EXAMPLE-DEVICE");

export default class ExampleCustomDevice extends CustomDevice {
    private _config: ExampleDeviceConfig;

    private _numDIO: number = 0;
    private _numAnalogIn: number = 0;
    private _numPWM: number = 0;

    private _dioChannels: number[] = [];
    private _ainChannels: number[] = [];
    private _pwmChannels: number[] = [];

    private _dioValue: boolean = false;
    private _ainValue: number = 0;
    private _ainDelta: number = 0.2;
    private _lastUpdateTimeMs: number = 0;

    constructor(robotHW: RobotHardwareInterfaces, config: ExampleDeviceConfig) {
        super("ExampleDevice", false, robotHW);

        this._config = config;
        this._setup();
    }

    public get ioInterfaces(): IOInterfaces {

        return {
            numDioPorts: this._numDIO,
            numAnalogInPorts: this._numAnalogIn,
            numPwmOutPorts: this._numPWM
        };
    }

    public update(): void {
        if (this._lastUpdateTimeMs === 0) {
            this._lastUpdateTimeMs = Date.now();
            return;
        }

        if (Date.now() - this._lastUpdateTimeMs > 500) {
            this._dioValue = !this._dioValue;

            // Triangular Wave
            this._ainValue += this._ainDelta;
            if (this._ainValue > 5) {
                this._ainValue -= this._ainDelta;
                this._ainDelta = -this._ainDelta;
            }
            else if (this._ainValue < 0) {
                this._ainValue -= this._ainDelta;
                this._ainDelta = -this._ainDelta;
            }
            this._lastUpdateTimeMs = Date.now();
        }
    }

    private _setup() {
        if (this._config.portConfigs.length !== 5) {
            throw new Error(`Invalid number of port configs specified. Expected 5 but got ${this._config.portConfigs.length}`);
        }

        // In this example, all we do is increment the counts of the
        // various port types
        this._config.portConfigs.forEach((portConfig, idx) => {
            switch (portConfig) {
                case ExampleDevicePortModes.DIO:
                    this._numDIO++;
                    this._dioChannels.push(idx);
                    break;
                case ExampleDevicePortModes.ANALOG_IN:
                    this._numAnalogIn++;
                    this._ainChannels.push(idx);
                    break;
                case ExampleDevicePortModes.PWM:
                    this._numPWM++;
                    this._pwmChannels.push(idx);
                    break;
            }
        });
    }

    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        if (this._dioChannels[channel] === undefined) {
            return;
        }

        logger.info(`Setting DIO port ${channel} (Physical pin ${this._dioChannels[channel]}) mode to ${mode}`);
    }

    public setDIOValue(channel: number, value: boolean): void {
        if (this._dioChannels[channel] === undefined) {
            return;
        }

        logger.info(`Setting DIO port ${channel} (Physical pin ${this._dioChannels[channel]}) value to ${value}`);
    }

    public setPWMValue(channel: number, value: number): void {
        if (this._pwmChannels[channel] === undefined) {
            return;
        }

        logger.info(`Setting PWM port ${channel} (Physical pin ${this._pwmChannels[channel]}) value to ${value}`);
    }

    public getAnalogInVoltage(channel: number): Promise<number> {
        return Promise.resolve(this._ainValue);
    }

    public getDigitalInValue(channel: number): Promise<boolean> {
        return Promise.resolve(this._dioValue);
    }
}
