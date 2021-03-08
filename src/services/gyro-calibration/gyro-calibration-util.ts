import LogUtil from "../../utils/logging/log-util";
import LSM6, { Vector3 } from "../../robot/devices/core/lsm6/lsm6";

const logger = LogUtil.getLogger("SVC-GYROCAL");

export enum CalibrationState {
    IDLE = "IDLE",
    CALIBRATING = "CALIBRATING"
}

export interface CalibrationConfig {
    numSamples?: number;
    sampleIntervalMs?: number;
}

const DEFAULT_NUM_SAMPLES: number = 1500;
const DEFAULT_SAMPLE_INTERVAL_MS: number = 20;

export default class GyroCalibrationUtil {
    private _gyro: LSM6;

    private _state: CalibrationState = CalibrationState.IDLE;
    private _numSamplesProcessed: number = 0;

    private _numSamplesToTake: number = DEFAULT_NUM_SAMPLES;
    private _sampleIntervalMs: number = DEFAULT_SAMPLE_INTERVAL_MS;

    private _calibrationInterval: NodeJS.Timeout | undefined;

    private _lastZeroOffsetValue: Vector3 = { x: 0, y: 0, z: 0 };
    private _lastNoiseValue: Vector3 = { x: 0, y: 0, z: 0 };

    constructor(gyro: LSM6, config?: CalibrationConfig) {
        this._gyro = gyro;

        if (config?.numSamples) {
            this._numSamplesToTake = config.numSamples;
        }

        if (config?.sampleIntervalMs) {
            this._sampleIntervalMs = config.sampleIntervalMs;
        }
    }

    public calibrate() {
        // Cancel any existing calibration intervals
        if (this._calibrationInterval) {
            clearInterval(this._calibrationInterval);
            this._calibrationInterval = undefined;
        }

        logger.info("Beginning Gyro Calibration...");
        this._state = CalibrationState.CALIBRATING;

        // Reset the gyro offsets
        this._gyro.gyroOffset = { x: 0, y: 0, z: 0 };

        this._numSamplesProcessed = 0;
        this._gyro.readGyro()
        .then(() => {
            let minX: number = this._gyro.gyroDPS.x;
            let maxX: number = this._gyro.gyroDPS.x;
            let minY: number = this._gyro.gyroDPS.y;
            let maxY: number = this._gyro.gyroDPS.y;
            let minZ: number = this._gyro.gyroDPS.z;
            let maxZ: number = this._gyro.gyroDPS.z;

            let totalX: number = 0;
            let totalY: number = 0;
            let totalZ: number = 0;

            this._calibrationInterval = setInterval(() => {
                this._gyro.readGyro()
                .then(() => {
                    minX = Math.min(minX, this._gyro.gyroDPS.x);
                    maxX = Math.max(maxX, this._gyro.gyroDPS.x);
                    minY = Math.min(minY, this._gyro.gyroDPS.y);
                    maxY = Math.max(maxY, this._gyro.gyroDPS.y);
                    minZ = Math.min(minZ, this._gyro.gyroDPS.z);
                    maxX = Math.max(maxZ, this._gyro.gyroDPS.z);

                    totalX += this._gyro.gyroDPS.x;
                    totalY += this._gyro.gyroDPS.y;
                    totalZ += this._gyro.gyroDPS.z;
                });

                this._numSamplesProcessed++;
                if (this._numSamplesProcessed >= this._numSamplesToTake) {
                    clearInterval(this._calibrationInterval);
                    this._state = CalibrationState.IDLE;

                    // Take the average
                    this._lastZeroOffsetValue = {
                        x: totalX / this._numSamplesToTake,
                        y: totalY / this._numSamplesToTake,
                        z: totalZ / this._numSamplesToTake
                    };

                    this._lastNoiseValue = {
                        x: maxX - minX,
                        y: maxY - minY,
                        z: maxZ - minZ
                    };

                    // Update the gyro with the new zero offset values
                    this._gyro.gyroOffset = this._lastZeroOffsetValue;

                    logger.info("Gyro Calibration Complete");
                    logger.info(`Zero Offset: ${JSON.stringify(this._lastZeroOffsetValue)}`);
                    logger.info(`Noise: ${JSON.stringify(this._lastNoiseValue)}`);
                }
            }, this._sampleIntervalMs);
        });

    }

    public get currentState(): CalibrationState {
        return this._state;
    }

    public get percentComplete(): number {
        if (this._state === CalibrationState.IDLE) {
            return 100;
        }

        return Math.floor((this._numSamplesProcessed / this._numSamplesToTake) * 100);
    }

    public get estimatedTimeLeft(): number {
        if (this._state === CalibrationState.IDLE) {
            return 0;
        }

        return ((this._numSamplesToTake - this._numSamplesProcessed) * this._sampleIntervalMs / 1000);
    }

    public get lastZeroOffsetValue(): Vector3 {
        return this._lastZeroOffsetValue;
    }

    public get lastNoiseValue(): Vector3 {
        return this._lastNoiseValue;
    }
}
