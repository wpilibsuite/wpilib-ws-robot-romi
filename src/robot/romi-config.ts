import { NUM_CONFIGURABLE_PINS } from "./romi-robot";
import jsonfile from "jsonfile";
import ProgramArguments from "../program-arguments";
import { Vector3 } from "./devices/core/lsm6/lsm6";

export interface RomiConfigJson {
    ioConfig: string[];
    gyroZeroOffset: Vector3;
    gyroFilterWindowSize?: number;
}

export enum IOPinMode {
    DIO = "dio",
    ANALOG_IN = "ain",
    PWM = "pwm"
}

export interface PinConfiguration {
    mode: IOPinMode;
}

export interface PinCapability {
    supportedModes: IOPinMode[];
}

export const DEFAULT_IO_CONFIGURATION: PinConfiguration[] = [
    { mode: IOPinMode.DIO },
    { mode: IOPinMode.ANALOG_IN },
    { mode: IOPinMode.ANALOG_IN },
    { mode: IOPinMode.PWM },
    { mode: IOPinMode.PWM }
];

export default class RomiConfiguration {
    private _extIOConfig: PinConfiguration[] = [];
    private _gyroZeroOffset: Vector3 = { x: 0, y: 0, z: 0};

    private _gyroFilterWindowSize: number = 5;

    constructor(programArgs?: ProgramArguments) {
        // Pre-load the external IO configuration
        DEFAULT_IO_CONFIGURATION.forEach(val => this._extIOConfig.push(Object.assign({}, val)));

        let isConfigError: boolean = false;

        if (programArgs && programArgs.config !== undefined) {
            try {
                const romiConfig: RomiConfigJson = jsonfile.readFileSync(programArgs.config);

                if (romiConfig) {
                    if (romiConfig.ioConfig) {
                        if (!(romiConfig.ioConfig instanceof Array)) {
                            isConfigError = true;
                            throw new Error("[CONFIG] Invalid or malformed configuration object");
                        }
                        const portConfigs: string[] = romiConfig.ioConfig;
                        if (portConfigs.length !== NUM_CONFIGURABLE_PINS) {
                            isConfigError = true;
                            throw new Error("[CONFIG] Invalid number of IO port configurations");
                        }

                        for (let i = 0; i < NUM_CONFIGURABLE_PINS; i++) {
                            let pinMode: IOPinMode;

                            switch (portConfigs[i].toLowerCase()) {
                                case "pwm":
                                    pinMode = IOPinMode.PWM;
                                    break;
                                case "ain":
                                    if (i === 0) {
                                        isConfigError = true;
                                        throw new Error("[CONFIG] Invalid mode for pin EXT 0");
                                    }
                                    pinMode = IOPinMode.ANALOG_IN;
                                    break;
                                case "dio":
                                    pinMode = IOPinMode.DIO;
                                    break;
                                default:
                                    isConfigError = true;
                                    throw new Error("[CONFIG] Invalid mode specified for pin EXT " + i);
                            }

                            this._extIOConfig[i].mode = pinMode;
                        }
                    }

                    if (romiConfig.gyroZeroOffset) {
                        this._gyroZeroOffset = romiConfig.gyroZeroOffset;
                    }

                    if (romiConfig.gyroFilterWindowSize) {
                        this._gyroFilterWindowSize = romiConfig.gyroFilterWindowSize;
                    }
                }
                else {
                    isConfigError = true;
                    throw new Error("[CONFIG] Invalid or malformed configuration object")
                }
            }
            catch (err) {
                if (isConfigError) {
                    // Rethrow the error
                    throw err;
                }

                throw new Error("[CONFIG] " + err.message);
            }
        }
    }

    public get externalIOConfig(): PinConfiguration[] {
        return this._extIOConfig;
    }

    public set externalIOConfig(val: PinConfiguration[]) {
        this._extIOConfig = val;
    }

    public get gyroZeroOffset(): Vector3 {
        return this._gyroZeroOffset;
    }

    public set gyroZeroOffset(val: Vector3) {
        this._gyroZeroOffset = val;
    }

    public get gyroFilterWindowSize(): number {
        return this._gyroFilterWindowSize;
    }

    public set gyroFilterWindowSize(val: number) {
        this._gyroFilterWindowSize = val;
    }

    public get pinConfigurationString(): string {
        return this._extIOConfig.map((val, idx) => {
            return `EXT${idx}(${val.mode})`;
        })
        .join(", ");
    }
}
