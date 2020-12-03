import { SimDevice, FieldDirection } from "@wpilib/wpilib-ws-robot";
import LSM6, { AccelerometerScale } from "./lsm6";

export default class RomiSimAccelerometer extends SimDevice {
    private _sensitivity: AccelerometerScale;
    private _lsm6: LSM6;

    constructor(lsm6: LSM6) {
        super("Accel:BuiltInAccelerometer");

        this._lsm6 = lsm6;

        this.registerField("x", FieldDirection.BIDIR, 0); // fieldIdent: <>x
        this.registerField("y", FieldDirection.BIDIR, 0); // fieldIdent: <>y
        this.registerField("z", FieldDirection.BIDIR, 0); // fieldIdent: <>z
        this.registerField("range", FieldDirection.OUTPUT_FROM_ROBOT_CODE, 2); // fieldIdent: <range
    }

    _onSetValue(field: string, value: any) {
        if (field === "range") {
            if (value === 2) {
                this._sensitivity = AccelerometerScale.SCALE_2G;
            }
            else if (value === 4) {
                this._sensitivity = AccelerometerScale.SCALE_4G;
            }
            else if (value === 8) {
                this._sensitivity = AccelerometerScale.SCALE_8G;
            }
            else if (value === 16) {
                this._sensitivity = AccelerometerScale.SCALE_16G;
            }
            else {
                this._sensitivity = AccelerometerScale.SCALE_2G;
            }

            this._lsm6.setAccelerometerScale(this._sensitivity);
        }
    }

    /**
     * Take the current values stored in the LSM6 and update the
     * SimDevice fields
     */
    public update(): void {
        this.setValue("x", this._lsm6.accelerationG.x);
        this.setValue("y", this._lsm6.accelerationG.y);
        this.setValue("z", this._lsm6.accelerationG.z);
    }
}
