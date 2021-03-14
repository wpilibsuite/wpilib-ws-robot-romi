export enum OutputDataRate {
    ODR_DISABLED = "DISABLED",
    ODR_12_5_HZ = "12.5Hz",
    ODR_26_HZ = "26Hz",
    ODR_52_HZ = "52Hz",
    ODR_104_HZ = "104Hz",
    ODR_208_HZ = "208Hz",
    ODR_416_HZ = "416Hz",
    ODR_833_HZ = "833Hz",
    ODR_1_66_KHZ = "1.66KHz",
    ODR_3_33_KHZ = "3.33KHz",
    ODR_6_66_KHZ = "6.66KHz"
}

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

export enum FIFOModeSelection {
    BYPASS = "BYPASS",
    FIFO = "FIFO",
    CONTINUOUS_FIFO = "CONTINUOUS_FIFO",
    BYPASS_CONTINUOUS = "BYPASS_CONTINUOUS",
    CONTINUOUS = "CONTINUOUS"
}

export default class LSM6Settings {
    // Gyro settings
    public gyroEnabled: boolean = true;
    public gyroRange: GyroScale = GyroScale.SCALE_1000_DPS;
    public gyroODR: OutputDataRate = OutputDataRate.ODR_104_HZ;
    public gyroFIFOEnabled: boolean = false;
    public gyroFIFODecimation: number = 1;

    // Accelerometer Settings
    public accelEnabled: boolean = true;
    public accelRange: AccelerometerScale = AccelerometerScale.SCALE_2G;
    public accelODR: OutputDataRate = OutputDataRate.ODR_104_HZ;
    public accelFIFOEnabled: boolean = false;
    public accelFIFODecimation: number = 1;

    // FIFO Control Data
    public fifoThreshold: number = 0;
    public fifoSampleRate: OutputDataRate = OutputDataRate.ODR_104_HZ;
    public fifoModeSelection: FIFOModeSelection = FIFOModeSelection.BYPASS;
}
