#include "low_voltage_helper.h"
#include <Romi32U4Buzzer.h>

static bool lastLVFlag = false;
static bool currLVFlag = false;
static volatile unsigned long lvCount = 0;

static const char lvTune[] PROGMEM = "!L8 V8 A<A A<A A<A A<A R1R1";

static Romi32U4Buzzer bzr;

void LowVoltageHelper::update(uint16_t currVoltageMV) {
  lastLVFlag = currLVFlag;

  if (currVoltageMV < kMinOperatingMV) {
    // We are now in a low voltage mode
    currLVFlag = true;

    if (!lastLVFlag) {
      // We transitioned from Non-LV -> LV
      // Start the count
      lvCount = 0;
    }
    else {
      // We are still in LV mode
      lvCount++;
    }
  }
  else {
    // We are NOT in LV mode
    currLVFlag = false;

    if (lastLVFlag) {
      // We transitioned from LV -> Non-LV
      lvCount = 0;
    }
  }
}

bool LowVoltageHelper::isLowVoltage() {
  return (currLVFlag && lvCount >= kLVCountThreshold);
}

void LowVoltageHelper::lowVoltageAlertCheck() {
  if (isLowVoltage()) {
    if (!bzr.playCheck()) {
      bzr.playFromProgramSpace(lvTune);
    }
  }
  else {
    bzr.stopPlaying();
  }
}
