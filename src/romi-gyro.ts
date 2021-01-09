import { RobotGyro } from "@wpilib/wpilib-ws-robot";
import LSM6, { Vector3 } from "./lsm6";

export default class RomiGyro extends RobotGyro {
    private _lsm6: LSM6;

    private _lastUpdateTimeMs: number = -1;
    private _angle: Vector3 = { x:0, y: 0, z: 0 };

    constructor(lsm6: LSM6) {
        super("RomiGyro");

        this._lsm6 = lsm6;
    }

    public update(): void {
        const currUpdateTimeMs = Date.now();

        // If we haven't had an update before, update the "last time"
        // and bail out (since we have no reference to calculate angles)
        if (this._lastUpdateTimeMs === -1) {
            this._lastUpdateTimeMs = currUpdateTimeMs;
            return;
        }

        const currGyroValues = this._lsm6.gyroDPS;

        const gyroRateX = currGyroValues.x;
        const gyroRateY = -currGyroValues.y;
        const gyroRateZ = -currGyroValues.z;

        // Set the rate values
        this.rateX = gyroRateX
        this.rateY = gyroRateY;
        this.rateZ = gyroRateZ;

        // Calculate the angles
        const timeDiffInSeconds = (currUpdateTimeMs - this._lastUpdateTimeMs) / 1000;
        this._angle.x = this._angle.x + (timeDiffInSeconds * gyroRateX);
        this._angle.y = this._angle.y + (timeDiffInSeconds * gyroRateY);
        this._angle.z = this._angle.z + (timeDiffInSeconds * gyroRateZ);

        // Set the angles
        this.angleX = this._angle.x;
        this.angleY = this._angle.y;
        this.angleZ = this._angle.z;

        // Last step - update the "last time"
        this._lastUpdateTimeMs = currUpdateTimeMs;
    }

    public reset(): void {
        this._angle = { x: 0, y: 0, z: 0 };
    }
}
