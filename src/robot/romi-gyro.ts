import { RobotGyro } from "@wpilib/wpilib-ws-robot";
import LSM6, { FIFOFrame, Vector3 } from "./devices/core/lsm6/lsm6";
import SimpleMovingAverage from "../utils/filters/simple-moving-average";
import StreamFilter from "../utils/filters/stream-filter";
import PassThroughFilter from "../utils/filters/pass-through";
import LogUtil from "../utils/logging/log-util";

const SMA_WINDOW_SIZE = 5;

const logger = LogUtil.getLogger("ROMI-GYRO");

export default class RomiGyro extends RobotGyro {
    private _lsm6: LSM6;

    private _lastUpdateTimeMs: number = -1;
    private _angle: Vector3 = { x:0, y: 0, z: 0 };

    private _filterWindow: number = SMA_WINDOW_SIZE;

    private _rateXFilter: StreamFilter;
    private _rateYFilter: StreamFilter;
    private _rateZFilter: StreamFilter;

    constructor(lsm6: LSM6, filterWindow: number = SMA_WINDOW_SIZE) {
        super("RomiGyro");

        this._lsm6 = lsm6;

        this.filterWindow = filterWindow;
    }

    public set filterWindow(val: number) {
        if (val < 0) {
            val = 0;
        }

        this._filterWindow = Math.floor(val);

        logger.info("Filter Window set to " + this._filterWindow);

        if (this._filterWindow === 0) {
            // Set up the pass through filter
            this._rateXFilter = new PassThroughFilter();
            this._rateYFilter = new PassThroughFilter();
            this._rateZFilter = new PassThroughFilter();
        }
        else {
            this._rateXFilter = new SimpleMovingAverage(this._filterWindow);
            this._rateYFilter = new SimpleMovingAverage(this._filterWindow);
            this._rateZFilter = new SimpleMovingAverage(this._filterWindow);
        }
    }

    public get filterWindow(): number {
        return this._filterWindow;
    }

    public updateFromFrames(buffer: FIFOFrame[], dt: number): void {
        if (buffer.length === 0) {
            return;
        }

        buffer.forEach(frame => {
            const gyroRateX = this._rateXFilter.getValue(frame.gyroX);
            const gyroRateY = this._rateYFilter.getValue(-frame.gyroY);
            const gyroRateZ = this._rateZFilter.getValue(-frame.gyroZ);

            this.rateX = gyroRateX;
            this.rateY = gyroRateY;
            this.rateZ = gyroRateZ;

            this._angle.x = this._angle.x + (dt * gyroRateX);
            this._angle.y = this._angle.y + (dt * gyroRateY);
            this._angle.z = this._angle.z + (dt * gyroRateZ);

            // Set the angles
            this.angleX = this._angle.x;
            this.angleY = this._angle.y;
            this.angleZ = this._angle.z;
        });
    }

    public reset(): void {
        this._angle = { x: 0, y: 0, z: 0 };
    }
}
