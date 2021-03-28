import { NetworkTableEntry } from "node-ntcore";
import I2CPromisifiedBus from "../../../../device-interfaces/i2c/i2c-connection";
import LogUtil from "../../../../utils/logging/log-util";
import CustomDevice, { IOInterfaces, RobotHardwareInterfaces } from "../custom-device";
import SimColorSensor from "./sim-color-sensor";

/**
 * Implementation Note
 *
 * This implementation copies a lot from REV's Java API
 * https://github.com/REVrobotics/Color-Sensor-v3/blob/master/src/main/java/com/revrobotics/ColorSensorV3.java
 *
 * Specifically around the I2C reads.
 *
 * It is currently not 100% feature complete (we don't allow configuration changes
 * just yet) but works decently well as is.
 */

const DEVICE_IDENT: string = "REV-ColorSensorV3";

const I2C_ADDRESS = 0x52;
const PART_IDENT = 0xC2;

enum Register {
    MAIN_CTRL = 0x00,
    PROX_SENSOR_LED = 0x01,
    PROX_SENSOR_PULSES = 0x02,
    PROX_SENSOR_RATE = 0x03,
    LIGHT_SENSOR_MEAUSUREMENT_RATE = 0x04,
    LIGHT_SENSOR_GAIN = 0x05,
    PART_ID = 0x06,
    MAIN_STATUS = 0x07,
    PROX_DATA = 0x08,
    DATA_INFRARED = 0x0A,
    DATA_GREEN = 0x0D,
    DATA_BLUE = 0x10,
    DATA_RED = 0x13
}

enum MainControl {
    RGB_MODE = 0x04, // If bit is set to 1, color channels are activated
    LIGHT_SENSOR_ENABLE = 0x02,
    PROX_SENSOR_ENABLE = 0x01,
    OFF = 0x00
}

enum GainFactor {
    GAIN_1X = 0x00,
    GAIN_3X = 0x01,
    GAIN_6X = 0x02,
    GAIN_9X = 0x03,
    GAIN_18X = 0x04
}

enum LEDCurrent {
    PULSE_2mA = 0x00,
    PULSE_5mA = 0x01,
    PULSE_10mA = 0x02,
    PULSE_25mA = 0x03,
    PULSE_50mA = 0x04,
    PULSE_75mA = 0x05,
    PULSE_100mA = 0x06, // default value
    PULSE_125mA = 0x07
}

enum LEDPulseFrequency {
    FREQ_60kHZ = 0x18, // default value
    FREQ_70kHZ = 0x40,
    FREQ_80kHZ = 0x28,
    FREQ_90kHZ = 0x30,
    FREQ_100kHAZ = 0x38
}

enum ProximitySensorResolution {
    PROX_RES_8BIT = 0x00,
    PROX_RES_9BIT = 0x08,
    PROX_RES_10BIT = 0x10,
    PROX_RES_11BIT = 0x18
}

enum ProximitySensorMeasurementRate {
    PROX_RATE_6MS = 0x01,
    PROX_RATE_12MS = 0x02,
    PROX_RATE_25MS = 0x03,
    PROX_RATE_50MS = 0x04,
    PROX_RATE_100MS = 0x05, // default value
    PROX_RATE_200MS = 0x06,
    PROX_RATE_400MS = 0x07
}

enum ColorSensorResolution {
    COLOR_SENSOR_RES_20BIT = 0x00,
    COLOR_SENSOR_RES_19BIT = 0x10,
    COLOR_SENSOR_RES_18BIT = 0x20,
    COLOR_SENSOR_RES_17BIT = 0x30,
    COLOR_SENSOR_RES_16BIT = 0x40,
    COLOR_SENSOR_RES_13BIT = 0x50
}

enum ColorSensorMeasurementRate {
    COLOR_RATE_25MS = 0,
    COLOR_RATE_50MS = 1,
    COLOR_RATE_100MS = 2,
    COLOR_RATE_200MS = 3,
    COLOR_RATE_500MS = 4,
    COLOR_RATE_1000MS = 5,
    COLOR_RATE_2000MS = 7
}

const logger = LogUtil.getLogger(DEVICE_IDENT);

export interface RevColorSensorConfig {
    port?: number;
    channel?: number;
}

export default class RevColorSensorV3 extends CustomDevice {
    private _config: RevColorSensorConfig;
    private _i2cBus: I2CPromisifiedBus;

    private _lastRed: number = 0;
    private _lastBlue: number = 0;
    private _lastGreen: number = 0;
    private _lastIR: number = 0;

    private _lastProx: number = 0;

    private _simDevice: SimColorSensor;

    private _ntEntryRed: NetworkTableEntry;
    private _ntEntryGreen: NetworkTableEntry;
    private _ntEntryBlue: NetworkTableEntry;
    private _ntEntryIR: NetworkTableEntry;
    private _ntEntryProx: NetworkTableEntry;

    constructor(robotHW: RobotHardwareInterfaces, config: RevColorSensorConfig) {
        super(DEVICE_IDENT, true, robotHW, true);

        this._config = config;
        this._i2cBus = robotHW.i2cBus.rawBus;

        // Set up NT entries
        if (this.networkTable) {
            this._ntEntryRed = this.networkTable.getEntry("Red");
            this._ntEntryGreen = this.networkTable.getEntry("Green");
            this._ntEntryBlue = this.networkTable.getEntry("Blue");
            this._ntEntryIR = this.networkTable.getEntry("IR");
            this._ntEntryProx = this.networkTable.getEntry("Proximity");
        }

        const devicePortIndex: number = config.port !== undefined ? config.port : 0;
        const deviceChannelIndex: number = config.channel !== undefined ? config.channel : I2C_ADDRESS;

        this._simDevice = new SimColorSensor(devicePortIndex, deviceChannelIndex);

        this._checkDeviceID()
        .then(idValid => {
            if (idValid) {
                return this._initializeDevice()
                .then(() => {
                    return this.hasReset();
                });
            }
        });
    }

    public get ioInterfaces(): IOInterfaces {
        // Returning an empty object since this uses SimDevice + NT
        return {
            simDevices: [this._simDevice]
        };
    }

    public async update(): Promise<void> {
        this._lastRed = await this._read20BitRegister(Register.DATA_RED);
        this._lastGreen = await this._read20BitRegister(Register.DATA_GREEN);
        this._lastBlue = await this._read20BitRegister(Register.DATA_BLUE);
        this._lastIR = await this._read20BitRegister(Register.DATA_INFRARED);

        this._lastProx = await this._read11BitRegister(Register.PROX_DATA);

        // Update the SimDevice
        this._simDevice.red = this._lastRed;
        this._simDevice.green = this._lastGreen;
        this._simDevice.blue = this._lastBlue;
        this._simDevice.infrared = this._lastIR;
        this._simDevice.proximity = this._lastProx;

        // Also update the NT Interface
        if (this.networkTable) {
            this._ntEntryRed.setDouble(this._lastRed);
            this._ntEntryGreen.setDouble(this._lastGreen);
            this._ntEntryBlue.setDouble(this._lastBlue);
            this._ntEntryIR.setDouble(this._lastIR);
            this._ntEntryProx.setDouble(this._lastProx);
        }
    }

    /**
     * Configure the IR LED used by proximity sensor
     * @param freq
     * @param current
     * @param pulses
     */
    public async configureProximitySensorLED(freq: LEDPulseFrequency, current: LEDCurrent, pulses: number): Promise<void> {
        const buf = Buffer.alloc(1);
        buf.writeUInt8(pulses);
        await this._writeByte(Register.PROX_SENSOR_LED, freq | current);
        await this._writeByte(Register.PROX_SENSOR_PULSES, buf.readUInt8());
    }

    /**
     * Configure the proximity sensor
     * @param res
     * @param rate
     */
    public async configureProximitySensor(res: ProximitySensorResolution, rate: ProximitySensorMeasurementRate): Promise<void> {
        await this._writeByte(Register.PROX_SENSOR_RATE, res | rate);
    }

    public async configureColorSensor(res: ColorSensorResolution, rate: ColorSensorMeasurementRate, gain: GainFactor): Promise<void> {
        await this._writeByte(Register.LIGHT_SENSOR_MEAUSUREMENT_RATE, res | rate);
        await this._writeByte(Register.LIGHT_SENSOR_GAIN, gain);
    }

    public getProximity(): number {
        return this._lastProx;
    }

    public getRed(): number {
        return this._lastRed;
    }

    public getGreen(): number {
        return this._lastGreen;
    }

    public getBlue(): number {
        return this._lastBlue;
    }

    public getIR(): number {
        return this._lastIR;
    }

    public async hasReset(): Promise<boolean> {
        const value = await this._readByte(Register.MAIN_STATUS);
        return (value & 0x20) !== 0;
    }

    private async _checkDeviceID(): Promise<boolean> {
        try {
            const value = await this._readByte(Register.PART_ID);
            if (value !== PART_IDENT) {
                logger.error("Unknown device found with same I2C address, but incorrect ident");
                return false;
            }

            return true;
        }
        catch (err) {
            logger.error("Could not find REV Color Sensor");
            return false;
        }
    }

    private async _initializeDevice(): Promise<void> {
        await this._writeByte(Register.MAIN_CTRL, MainControl.RGB_MODE | MainControl.LIGHT_SENSOR_ENABLE | MainControl.PROX_SENSOR_ENABLE);
        await this._writeByte(Register.PROX_SENSOR_RATE, ProximitySensorResolution.PROX_RES_11BIT | ProximitySensorMeasurementRate.PROX_RATE_100MS);
        await this._writeByte(Register.PROX_SENSOR_PULSES, 32);
    }

    private async _read11BitRegister(reg: Register): Promise<number> {
        const buf = Buffer.alloc(2);
        const offset = (reg as number);

        buf[0] = await this._readByte(offset);
        buf[1] = await this._readByte(offset + 1);

        return buf.readUInt16LE() & 0x7FF;
    }

    private async _read20BitRegister(reg: Register): Promise<number> {
        const buf = Buffer.alloc(4);
        const offset = (reg as number);

        buf[0] = await this._readByte(offset);
        buf[1] = await this._readByte(offset + 1);
        buf[2] = await this._readByte(offset + 2);

        return buf.readUInt32LE() & 0x03FFFF;
    }

    private async _writeByte(cmd: number, byte: number): Promise<void> {
        return this._i2cBus.writeByte(I2C_ADDRESS, cmd, byte);
    }

    private async _readByte(cmd: number): Promise<number> {
        return this._i2cBus.readByte(I2C_ADDRESS, cmd);
    }
}
