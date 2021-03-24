import LSM6 from "../robot/devices/core/lsm6/lsm6";
import I2CPromisifiedBus from "../device-interfaces/i2c/i2c-connection";
import { FIFOModeSelection, OutputDataRate } from "../robot/devices/core/lsm6/lsm6-settings";

async function main() {
    const I2C_BUS_NUM = 1;

    let i2cBus: I2CPromisifiedBus;
    try {
        const HardwareI2C = require("../device-interfaces/i2c/hw-i2c").default;
        i2cBus = new HardwareI2C(I2C_BUS_NUM);
    }
    catch (err) {
        console.error("Could not load hardware I2C. Bailing out");
        process.exit(1);
    }

    const lsm6 = new LSM6(i2cBus, 0x6B);

    await lsm6.init();

    lsm6.settings.accelFIFOEnabled = true;
    lsm6.settings.gyroFIFOEnabled = true;
    lsm6.settings.accelODR = OutputDataRate.ODR_104_HZ;
    lsm6.settings.gyroODR = OutputDataRate.ODR_104_HZ;
    lsm6.settings.fifoSampleRate = OutputDataRate.ODR_104_HZ;
    lsm6.settings.fifoModeSelection = FIFOModeSelection.CONTINUOUS;

    await lsm6.begin();
    lsm6.fifoStart();

    setInterval(() => {
        const frames = lsm6.getNewFIFOData();
        console.log(`NUMBER OF FRAMES: ${frames.length}`);
    }, 50);
}


main();
