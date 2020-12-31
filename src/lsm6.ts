import I2CPromisifiedBus from "./i2c/i2c-connection";

// LSM6DS33 Datasheet: https://www.pololu.com/file/0J1087/LSM6DS33.pdf

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

// Range scales for the accelerometer
export enum AccelerometerScale {
    SCALE_2G = "SCALE_2G",
    SCALE_4G = "SCALE_4G",
    SCALE_8G = "SCALE_8G",
    SCALE_16G = "SCALE_16G"
}

// Range scales for the gyro
export enum GyroScale {
    SCALE_125_DPS = "SCALE_125_DPS",
    SCALE_250_DPS = "SCALE_250_DPS",
    SCALE_500_DPS = "SCALE_500_DPS",
    SCALE_1000_DPS = "SCALE_1000_DPS",
    SCALE_2000_DPS = "SCALE_2000_DPS"
}

export interface Vector3 {
    x: number;
    y: number;
    z: number;
}

const ACCEL_SCALE_CTRL_BYTE: Map<AccelerometerScale, number> = new Map<AccelerometerScale, number>();
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_2G, 0x40);
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_4G, 0x48);
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_8G, 0x4C);
ACCEL_SCALE_CTRL_BYTE.set(AccelerometerScale.SCALE_16G, 0x44);

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

export default class LSM6 {
    private _accel: Vector3 = { x: 0, y: 0, z: 0 };
    private _gyro: Vector3 = { x: 0, y: 0, z: 0 };

    private _accelOffset: Vector3 = { x: 0, y: 0, z: 0 };
    private _gyroOffset: Vector3 = { x: 0, y: 0, z: 0 };

    private _i2cBus: I2CPromisifiedBus;
    private _i2cAddress: number;

    private _isReady: boolean = false;

    private _accelerometerScale: AccelerometerScale = AccelerometerScale.SCALE_2G;
    private _gyroScale: GyroScale = GyroScale.SCALE_250_DPS;

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
                console.log("[IMU] Invalid WHO_AM_I response");
                throw new Error("Invalid WHO_AM_I");
            }
            else {
                console.log("[IMU] Identified as LSM6DS33");
                console.log("[IMU] Gyro Zero Offset at Init: " + JSON.stringify(this._gyroOffset));
                this._isReady = true;
            }
        });
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

    public async enableDefault(): Promise<void> {
        if (!this._isReady) {
            return;
        }

        // Accelerometer
        await this.setAccelerometerScale(AccelerometerScale.SCALE_2G);

        // Gyro
        await this.setGyroScale(GyroScale.SCALE_1000_DPS);

        // Common
        await this._writeByte(RegAddr.CTRL3_C, IF_INC_ENABLED);
    }

    public async setAccelerometerScale(scale: AccelerometerScale): Promise<void> {
        if (!this._isReady) {
            return;
        }

        const controlByte = ACCEL_SCALE_CTRL_BYTE.get(scale);
        await this._writeByte(RegAddr.CTRL1_XL, controlByte);
        this._accelerometerScale = scale;

        console.log(`[IMU] Accelerometer Scale: ${scale}`);
    }

    public async setGyroScale(scale: GyroScale): Promise<void> {
        if (!this._isReady) {
            return;
        }

        const controlByte = GYRO_SCALE_CTRL_BYTE.get(scale);
        await this._writeByte(RegAddr.CTRL2_G, controlByte);
        this._gyroScale = scale;

        console.log(`[IMU] Gyro Scale: ${scale}`);
    }

    /**
     * Read the current accelerometer values and update our internal data
     *
     * The values obtained from the raw I2C read operations are the
     * 16-bit twos-complement raw IMU values. They will need to be
     * multiplied by the sensitivity values to obtain a reading in mG.
     *
     * The final values that get stored are in G
     *
     * Linear Acceleration Sensitivity: LA_So (page 15)
     */
    public async readAccelerometer(): Promise<void> {
        if (!this._isReady) {
            return;
        }

        const xla = await this._readByte(RegAddr.OUTX_L_XL);
        const xha = await this._readByte(RegAddr.OUTX_H_XL);
        const yla = await this._readByte(RegAddr.OUTY_L_XL);
        const yha = await this._readByte(RegAddr.OUTY_H_XL);
        const zla = await this._readByte(RegAddr.OUTZ_L_XL);
        const zha = await this._readByte(RegAddr.OUTZ_H_XL);

        const accelX = (xha << 8) | xla;
        const accelY = (yha << 8) | yla;
        const accelZ = (zha << 8) | zla;

        const tmpBuf = Buffer.alloc(2);

        tmpBuf.writeUInt16BE(accelX, 0);
        const accelXsigned = tmpBuf.readInt16BE(0);

        tmpBuf.writeUInt16BE(accelY, 0);
        const accelYsigned = tmpBuf.readInt16BE(0);

        tmpBuf.writeUInt16BE(accelZ, 0);
        const accelZsigned = tmpBuf.readInt16BE(0);

        const scaleFactor = ACCEL_OUTPUT_SCALE_FACTOR.get(this._accelerometerScale);

        this._accel.x = (scaleFactor * accelXsigned) / 1000;
        this._accel.y = (scaleFactor * accelYsigned) / 1000;
        this._accel.z = (scaleFactor * accelZsigned) / 1000;
    }

    /**
     * Read the current gyro values and update our internal data
     *
     * The values obtained from the raw I2C read operations are the
     * 16-bit twos-complement raw IMU values. They will need to be
     * multiplied by the sensitivity values to obtain a reading in mDPS.
     *
     * The final values that get stored are in degrees-per-second (dps)
     *
     * Angular Rate Sensitivity: G_So (page 15)
     */
    public async readGyro(): Promise<void> {
        if (!this._isReady) {
            return;
        }

        const xlg = await this._readByte(RegAddr.OUTX_L_G);
        const xhg = await this._readByte(RegAddr.OUTX_H_G);
        const ylg = await this._readByte(RegAddr.OUTY_L_G);
        const yhg = await this._readByte(RegAddr.OUTY_H_G);
        const zlg = await this._readByte(RegAddr.OUTZ_L_G);
        const zhg = await this._readByte(RegAddr.OUTZ_H_G);

        const gyroX = (xhg << 8) | xlg;
        const gyroY = (yhg << 8) | ylg;
        const gyroZ = (zhg << 8) | zlg;

        const tmpBuf = Buffer.alloc(2);

        tmpBuf.writeUInt16BE(gyroX, 0);
        const gyroXsigned = tmpBuf.readInt16BE(0);

        tmpBuf.writeUInt16BE(gyroY, 0);
        const gyroYsigned = tmpBuf.readInt16BE(0);

        tmpBuf.writeUInt16BE(gyroZ, 0);
        const gyroZsigned = tmpBuf.readInt16BE(0);

        const scaleFactor = GYRO_OUTPUT_SCALE_FACTOR.get(this._gyroScale);

        this._gyro.x = ((scaleFactor * gyroXsigned) / 1000) - this._gyroOffset.x;
        this._gyro.y = ((scaleFactor * gyroYsigned) / 1000) - this._gyroOffset.y;
        this._gyro.z = ((scaleFactor * gyroZsigned) / 1000) - this._gyroOffset.z;
    }

    private _readByte(cmd: number): Promise<number> {
        return this._i2cBus.readByte(this._i2cAddress, cmd);
    }

    private _writeByte(cmd: number, byte: number): Promise<void> {
        return this._i2cBus.writeByte(this._i2cAddress, cmd, byte);
    }

}
