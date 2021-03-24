import LogUtil from "../../../../utils/logging/log-util";
import I2CPromisifiedBus from "../../../../device-interfaces/i2c/i2c-connection";
import LSM6Settings, { AccelerometerScale, FIFOModeSelection, GyroScale, OutputDataRate } from "./lsm6-settings";

// LSM6DS33 Datasheet: https://www.st.com/resource/en/datasheet/lsm6ds33.pdf

enum RegAddr {
    FUNC_CFG_ACCESS   = 0x01,

    FIFO_CTRL1        = 0x06,
    FIFO_CTRL2        = 0x07,
    FIFO_CTRL3        = 0x08,
    FIFO_CTRL4        = 0x09,
    FIFO_CTRL5        = 0x0A,
    ORIENT_CFG_G      = 0x0B,

    INT1_CTRL         = 0x0D,
    INT2_CTRL         = 0x0E,
    WHO_AM_I          = 0x0F,
    CTRL1_XL          = 0x10,
    CTRL2_G           = 0x11,
    CTRL3_C           = 0x12,
    CTRL4_C           = 0x13,
    CTRL5_C           = 0x14,
    CTRL6_C           = 0x15,
    CTRL7_G           = 0x16,
    CTRL8_XL          = 0x17,
    CTRL9_XL          = 0x18,
    CTRL10_C          = 0x19,

    WAKE_UP_SRC       = 0x1B,
    TAP_SRC           = 0x1C,
    D6D_SRC           = 0x1D,
    STATUS_REG        = 0x1E,

    OUT_TEMP_L        = 0x20,
    OUT_TEMP_H        = 0x21,
    OUTX_L_G          = 0x22,
    OUTX_H_G          = 0x23,
    OUTY_L_G          = 0x24,
    OUTY_H_G          = 0x25,
    OUTZ_L_G          = 0x26,
    OUTZ_H_G          = 0x27,
    OUTX_L_XL         = 0x28,
    OUTX_H_XL         = 0x29,
    OUTY_L_XL         = 0x2A,
    OUTY_H_XL         = 0x2B,
    OUTZ_L_XL         = 0x2C,
    OUTZ_H_XL         = 0x2D,

    FIFO_STATUS1      = 0x3A,
    FIFO_STATUS2      = 0x3B,
    FIFO_STATUS3      = 0x3C,
    FIFO_STATUS4      = 0x3D,
    FIFO_DATA_OUT_L   = 0x3E,
    FIFO_DATA_OUT_H   = 0x3F,
    TIMESTAMP0_REG    = 0x40,
    TIMESTAMP1_REG    = 0x41,
    TIMESTAMP2_REG    = 0x42,

    STEP_TIMESTAMP_L  = 0x49,
    STEP_TIMESTAMP_H  = 0x4A,
    STEP_COUNTER_L    = 0x4B,
    STEP_COUNTER_H    = 0x4C,

    FUNC_SRC          = 0x53,

    TAP_CFG           = 0x58,
    TAP_THS_6D        = 0x59,
    INT_DUR2          = 0x5A,
    WAKE_UP_THS       = 0x5B,
    WAKE_UP_DUR       = 0x5C,
    FREE_FALL         = 0x5D,
    MD1_CFG           = 0x5E,
    MD2_CFG           = 0x5F,
}

const DS33_WHO_ID = 0x69;
const IF_INC_ENABLED = 0x04;

enum CTRL3_C_OPTIONS {
    BOOT = 1 << 7,
    BDU = 1 << 6,
    H_LACTIVE = 1 << 5,
    PP_OD = 1 << 4,
    SIM = 1 << 3,
    IF_INC = 1 << 2,
    BLE = 1 << 1,
    SW_RESET = 1
}

export interface FIFOFrame {
    gyroX: number;
    gyroY: number;
    gyroZ: number;
    accelX: number;
    accelY: number;
    accelZ: number;
}

// Used with FIFO_CTRL5
const FIFO_ODR_BYTE: Map<OutputDataRate, number> = new Map<OutputDataRate, number>();
FIFO_ODR_BYTE.set(OutputDataRate.ODR_DISABLED, 0x00);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_12_5_HZ, (0x1) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_26_HZ, (0x2) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_52_HZ, (0x3) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_104_HZ, (0x4) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_208_HZ, (0x5) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_416_HZ, (0x6) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_833_HZ, (0x7) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_1_66_KHZ, (0x8) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_3_33_KHZ, (0x9) << 3);
FIFO_ODR_BYTE.set(OutputDataRate.ODR_6_66_KHZ, (0xA) << 3);

// Used with CTRL1_XL
const XL_ODR_BYTE: Map<OutputDataRate, number> = new Map<OutputDataRate, number>();
XL_ODR_BYTE.set(OutputDataRate.ODR_DISABLED, 0x00);
XL_ODR_BYTE.set(OutputDataRate.ODR_12_5_HZ, (0x1) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_26_HZ, (0x2) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_52_HZ, (0x3) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_104_HZ, (0x4) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_208_HZ, (0x5) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_416_HZ, (0x6) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_833_HZ, (0x7) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_1_66_KHZ, (0x8) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_3_33_KHZ, (0x9) << 4);
XL_ODR_BYTE.set(OutputDataRate.ODR_6_66_KHZ, (0xA) << 4);

// Used with CTRL2_G
const G_ODR_BYTE: Map<OutputDataRate, number> = new Map<OutputDataRate, number>();
G_ODR_BYTE.set(OutputDataRate.ODR_DISABLED, 0x00);
G_ODR_BYTE.set(OutputDataRate.ODR_12_5_HZ, (0x1) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_26_HZ, (0x2) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_52_HZ, (0x3) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_104_HZ, (0x4) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_208_HZ, (0x5) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_416_HZ, (0x6) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_833_HZ, (0x7) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_1_66_KHZ, (0x8) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_3_33_KHZ, (0x8) << 4);
G_ODR_BYTE.set(OutputDataRate.ODR_6_66_KHZ, (0x8) << 4);

const FIFO_MODE_BYTE: Map<FIFOModeSelection, number> = new Map<FIFOModeSelection, number>();
FIFO_MODE_BYTE.set(FIFOModeSelection.BYPASS, 0x0);
FIFO_MODE_BYTE.set(FIFOModeSelection.FIFO, 0x1);
FIFO_MODE_BYTE.set(FIFOModeSelection.CONTINUOUS_FIFO, 0x3);
FIFO_MODE_BYTE.set(FIFOModeSelection.BYPASS_CONTINUOUS, 0x4);
FIFO_MODE_BYTE.set(FIFOModeSelection.CONTINUOUS, 0x6);

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

// Used with CTRL1_XL
const XL_FS_BYTE: Map<AccelerometerScale, number> = new Map<AccelerometerScale, number>();
XL_FS_BYTE.set(AccelerometerScale.SCALE_2G, 0x00);
XL_FS_BYTE.set(AccelerometerScale.SCALE_4G, 0x08);
XL_FS_BYTE.set(AccelerometerScale.SCALE_8G, 0x0C);
XL_FS_BYTE.set(AccelerometerScale.SCALE_16G, 0x04);

const ACCEL_SCALE_CTRL_BYTE: Map<AccelerometerScale, number> = new Map<AccelerometerScale, number>();
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_2G, 0x40);
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_4G, 0x48);
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_8G, 0x4C);
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_16G, 0x44);

// Used with CTRL2_G
const G_FS_BYTE: Map<GyroScale, number> = new Map<GyroScale, number>();
G_FS_BYTE.set(GyroScale.SCALE_125_DPS, 0x02);
G_FS_BYTE.set(GyroScale.SCALE_250_DPS, 0x00);
G_FS_BYTE.set(GyroScale.SCALE_500_DPS, 0x04);
G_FS_BYTE.set(GyroScale.SCALE_1000_DPS, 0x08);
G_FS_BYTE.set(GyroScale.SCALE_2000_DPS, 0x0C);

const GYRO_SCALE_CTRL_BYTE: Map<GyroScale, number> = new Map<GyroScale, number>();
GYRO_SCALE_CTRL_BYTE.set(GyroScale.SCALE_125_DPS, 0x42);
GYRO_SCALE_CTRL_BYTE.set(GyroScale.SCALE_250_DPS, 0x40);
GYRO_SCALE_CTRL_BYTE.set(GyroScale.SCALE_500_DPS, 0x44);
GYRO_SCALE_CTRL_BYTE.set(GyroScale.SCALE_1000_DPS, 0x48);
GYRO_SCALE_CTRL_BYTE.set(GyroScale.SCALE_2000_DPS, 0x4C);

// Sensitivity in mg/LSB
const ACCEL_OUTPUT_SCALE_FACTOR: Map<AccelerometerScale, number> = new Map<AccelerometerScale, number>();
ACCEL_OUTPUT_SCALE_FACTOR.set(AccelerometerScale.SCALE_2G, 0.061);
ACCEL_OUTPUT_SCALE_FACTOR.set(AccelerometerScale.SCALE_4G, 0.122);
ACCEL_OUTPUT_SCALE_FACTOR.set(AccelerometerScale.SCALE_8G, 0.244);
ACCEL_OUTPUT_SCALE_FACTOR.set(AccelerometerScale.SCALE_16G, 0.488);

// Sensitivity in mdps/LSB
const GYRO_OUTPUT_SCALE_FACTOR: Map<GyroScale, number> = new Map<GyroScale, number>();
GYRO_OUTPUT_SCALE_FACTOR.set(GyroScale.SCALE_125_DPS, 4.375);
GYRO_OUTPUT_SCALE_FACTOR.set(GyroScale.SCALE_250_DPS, 8.75);
GYRO_OUTPUT_SCALE_FACTOR.set(GyroScale.SCALE_500_DPS, 17.5);
GYRO_OUTPUT_SCALE_FACTOR.set(GyroScale.SCALE_1000_DPS, 35);
GYRO_OUTPUT_SCALE_FACTOR.set(GyroScale.SCALE_2000_DPS, 70);

export interface LSM6Config {
    accelOffset?: Vector3;
    gyroOffset?: Vector3;
}

function getFIFOPeriod(rate: OutputDataRate): number {
    switch (rate) {
        case OutputDataRate.ODR_12_5_HZ:
            return 1 / 12.5;
        case OutputDataRate.ODR_26_HZ:
            return 1 / 26.0;
        case OutputDataRate.ODR_52_HZ:
            return 1 / 52.0;
        case OutputDataRate.ODR_104_HZ:
            return 1 / 104.0;
        case OutputDataRate.ODR_208_HZ:
            return 1 / 208.0;
        case OutputDataRate.ODR_416_HZ:
            return 1 / 416.0;
        case OutputDataRate.ODR_833_HZ:
            return 1 / 833.0;
        case OutputDataRate.ODR_1_66_KHZ:
            return 1 / 1660.0;
        case OutputDataRate.ODR_3_33_KHZ:
            return 1 / 3330.0;
        case OutputDataRate.ODR_6_66_KHZ:
            return 1 / 6660.0;
    }
}

const logger = LogUtil.getLogger("IMU-ONBOARD");

export default class LSM6 {
    private _accel: Vector3 = { x: 0, y: 0, z: 0 };
    private _gyro: Vector3 = { x: 0, y: 0, z: 0 };

    private _accelOffset: Vector3 = { x: 0, y: 0, z: 0 };
    private _gyroOffset: Vector3 = { x: 0, y: 0, z: 0 };

    private _i2cBus: I2CPromisifiedBus;
    private _i2cAddress: number;

    private _isReady: boolean = false;

    private _settings: LSM6Settings = new LSM6Settings();

    private _fifoRunning: boolean = false;
    private _fifoBuffer: FIFOFrame[] = [];

    constructor(bus: I2CPromisifiedBus, address: number, config?: LSM6Config) {
        this._i2cAddress = address;
        this._i2cBus = bus;

        if (config?.accelOffset) {
            this.accelOffset = config.accelOffset;
        }

        if (config?.gyroOffset) {
            this.gyroOffset = config.gyroOffset;
        }
    }

    public init(): Promise<void> {
        return this._readByte(RegAddr.WHO_AM_I)
        .then(whoami => {
            if (whoami !== DS33_WHO_ID) {
                logger.error("Invalid WHO_AM_I response");
                throw new Error("Invalid WHO_AM_I");
            }
            else {
                logger.info("Identified as LSM6DS33");
                logger.info("Gyro Zero Offset at Init: " + JSON.stringify(this._gyroOffset));
                this._isReady = true;
            }
        });
    }

    public get settings(): LSM6Settings {
        return this._settings;
    }

    public get accelerationG(): Vector3 {
        return this._accel;
    }

    public get gyroDPS(): Vector3 {
        return this._gyro;
    }

    public get accelOffset(): Vector3 {
        return this._accelOffset;
    }

    public set accelOffset(val: Vector3) {
        this._accelOffset = val;
    }

    public get gyroOffset(): Vector3 {
        return this._gyroOffset;
    }

    public set gyroOffset(val: Vector3) {
        this._gyroOffset = val;
    }

    public getFIFOPeriod(): number {
        return getFIFOPeriod(this.settings.fifoSampleRate);
    }

    public async begin(): Promise<void> {
        await this._reset();

        // Set up accelerometer
        let dataToWrite: number = 0;
        if (this._settings.accelEnabled) {
            // Set up full scale and ODR
            dataToWrite = XL_ODR_BYTE.get(this._settings.accelODR) | XL_FS_BYTE.get(this._settings.accelRange);
            logger.info(`Accelerometer Settings: ${this._settings.accelRange} @ ${this._settings.accelODR}`);
        }

        // Write to the accelerometer config register
        await this._writeByte(RegAddr.CTRL1_XL, dataToWrite);
        logger.info(`Setting CTRL1_XL to 0x${dataToWrite.toString(16)}`);

        // Set up Gyro
        dataToWrite = 0;
        if (this._settings.gyroEnabled) {
            // Set up full scale and ODR
            dataToWrite = G_ODR_BYTE.get(this._settings.gyroODR) | G_FS_BYTE.get(this._settings.gyroRange);
            logger.info(`Gyro Settings: ${this._settings.gyroRange} @ ${this._settings.gyroODR}`);
        }

        // Write to the gyro config register
        await this._writeByte(RegAddr.CTRL2_G, dataToWrite);
        logger.info(`Setting CTRL2_G to 0x${dataToWrite.toString(16)}`);

        await this._fifoBegin();
    }

    private async _fifoBegin(): Promise<void> {
        const thresholdLByte = this._settings.fifoThreshold & 0xFF;
        const thresholdHByte = (this._settings.fifoThreshold & 0x0F00) >> 8;

        // Configure FIFO_CTRL3
        let tempFIFO_CTRL3 = 0;
        if (this._settings.gyroFIFOEnabled) {
            tempFIFO_CTRL3 |= (this.settings.gyroFIFODecimation & 0x7) << 3;
        }

        if (this._settings.accelFIFOEnabled) {
            tempFIFO_CTRL3 |= (this.settings.accelFIFODecimation & 0x7);
        }

        let tempFIFO_CTRL4 = 0;

        // Configure FIFO_CTRL5
        const tempFIFO_CTRL5 = FIFO_MODE_BYTE.get(this._settings.fifoModeSelection) | FIFO_ODR_BYTE.get(this._settings.fifoSampleRate);

        await this._writeByte(RegAddr.FIFO_CTRL1, thresholdLByte);
        logger.info(`Setting FIFO_CTRL1 to 0x${thresholdLByte.toString(16)}`);

        await this._writeByte(RegAddr.FIFO_CTRL2, thresholdHByte);
        logger.info(`Setting FIFO_CTRL2 to 0x${thresholdHByte.toString(16)}`);

        await this._writeByte(RegAddr.FIFO_CTRL3, tempFIFO_CTRL3);
        logger.info(`Setting FIFO_CTRL3 to 0x${tempFIFO_CTRL3.toString(16)}`);

        await this._writeByte(RegAddr.FIFO_CTRL4, tempFIFO_CTRL4);
        logger.info(`Setting FIFO_CTRL4 to 0x${tempFIFO_CTRL4.toString(16)}`);

        await this._writeByte(RegAddr.FIFO_CTRL5, tempFIFO_CTRL5);
        logger.info(`Setting FIFO_CTRL5 to 0x${tempFIFO_CTRL5.toString(16)}`);
    }

    public async enableDefault(): Promise<void> {
        if (!this._isReady) {
            return;
        }

        // Set up the device
        await this._reset();

        // Accelerometer
        await this.setAccelerometerScale(AccelerometerScale.SCALE_2G);

        // Gyro
        await this.setGyroScale(GyroScale.SCALE_1000_DPS);

        // Common
        const ctrl3cByte = CTRL3_C_OPTIONS.IF_INC;
        await this._writeByte(RegAddr.CTRL3_C, ctrl3cByte);
    }

    public async setAccelerometerScale(scale: AccelerometerScale): Promise<void> {
        if (!this._isReady) {
            return;
        }

        const controlByte = XL_ODR_BYTE.get(this.settings.accelODR) | XL_FS_BYTE.get(scale);

        await this._writeByte(RegAddr.CTRL1_XL, controlByte);
        this._settings.accelRange = scale;

        logger.info(`Accelerometer Settings: ${scale} @ ${this.settings.accelODR}`);
    }

    public async setGyroScale(scale: GyroScale): Promise<void> {
        if (!this._isReady) {
            return;
        }

        const controlByte = G_ODR_BYTE.get(this.settings.gyroODR) | G_FS_BYTE.get(scale);

        await this._writeByte(RegAddr.CTRL2_G, controlByte);
        this._settings.gyroRange = scale;

        logger.info(`Gyro Scale: ${scale} @ ${this.settings.gyroODR}`);
    }

    public fifoStart() {
        if (this._fifoRunning) {
            return;
        }

        logger.info("Starting FIFO reads");
        this._fifoRunning = true;

        this._runFifoLoop();
    }

    public fifoStop() {
        if (!this._fifoRunning) {
            return;
        }

        logger.info("Stopping FIFO reads");
        this._fifoRunning = false;
    }

    /**
     * Returns any unprocessed FIFO Frames and clears the internal buffer
     */
    public getNewFIFOData(): FIFOFrame[] {
        const ret: FIFOFrame[] = [...this._fifoBuffer];
        this._fifoBuffer = [];
        return ret;
    }

    private async _reset(): Promise<void> {
        // Initiate a software reboot

        // Set the gyro in power down mode
        await this._writeByte(RegAddr.CTRL2_G, 0x00);

        // Set accelerometer in high perf
        await this._writeByte(RegAddr.CTRL6_C, 0x00);

        // Send the SW_RESET signal
        await this._writeByte(RegAddr.CTRL3_C, CTRL3_C_OPTIONS.SW_RESET);

        for (let i = 0; i < 10; i++) {
            if (i > 0) {
                logger.info(`Waiting for reset... ${i}ms`);
            }
            await this._waitMS(1);
            const val = await this._readByte(RegAddr.CTRL3_C);
            if ((val & 0x1) === 0) {
                logger.info("Reset complete");
                return;
            }
        }

        logger.error("Reset timed out...");
        return;
    }

    /**
     * Perform a read of the FIFO buffer and store any saved frames into our
     * internal storage.
     *
     * A "frame" consists of a snapshot of gyro and accelerometer values. The
     * time between each "frame" is dependent on the FIFO ODR value
     * @private
     */
    private async _fifoLoop(): Promise<void> {
        const start = Date.now();
        const status = await this._fifoGetStatus();
        logger.silly(`FIFO Status: 0x${status.toString(16)}`);

        const numUnread = status & 0xFFF;
        logger.silly(`Num unread entries: ${numUnread}`);
        const valBuf = Buffer.alloc(2);

        const tempFrame: FIFOFrame = {
            gyroX: 0,
            gyroY: 0,
            gyroZ: 0,
            accelX: 0,
            accelY: 0,
            accelZ: 0
        }

        const accelScaleFactor = ACCEL_OUTPUT_SCALE_FACTOR.get(this._settings.accelRange);
        const gyroScaleFactor = GYRO_OUTPUT_SCALE_FACTOR.get(this._settings.gyroRange);

        // We only want to process groups of 6 values (which correspond to 3 gyro + 3 accel values)
        // An IMU "data frame" consists of 6 reads off the FIFO register
        // The order of values read are: GyroX, GyroY, GyroZ, AccelX, AccelY, AccelZ
        //
        // All values read from the FIFO are read in as 16-bit twos-complement raw values.
        // These need to be multiplied by the sensitivity values to obtain a reading in
        // mG (for the accelerometer) or mDPS (for the gyro). Frame data is stored with
        // the following units:
        // G for accelerometer values
        // DPS for gyro values
        //
        // References
        // Angular Rate Sensitivity: G_So (page 15)
        // Linear Acceleration Sensitivity: LA_So (page 15)
        const shouldProcess = (numUnread % 6 === 0);
        for (let i = 0; i < numUnread; i++) {
            // ReadWord is implemented as a Little Endian 2 byte read
            // The register layout (in increasing memory address order) is
            // FIFO_DATA_OUT_L, FIFO_DATA_OUT_H
            // We now read the 2 bytes starting at FIFO_DATA_OUT_L as an
            // unsigned 16 bit number, and convert that to a signed 16 bit
            let val = await this._readWord(RegAddr.FIFO_DATA_OUT_L);
            valBuf.writeUInt16LE(val);
            val = valBuf.readInt16LE();

            if (shouldProcess) {
                switch (i % 6) {
                    case 0:
                        tempFrame.gyroX = ((val * gyroScaleFactor) / 1000) - this._gyroOffset.x;
                        break;
                    case 1:
                        tempFrame.gyroY = ((val * gyroScaleFactor) / 1000) - this._gyroOffset.y;
                        break;
                    case 2:
                        tempFrame.gyroZ = ((val * gyroScaleFactor) / 1000) - this._gyroOffset.z;
                        break;
                    case 3:
                        tempFrame.accelX = (val * accelScaleFactor) / 1000;
                        break;
                    case 4:
                        tempFrame.accelY = (val * accelScaleFactor) / 1000;
                        break;
                    case 5:
                        tempFrame.accelZ = (val * accelScaleFactor) / 1000;
                        this._fifoBuffer.push({...tempFrame});
                        break;
                }
            }
        }

        const end = Date.now();
        logger.silly(`FIFO LOOP took ${end-start}ms. Local Buffer size ${this._fifoBuffer.length}`);
    }

    /**
     * Read the FIFO status byte
     */
    private async _fifoGetStatus(): Promise<number> {
        let temp = 0;
        let accum = 0;

        temp = await this._readByte(RegAddr.FIFO_STATUS1);
        accum = temp;
        temp = await this._readByte(RegAddr.FIFO_STATUS2);
        accum |= (temp << 8);

        return accum;
    }

    /**
     * Wrapper function for constantly checking the FIFO buffer
     */
    private _runFifoLoop() {
        setImmediate(async () => {
            await this._fifoLoop();
            if (this._fifoRunning) {
                this._runFifoLoop();
            }
        });
    }

    private async _readByte(cmd: number): Promise<number> {
        return this._i2cBus.readByte(this._i2cAddress, cmd);
    }

    private async _writeByte(cmd: number, byte: number): Promise<void> {
        return this._i2cBus.writeByte(this._i2cAddress, cmd, byte);
    }

    private async _readWord(cmd: number): Promise<number> {
        return this._i2cBus.readWord(this._i2cAddress, cmd);
    }

    private async _sendByte(cmd: number): Promise<void> {
        return this._i2cBus.sendByte(this._i2cAddress, cmd);
    }

    private async _receiveByte(): Promise<number> {
        return this._i2cBus.receiveByte(this._i2cAddress);
    }

    private async _waitMS(delayMS: number): Promise<void> {
        return new Promise(resolve => {
            setTimeout(() => {
                resolve();
            }, delayMS);
        });
    }
}
