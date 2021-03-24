import { RobotAccelerometer } from "@wpilib/wpilib-ws-robot";
import LSM6, { FIFOFrame } from "./devices/core/lsm6/lsm6";
import { AccelerometerScale } from "./devices/core/lsm6/lsm6-settings";

export default class RomiAccelerometer extends RobotAccelerometer {
    private _sensitivity: AccelerometerScale;
    private _lsm6: LSM6;

    constructor(lsm6: LSM6) {
        super("BuiltInAccel");

        this._lsm6 = lsm6;
    }

    protected _onSetRange(range: number) {
        if (range === 2) {
            this._sensitivity = AccelerometerScale.SCALE_2G;
        }
        else if (range === 4) {
            this._sensitivity = AccelerometerScale.SCALE_4G;
        }
        else if (range === 8) {
            this._sensitivity = AccelerometerScale.SCALE_8G;
        }
        else if (range === 16) {
            this._sensitivity = AccelerometerScale.SCALE_16G;
        }
        else {
            this._sensitivity = AccelerometerScale.SCALE_2G;
        }

        this._lsm6.setAccelerometerScale(this._sensitivity);
    }

    public updateFromFrames(buffer: FIFOFrame[], dt: number): void {
        if (buffer.length === 0) {
            return;
        }

        // Update to the latest frame's data
        const frame = buffer[buffer.length - 1];

        // These follow NED conventions
        this.accelX = -frame.accelX;
        this.accelY = frame.accelY;
        this.accelZ = frame.accelZ;
    }
}
