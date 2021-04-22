import { DigitalChannelMode, SimDevice } from "@wpilib/wpilib-ws-robot";
import { NetworkTable, NetworkTableInstance } from "node-ntcore";
import QueuedI2CBus from "../../../device-interfaces/i2c/queued-i2c-bus";

export interface IOInterfaces {
    numDioPorts?: number;
    numAnalogInPorts?: number;
    numPwmOutPorts?: number;
    simDevices?: SimDevice[];
}

export interface RobotHardwareInterfaces {
    i2cBus: QueuedI2CBus
}

export default abstract class CustomDevice {
    private _deviceType: string;
    private _isSingleton: boolean;

    private _deviceNetworkTable: NetworkTable | null = null;

    protected _robotHWInterfaces: RobotHardwareInterfaces;

    constructor(deviceType: string, isSingleton: boolean, robotHW: RobotHardwareInterfaces, useNT: boolean = false) {
        this._deviceType = deviceType;
        this._isSingleton = isSingleton;
        this._robotHWInterfaces = robotHW;

        if (useNT) {
            this._deviceNetworkTable = NetworkTableInstance.getDefault().getTable(`/Romi/CustomDevice/${this.identifier}`);
        }
    }

    public get deviceType(): string {
        return this._deviceType;
    }

    public get isSingleton(): boolean {
        return this._isSingleton;
    }

    public get identifier(): string {
        return this._deviceType;
    }

    public abstract get ioInterfaces(): IOInterfaces;

    protected get networkTable(): NetworkTable | null {
        return this._deviceNetworkTable;
    }

    public abstract update(): void;

    // IO operations
    public setDigitalChannelMode(channel: number, mode: DigitalChannelMode): void {
        throw new Error("setDigitalChannelMode must be implemented by subclass");
    }

    public setDIOValue(channel: number, value: boolean): void {
        throw new Error("setDIOValue must be implemented by subclass");
    }

    public setPWMValue(channel: number, value: number): void {
        throw new Error("setPWMValue must be implemented by subclass");
    }

    public getAnalogInVoltage(channel: number): Promise<number> {
        throw new Error("getAnalogInValue must be implemented by subclass");
    }

    public getDigitalInValue(channel: number): Promise<boolean> {
        throw new Error("getDigitalInValue must be implemented by subclass");
    }

}
