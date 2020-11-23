import { DEFAULT_IO_CONFIGURATION, IOPinMode, IPinConfiguration, NUM_CONFIGURABLE_PINS } from "./romi-robot";
import jsonfile from "jsonfile";
import ProgramArguments from "./program-arguments";

export interface RomiConfigJson {
    ioConfig: string[]
}

export default class RomiConfiguration {
    private _extIOConfig: IPinConfiguration[] = [];

    constructor(programArgs: ProgramArguments) {
        // Pre-load the external IO configuration
        DEFAULT_IO_CONFIGURATION.forEach(val => this._extIOConfig.push(Object.assign({}, val)));

        let isConfigError: boolean = false;

        if (programArgs.config !== undefined) {
            try {
                const romiConfig: RomiConfigJson = jsonfile.readFileSync(programArgs.config);

                if (romiConfig && romiConfig.ioConfig && (romiConfig.ioConfig instanceof Array)) {
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

    public get externalIOConfig(): IPinConfiguration[] {
        return this._extIOConfig;
    }

    public get pinConfigurationString(): string {
        return this._extIOConfig.map((val, idx) => {
            return `EXT${idx}(${val.mode})`;
        })
        .join(", ");
    }
}
