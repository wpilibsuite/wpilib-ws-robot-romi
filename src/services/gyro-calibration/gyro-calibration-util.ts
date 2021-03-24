import LogUtil from "../../utils/logging/log-util";
import LSM6, { Vector3 } from "../../robot/devices/core/lsm6/lsm6";
import WPILibWSRomiRobot from "../../robot/romi-robot";

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

export default class GyroCalibrationUtil {
    private _gyro: LSM6;
    private _robot: WPILibWSRomiRobot;

    private _state: CalibrationState = CalibrationState.IDLE;
    private _numSamplesProcessed: number = 0;

    private _numSamplesToTake: number = DEFAULT_NUM_SAMPLES;

    private _calibrationInterval: NodeJS.Timeout | undefined;

    private _lastZeroOffsetValue: Vector3 = { x: 0, y: 0, z: 0 };
    private _lastNoiseValue: Vector3 = { x: 0, y: 0, z: 0 };

    constructor(robot: WPILibWSRomiRobot,config?: CalibrationConfig) {
        this._robot = robot;
        this._gyro = robot.getIMU();

        if (config?.numSamples) {
            this._numSamplesToTake = config.numSamples;
        }
    }

    public calibrate() {
        // Cancel any existing calibration intervals
        if (this._calibrationInterval) {
            clearInterval(this._calibrationInterval);
            this._calibrationInterval = undefined;
        }

        logger.info("Beginning Gyro Calibration...");
        // Pause robot IMU reads
        this._robot.pauseIMUReads("Calibration Running");

        this._state = CalibrationState.CALIBRATING;

        // Reset the gyro offsets
        this._gyro.gyroOffset = { x: 0, y: 0, z: 0 };

        this._numSamplesProcessed = 0;
        let minX: number = Number.MAX_VALUE;
        let maxX: number = Number.MIN_VALUE;
        let minY: number = Number.MAX_VALUE;
        let maxY: number = Number.MIN_VALUE;
        let minZ: number = Number.MAX_VALUE;
        let maxZ: number = Number.MIN_VALUE;

        let totalX: number = 0;
        let totalY: number = 0;
        let totalZ: number = 0;

        this._calibrationInterval = setInterval(() => {
            const frames = this._gyro.getNewFIFOData();
            if (frames.length === 0) {
                return;
            }

            frames.forEach(frame => {
                minX = Math.min(minX, frame.gyroX);
                maxX = Math.max(maxX, frame.gyroX);
                minY = Math.min(minY, frame.gyroY);
                maxY = Math.max(maxY, frame.gyroY);
                minZ = Math.min(minZ, frame.gyroZ);
                maxZ = Math.max(maxZ, frame.gyroZ);

                totalX += frame.gyroX;
                totalY += frame.gyroY;
                totalZ += frame.gyroZ;
            });

            this._numSamplesProcessed += frames.length;

            if (this._numSamplesProcessed >= this._numSamplesToTake) {
                clearInterval(this._calibrationInterval);
                this._state = CalibrationState.IDLE;

                this._robot.resumeIMUReads("Calibration Complete");

                // Take the average
                this._lastZeroOffsetValue = {
                    x: totalX / this._numSamplesProcessed,
                    y: totalY / this._numSamplesProcessed,
                    z: totalZ / this._numSamplesProcessed
                };

                this._lastNoiseValue = {
                    x: maxX - minX,
                    y: maxY - minY,
                    z: maxZ - minZ
                };

                this._gyro.gyroOffset = this._lastZeroOffsetValue;
                logger.info("Gyro Calibration Complete");
                logger.info(`Zero Offset: ${JSON.stringify(this._lastZeroOffsetValue)}`);
                logger.info(`Noise: ${JSON.stringify(this._lastNoiseValue)}`);
                logger.info(`xRange(${minX},${maxX}), yRange(${minY},${maxY}), zRange(${minZ},${maxZ})`);
            }
        }, 20);
    }

    public get currentState(): CalibrationState {
        return this._state;
    }

    public get percentComplete(): number {
        if (this._state === CalibrationState.IDLE) {
            return 100;
        }

        let result = Math.floor((this._numSamplesProcessed / this._numSamplesToTake) * 100);
        if (result > 100) {
            result = 100;
        }

        return result;
    }

    public get estimatedTimeLeft(): number {
        if (this._state === CalibrationState.IDLE) {
            return 0;
        }

        return ((this._numSamplesToTake - this._numSamplesProcessed) * this._gyro.getFIFOPeriod());
    }

    public get lastZeroOffsetValue(): Vector3 {
        return this._lastZeroOffsetValue;
    }

    public get lastNoiseValue(): Vector3 {
        return this._lastNoiseValue;
    }
}
