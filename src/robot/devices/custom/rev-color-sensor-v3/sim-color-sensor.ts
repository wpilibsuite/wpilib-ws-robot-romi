import { SimDevice, FieldDirection } from "@wpilib/wpilib-ws-robot";

export default class SimColorSensor extends SimDevice {
    constructor(portIdx: number, chIdx: number) {
        super("REV Color Sensor V3", portIdx, chIdx);

        this.registerField("Red", FieldDirection.INPUT_TO_ROBOT_CODE, 0.0);
        this.registerField("Green", FieldDirection.INPUT_TO_ROBOT_CODE, 0.0);
        this.registerField("Blue", FieldDirection.INPUT_TO_ROBOT_CODE, 0.0);
        this.registerField("IR", FieldDirection.INPUT_TO_ROBOT_CODE, 0.0);
        this.registerField("Proximity", FieldDirection.INPUT_TO_ROBOT_CODE, 0.0);
    }

    public set red(value: number) {
        this.setValue("Red", value);
    }

    public get red(): number {
        return this.getValue("Red");
    }

    public set green(value: number) {
        this.setValue("Green", value);
    }

    public get green(): number {
        return this.getValue("Green");
    }

    public set blue(value: number) {
        this.setValue("Blue", value);
    }

    public get blue(): number {
        return this.getValue("Blue");
    }

    public set infrared(value: number) {
        this.setValue("IR", value);
    }

    public get infrared(): number {
        return this.getValue("IR");
    }

    public set proximity(value: number) {
        this.setValue("Proximity", value);
    }

    public get proximity(): number {
        return this.getValue("Proximity");
    }
}
