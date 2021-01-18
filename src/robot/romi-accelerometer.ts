import { RobotAccelerometer } from "@wpilib/wpilib-ws-robot";
import LSM6, { AccelerometerScale } from "./devices/lsm6/lsm6";

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

    public update(): void {
        // These follow NED conventions
        this.accelX = -this._lsm6.accelerationG.x;
        this.accelY = this._lsm6.accelerationG.y;
        this.accelZ = this._lsm6.accelerationG.z;
    }
}
